import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBotUser } from "@/lib/botUtils";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        creator: {
          select: {
            id: true,
            walletAddress: true,
            username: true,
          },
        },
        players: {
          include: {
            user: {
              select: {
                id: true,
                walletAddress: true,
                username: true,
              },
            },
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

    // CRITICAL: Handle bot players - check by walletAddress, not userId
    const playersWithBots = game.players.map((player) => {
      // Check if user's walletAddress indicates it's a bot
      if (player.user && player.user.walletAddress.startsWith("bot-")) {
        return {
          ...player,
          user: {
            ...player.user,
            // Keep user object but mark as bot
          },
        };
      }
      return player;
    });

    return NextResponse.json({ 
      game: {
        ...game,
        players: playersWithBots,
      }
    });
  } catch (error) {
    console.error("Error fetching game:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

