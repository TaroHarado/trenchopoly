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

    const player = game.players.find((p) => p.userId === user.id);
    if (!player) {
      return NextResponse.json(
        { error: "Not a player in this game" },
        { status: 400 }
      );
    }

    // If host leaves, end the game
    if (player.isHost) {
      await prisma.game.update({
        where: { id: gameId },
        data: {
          status: "FINISHED",
          endedAt: new Date(),
        },
      });
    }

    await prisma.gamePlayer.delete({
      where: { id: player.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error leaving game:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

