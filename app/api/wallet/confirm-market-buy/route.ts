import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyTransferSignature, solToLamports } from "@/lib/solana";

const PLATFORM_FEE_PERCENT = 0.1;

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { listingId, signature } = body;

    if (!listingId || !signature) {
      return NextResponse.json(
        { error: "listingId and signature are required" },
        { status: 400 }
      );
    }

    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: listingId },
      include: {
        seller: true,
        inventoryItem: true,
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    if (listing.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Listing is not active" },
        { status: 400 }
      );
    }

    if (listing.sellerId === user.id) {
      return NextResponse.json(
        { error: "Cannot buy your own listing" },
        { status: 400 }
      );
    }

    const houseWallet = process.env.HOUSE_WALLET_PUBLIC_KEY;
    if (!houseWallet) {
      return NextResponse.json(
        { error: "House wallet not configured" },
        { status: 500 }
      );
    }

    const amountLamports = solToLamports(listing.priceSol);

    // Check for idempotency
    // For SQLite, we need to search differently since JSON filters aren't supported
    const allMarketLogs = await prisma.transactionLog.findMany({
      where: {
        signature,
        type: "MARKET_BUY",
      },
    });
    
    const existingLog = allMarketLogs.find(log => {
      if (!log.metadata) return false;
      try {
        const metadata = JSON.parse(log.metadata);
        return metadata.listingId === listingId;
      } catch {
        return false;
      }
    });

    if (existingLog) {
      // Already processed - return success
      return NextResponse.json({ 
        success: true, 
        message: "Purchase already confirmed" 
      });
    }

    // Verify transaction sender matches authenticated user
    const verification = await verifyTransferSignature(
      signature,
      houseWallet,
      amountLamports,
      user.walletAddress
    );

    if (!verification.valid) {
      // Log failed transaction attempt
      await prisma.transactionLog.create({
        data: {
          userId: user.id,
          type: "MARKET_BUY",
          amountSol: listing.priceSol,
          signature,
          metadata: JSON.stringify({ 
            listingId, 
            error: verification.error,
            failed: true 
          }),
        },
      });

      return NextResponse.json(
        { error: verification.error || "Invalid transaction signature" },
        { status: 400 }
      );
    }

    // Transfer ownership with transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // Re-check listing status within transaction
      const currentListing = await tx.marketplaceListing.findUnique({
        where: { id: listingId },
      });

      if (!currentListing) {
        throw new Error("Listing not found");
      }

      if (currentListing.status !== "ACTIVE") {
        throw new Error("Listing is not active");
      }

      // Double-check idempotency
      const existingLogInTx = await tx.transactionLog.findFirst({
        where: {
          signature,
          type: "MARKET_BUY",
        },
      });

      if (existingLogInTx) {
        return; // Already processed
      }

      await tx.marketplaceListing.update({
        where: { id: listingId },
        data: {
          status: "SOLD",
        },
      });

      await tx.inventoryItem.update({
        where: { id: listing.inventoryItemId },
        data: {
          userId: user.id,
        },
      });

      await tx.transactionLog.create({
        data: {
          userId: user.id,
          type: "MARKET_BUY",
          amountSol: listing.priceSol,
          signature,
          metadata: JSON.stringify({ listingId, sellerId: listing.sellerId }),
        },
      });

      await tx.transactionLog.create({
        data: {
          userId: listing.sellerId,
          type: "MARKET_SELL",
          amountSol: listing.priceSol * (1 - PLATFORM_FEE_PERCENT),
          signature,
          metadata: JSON.stringify({ listingId, buyerId: user.id }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error confirming market buy:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

