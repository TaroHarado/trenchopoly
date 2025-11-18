import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { solToLamports } from "@/lib/solana";
import { PublicKey } from "@solana/web3.js";

const PLATFORM_FEE_PERCENT = 0.1; // 10%

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
    const { listingId } = body;

    if (!listingId) {
      return NextResponse.json(
        { error: "listingId is required" },
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

    try {
      new PublicKey(houseWallet);
      new PublicKey(listing.seller.walletAddress);
    } catch {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 500 }
      );
    }

    const platformFee = listing.priceSol * PLATFORM_FEE_PERCENT;
    const sellerAmount = listing.priceSol - platformFee;

    return NextResponse.json({
      amountLamports: solToLamports(listing.priceSol),
      sellerWalletAddress: listing.seller.walletAddress,
      sellerAmountLamports: solToLamports(sellerAmount),
      platformFeeLamports: solToLamports(platformFee),
      houseWalletPublicKey: houseWallet,
      listingId: listing.id,
    });
  } catch (error) {
    console.error("Error preparing market buy:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

