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
    const body = await request.json();
    const { ready } = body;

    if (typeof ready !== "boolean") {
      return NextResponse.json(
        { error: "ready must be a boolean" },
        { status: 400 }
      );
    }

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

    const player = game.players.find((p) => p.userId === user.id);
    if (!player) {
      return NextResponse.json(
        { error: "Not a player in this game" },
        { status: 400 }
      );
    }

    const updatedPlayer = await prisma.gamePlayer.update({
      where: { id: player.id },
      data: {
        isReady: ready,
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

    return NextResponse.json({ player: updatedPlayer });
  } catch (error) {
    console.error("Error updating ready status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

