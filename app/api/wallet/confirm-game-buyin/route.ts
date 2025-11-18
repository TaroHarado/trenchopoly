import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyTransferSignature, solToLamports } from "@/lib/solana";

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
    const { gameId, signature } = body;

    if (!gameId || !signature) {
      return NextResponse.json(
        { error: "gameId and signature are required" },
        { status: 400 }
      );
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          where: { userId: user.id },
        },
      },
    });

    if (!game) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    if (game.type !== "PAID" || !game.buyInSol) {
      return NextResponse.json(
        { error: "Game is not a paid game" },
        { status: 400 }
      );
    }

    const player = game.players[0];
    if (!player) {
      return NextResponse.json(
        { error: "You are not a player in this game" },
        { status: 400 }
      );
    }

    if (player.hasPaidBuyIn) {
      return NextResponse.json(
        { error: "Buy-in already paid" },
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

    const amountLamports = solToLamports(game.buyInSol);

    // Check for idempotency - if this signature was already processed
    // For SQLite, we need to search differently since JSON filters aren't supported
    const allBuyInLogs = await prisma.transactionLog.findMany({
      where: {
        signature,
        type: "GAME_BUYIN",
      },
    });
    
    const existingLog = allBuyInLogs.find(log => {
      if (!log.metadata) return false;
      try {
        const metadata = JSON.parse(log.metadata);
        return metadata.gameId === gameId;
      } catch {
        return false;
      }
    });

    if (existingLog) {
      // Already processed - return success (idempotent)
      return NextResponse.json({ 
        success: true, 
        message: "Buy-in already confirmed" 
      });
    }

    // Verify transaction sender matches authenticated user
    const verification = await verifyTransferSignature(
      signature,
      houseWallet,
      amountLamports,
      user.walletAddress // Verify sender matches authenticated user
    );

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || "Invalid transaction signature" },
        { status: 400 }
      );
    }

    // Use transaction to prevent race conditions
    await prisma.$transaction(async (tx) => {
      // Re-check player status within transaction
      const currentPlayer = await tx.gamePlayer.findUnique({
        where: { id: player.id },
      });

      if (!currentPlayer) {
        throw new Error("Player not found");
      }

      if (currentPlayer.hasPaidBuyIn) {
        // Already paid - idempotent success
        return;
      }

      // Update player
      await tx.gamePlayer.update({
        where: { id: player.id },
        data: {
          hasPaidBuyIn: true,
        },
      });

      // Log transaction
      await tx.transactionLog.create({
        data: {
          userId: user.id,
          type: "GAME_BUYIN",
          amountSol: game.buyInSol,
          signature,
          metadata: JSON.stringify({ gameId }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error confirming buy-in:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

