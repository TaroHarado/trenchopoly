import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createInitialState } from "@/server/gameEngine";
import { getIO } from "@/server/socket";
import { createBotPlayer, createBotPlayerState } from "@/server/botHelper";
import boardConfigData from "@/config/board.json";
const boardConfig = boardConfigData as any;

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

    const hostPlayer = game.players.find((p) => p.isHost);
    if (!hostPlayer || hostPlayer.userId !== user.id) {
      return NextResponse.json(
        { error: "Only the host can start the game" },
        { status: 403 }
      );
    }

    if (game.status !== "WAITING") {
      return NextResponse.json(
        { error: "Game already started or finished" },
        { status: 400 }
      );
    }

    if (game.players.length < 1) {
      return NextResponse.json(
        { error: "Need at least 1 player to start" },
        { status: 400 }
      );
    }

    // Check all players are ready (for single player, auto-ready is fine)
    const allReady = game.players.every((p) => p.isReady);
    if (!allReady && game.players.length > 1) {
      return NextResponse.json(
        { error: "All players must be ready" },
        { status: 400 }
      );
    }
    
    // Auto-ready single player for testing
    if (game.players.length === 1 && !game.players[0].isReady) {
      await prisma.gamePlayer.update({
        where: { id: game.players[0].id },
        data: { isReady: true },
      });
    }

    // For paid games, check all have paid
    if (game.type === "PAID") {
      const allPaid = game.players.every((p) => p.hasPaidBuyIn);
      if (!allPaid) {
        return NextResponse.json(
          { error: "All players must pay buy-in" },
          { status: 400 }
        );
      }
    }

    // Use transaction to prevent race condition (starting game twice)
    let initialState: any;
    await prisma.$transaction(async (tx) => {
      // Re-check game status within transaction
      const currentGame = await tx.game.findUnique({
        where: { id: gameId },
        include: {
          players: true,
        },
      });

      if (!currentGame) {
        throw new Error("Game not found");
      }

      if (currentGame.status !== "WAITING") {
        throw new Error("Game already started or finished");
      }

      // CRITICAL: If only 1 player, add a bot for single-player mode
      let playersToUse = [...currentGame.players];
      let botPlayerId: string | null = null;
      
      if (currentGame.players.length === 1) {
        console.log("Single player detected. Adding bot player...");
        const bot = createBotPlayer(gameId, 0);
        botPlayerId = bot.id;
        
        // CRITICAL: Create or get bot User in DB (required for foreign key constraint)
        // Use a special walletAddress format for bots
        const botWalletAddress = `bot-${gameId}-${Date.now()}`;
        let botUser = await tx.user.findUnique({
          where: { walletAddress: botWalletAddress },
        });
        
        if (!botUser) {
          botUser = await tx.user.create({
            data: {
              walletAddress: botWalletAddress,
              username: bot.name,
            },
          });
        }
        
        // Create bot as GamePlayer in DB
        await tx.gamePlayer.create({
          data: {
            id: bot.id,
            gameId: gameId,
            userId: botUser.id, // Use the actual User ID from DB
            isHost: false,
            isReady: true, // Bot is always ready
            hasPaidBuyIn: currentGame.type === "FREE", // Bot doesn't pay for FREE games
          },
        });
        
        // Update bot helper to use the actual user ID
        bot.userId = botUser.id;
        
        playersToUse.push({
          id: bot.id,
          userId: bot.userId,
          isHost: false,
          isReady: true,
          hasPaidBuyIn: currentGame.type === "FREE",
          gameId: gameId,
          position: 0,
          balance: 1500,
          joinedAt: new Date(),
        });
        
        console.log(`Bot player created: ${bot.id} (${bot.name})`);
      }

      // Create initial game state
      const playerIds = playersToUse.map((p) => p.id);
      const userIds = playersToUse.map((p) => p.userId);
      
      try {
        initialState = createInitialState(
          boardConfig as any,
          playerIds,
          userIds,
          100 // Optional turn limit
        );
        
        // Mark that this is a new game (for checkGameEnd logic)
        initialState.gameJustStarted = true;
        // CRITICAL: Set minTurnsBeforeEnd to ensure all players take at least 1 turn
        // This prevents game from ending after first player's first roll
        // Minimum = number of players (each must take at least 1 turn)
        const totalPlayers = playersToUse.length;
        initialState.minTurnsBeforeEnd = totalPlayers; // At least N turns (one per player) before game can end
        console.log(`[GAME START] Initialized game with ${totalPlayers} players. minTurnsBeforeEnd = ${initialState.minTurnsBeforeEnd}`);
      } catch (stateError: any) {
        console.error("Error creating initial state:", stateError);
        throw new Error(`Failed to create game state: ${stateError.message}`);
      }

      await tx.game.update({
        where: { id: gameId },
        data: {
          status: "IN_PROGRESS",
          turnState: JSON.stringify(initialState),
        },
      });
    });

    // Broadcast game start to all connected clients
    const socketIO = getIO();
    if (socketIO) {
      const room = `room:${gameId}`;
      socketIO.to(room).emit("state-update", {
        gameId,
        state: initialState,
        boardConfig: boardConfig,
      });
    }

    return NextResponse.json({ success: true, state: initialState });
  } catch (error: any) {
    console.error("Error starting game:", error);
    const errorMessage = error?.message || "Internal server error";
    console.error("Full error details:", {
      message: errorMessage,
      stack: error?.stack,
      name: error?.name,
    });
    return NextResponse.json(
      { error: errorMessage, details: process.env.NODE_ENV === "development" ? error?.stack : undefined },
      { status: 500 }
    );
  }
}

