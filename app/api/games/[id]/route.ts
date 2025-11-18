import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memoryStore, hasDatabase } from "@/lib/memoryStore";
import { isBotUser } from "@/lib/botUtils";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id;

    // If no database, use memory store
    if (!hasDatabase()) {
      const game = memoryStore.getGame(gameId);
      if (!game) {
        return NextResponse.json(
          { error: "Game not found" },
          { status: 404 }
        );
      }

      const creator = memoryStore.getUser(game.creatorId);
      const players = memoryStore.getPlayersByGame(gameId);

      const playersWithBots = players.map((player) => {
        const user = memoryStore.getUser(player.userId);
        return {
          ...player,
          user: user ? {
            id: user.id,
            walletAddress: user.walletAddress,
            username: user.username,
          } : null,
        };
      });

      return NextResponse.json({ 
        game: {
          ...game,
          creator: creator ? {
            id: creator.id,
            walletAddress: creator.walletAddress,
            username: creator.username,
          } : null,
          players: playersWithBots,
        }
      });
    }

    // Use database
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

