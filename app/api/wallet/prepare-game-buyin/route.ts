import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { solToLamports } from "@/lib/solana";
import { PublicKey } from "@solana/web3.js";

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
    const { gameId } = body;

    if (!gameId) {
      return NextResponse.json(
        { error: "gameId is required" },
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

    // Validate house wallet address
    try {
      new PublicKey(houseWallet);
    } catch {
      return NextResponse.json(
        { error: "Invalid house wallet address" },
        { status: 500 }
      );
    }

    const amountLamports = solToLamports(game.buyInSol);

    return NextResponse.json({
      amountLamports,
      houseWalletPublicKey: houseWallet,
      gameId: game.id,
    });
  } catch (error) {
    console.error("Error preparing buy-in:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

