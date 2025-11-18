import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { solToLamports, getConnection, getNetwork } from "@/lib/solana";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

const PLATFORM_FEE_PERCENT = 0.1; // 10%

// This endpoint prepares a payout transaction for the winner of a paid game
// In production, this should be done via a Solana program (PDA escrow)
// For MVP, we use simple transfers from house wallet
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const gameId = params.id;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!game) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    if (game.status !== "FINISHED") {
      return NextResponse.json(
        { error: "Game is not finished" },
        { status: 400 }
      );
    }

    if (game.type !== "PAID" || !game.buyInSol || !game.winnerId) {
      return NextResponse.json(
        { error: "Game is not a paid game or has no winner" },
        { status: 400 }
      );
    }

    // Calculate pot and payout
    const totalBuyIns = game.players.length * game.buyInSol;
    const platformFee = totalBuyIns * PLATFORM_FEE_PERCENT;
    const winnerPayout = totalBuyIns - platformFee;

    const winner = game.players.find(p => p.id === game.winnerId);
    if (!winner) {
      return NextResponse.json(
        { error: "Winner not found" },
        { status: 404 }
      );
    }

    // Check for idempotency - if payout was already processed
    // For SQLite, we need to search differently since JSON filters aren't supported
    const allPayoutLogs = await prisma.transactionLog.findMany({
      where: {
        type: "GAME_PAYOUT",
      },
    });
    
    const existingPayoutLog = allPayoutLogs.find(log => {
      if (!log.metadata) return false;
      try {
        const metadata = JSON.parse(log.metadata);
        return metadata.gameId === gameId;
      } catch {
        return false;
      }
    });

    if (existingPayoutLog) {
      // Already processed - return existing payout info (idempotent)
      const payoutData = JSON.parse(existingPayoutLog.metadata || "{}");
      return NextResponse.json({
        winnerId: game.winnerId,
        winnerWalletAddress: winner.user.walletAddress,
        totalPot: payoutData.totalPot || totalBuyIns,
        platformFee: payoutData.platformFee || platformFee,
        winnerPayout: payoutData.winnerPayout || winnerPayout,
        payoutLamports: solToLamports(payoutData.winnerPayout || winnerPayout),
        signature: existingPayoutLog.signature,
        message: "Payout already processed",
      });
    }

    // For MVP: Return payout details
    // In production, this would build a transaction from escrow PDA to winner
    // TODO: Replace with Solana program escrow logic
    
    // Log payout preparation (not actual payout - that requires manual transaction)
    // This makes the endpoint idempotent
    await prisma.transactionLog.create({
      data: {
        userId: winner.userId,
        type: "GAME_PAYOUT",
        amountSol: winnerPayout,
        metadata: JSON.stringify({
          gameId,
          winnerId: game.winnerId,
          totalPot: totalBuyIns,
          platformFee,
          winnerPayout,
        }),
      },
    });

    return NextResponse.json({
      winnerId: game.winnerId,
      winnerWalletAddress: winner.user.walletAddress,
      totalPot: totalBuyIns,
      platformFee,
      winnerPayout,
      payoutLamports: solToLamports(winnerPayout),
      note: "In production, this should use a Solana program with PDA escrow. For MVP, manual payout required.",
    });
  } catch (error) {
    console.error("Error preparing payout:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

