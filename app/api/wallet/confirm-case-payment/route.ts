import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyTransferSignature, solToLamports } from "@/lib/solana";
import { TRENCHOPOLY_CASES, pickItemFromCase } from "@/config/cases";

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
    const { caseId, signature } = body;

    if (!caseId || !signature) {
      return NextResponse.json(
        { error: "caseId and signature are required" },
        { status: 400 }
      );
    }

    // Find case in config
    const lootCase = TRENCHOPOLY_CASES.find(c => c.id === caseId);

    if (!lootCase) {
      return NextResponse.json(
        { error: "Case not found" },
        { status: 404 }
      );
    }

    // Check if case is free
    if (lootCase.free || lootCase.priceSol === 0) {
      return NextResponse.json(
        { error: "This case is free, no payment required" },
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

    const amountLamports = solToLamports(lootCase.priceSol);

    // Check for idempotency
    const existingLog = await prisma.transactionLog.findFirst({
      where: {
        signature,
        type: "CASE_OPEN",
        metadata: {
          path: ["caseId"],
          equals: caseId,
        },
      },
    });

    if (existingLog) {
      // Return the existing item from inventory
      const existingItem = await prisma.inventoryItem.findFirst({
        where: {
          userId: user.id,
          caseId: lootCase.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (existingItem) {
        // Get item metadata from config
        const itemMeta = lootCase.items.find(i => i.id === existingItem.itemId);
        return NextResponse.json({ 
          success: true,
          item: itemMeta ? {
            id: itemMeta.id,
            name: itemMeta.name,
            ticker: itemMeta.ticker,
            rarity: itemMeta.rarity,
            imageUrl: itemMeta.imageUrl,
          } : null,
          message: "Case already opened" 
        });
      }
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
      try {
        await prisma.transactionLog.create({
          data: {
            userId: user.id,
            type: "CASE_OPEN",
            amountSol: lootCase.priceSol,
            signature,
            metadata: JSON.stringify({ 
              caseId, 
              error: verification.error,
              failed: true 
            }),
          },
        });
      } catch (logError) {
        console.error('[CONFIRM_CASE_PAYMENT] Failed to log failed transaction:', logError);
      }

      return NextResponse.json(
        { error: verification.error || "Invalid transaction signature" },
        { status: 400 }
      );
    }

    // Pick item from case
    const selectedItem = pickItemFromCase(lootCase);

    // Use transaction to ensure atomicity
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Double-check idempotency within transaction
        const existingLogInTx = await tx.transactionLog.findFirst({
          where: {
            signature,
            type: "CASE_OPEN",
          },
        });

        if (existingLogInTx) {
          // Already processed - return existing item
          const existingItem = await tx.inventoryItem.findFirst({
            where: {
              userId: user.id,
              caseId: lootCase.id,
            },
            orderBy: {
              createdAt: "desc",
            },
          });
          
          if (existingItem) {
            const itemMeta = lootCase.items.find(i => i.id === existingItem.itemId);
            return { 
              item: itemMeta ? {
                id: itemMeta.id,
                name: itemMeta.name,
                ticker: itemMeta.ticker,
                rarity: itemMeta.rarity,
                imageUrl: itemMeta.imageUrl,
              } : null,
              isExisting: true 
            };
          }
        }

        // Create inventory item
        await tx.inventoryItem.create({
          data: {
            userId: user.id,
            caseId: lootCase.id,
            itemId: selectedItem.id,
            rarity: selectedItem.rarity,
          },
        });

        // Log transaction
        await tx.transactionLog.create({
          data: {
            userId: user.id,
            type: "CASE_OPEN",
            amountSol: lootCase.priceSol,
            signature,
            metadata: JSON.stringify({ caseId, itemId: selectedItem.id }),
          },
        });

        return { 
          item: {
            id: selectedItem.id,
            name: selectedItem.name,
            ticker: selectedItem.ticker,
            rarity: selectedItem.rarity,
            imageUrl: selectedItem.imageUrl,
          },
          isExisting: false 
        };
      });

      return NextResponse.json({
        success: true,
        item: result.item,
        message: result.isExisting ? "Case already opened" : undefined,
      });
    } catch (dbError: any) {
      console.error('[CONFIRM_CASE_PAYMENT_DB_ERROR] Failed to save inventory:', dbError);
      // Even if DB fails, return the item so animation works
      return NextResponse.json({
        success: true,
        item: {
          id: selectedItem.id,
          name: selectedItem.name,
          ticker: selectedItem.ticker,
          rarity: selectedItem.rarity,
          imageUrl: selectedItem.imageUrl,
        },
        warning: "Payment verified but inventory save failed",
      });
    }
  } catch (error) {
    console.error("Error confirming case payment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

