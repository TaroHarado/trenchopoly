import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
        players: true,
      },
    });

    if (!game) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    if (game.status !== "WAITING") {
      return NextResponse.json(
        { error: "Game is not accepting new players" },
        { status: 400 }
      );
    }

    if (game.players.length >= game.maxPlayers) {
      return NextResponse.json(
        { error: "Game is full" },
        { status: 400 }
      );
    }

    // Check if already joined
    const existingPlayer = game.players.find((p) => p.userId === user.id);
    if (existingPlayer) {
      return NextResponse.json(
        { error: "Already joined this game" },
        { status: 400 }
      );
    }

    const player = await prisma.gamePlayer.create({
      data: {
        gameId: game.id,
        userId: user.id,
        isHost: false,
        isReady: false,
        hasPaidBuyIn: game.type === "FREE",
      },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json({ player });
  } catch (error) {
    console.error("Error joining game:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

