/**
 * Socket.io Server for Real-Time Game State Synchronization
 * 
 * ACTION FLOW PIPELINE:
 * 
 * 1. CLIENT: User clicks button (e.g., "Roll Dice")
 *    - Component: app/game/[gameId]/page.tsx -> handleAction()
 *    - Emits: socket.emit("action", { gameId, action, playerId })
 * 
 * 2. SERVER: Receives action event
 *    - Handler: socket.on("action", ...) in this file
 *    - Validates: verifySocketAuth(), validateAction()
 *    - Applies: applyAction(currentState, action, boardConfig)
 *    - Checks: checkGameEnd(newState, boardConfig)
 *    - Updates DB: prisma.game.update({ turnState: JSON.stringify(newState) })
 * 
 * 3. SERVER: Broadcasts state update
 *    - Emits: io.to(room).emit("state-update", { state, boardConfig, gameStatus, gameFinished })
 *    - If bot's turn: playBotTurn() -> recursively broadcasts again
 * 
 * 4. CLIENT: Receives state update
 *    - Handler: socket.on("state-update", ...) in app/game/[gameId]/page.tsx
 *    - Updates: setGameState(data.state), setBoardConfig(data.boardConfig)
 *    - UI re-renders with new state
 * 
 * CRITICAL: Every action MUST result in a state-update broadcast to all clients in the room.
 * If an action doesn't trigger a broadcast, the UI will not update until page refresh.
 */

import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "@/lib/prisma";
import { memoryStore, hasDatabase } from "@/lib/memoryStore";
import { validateAction, applyAction, checkGameEnd, rollDice } from "@/server/gameEngine";
import { GameAction, GameState, BoardConfig } from "@/lib/types";
import { verifySocketAuth } from "@/lib/socketAuth";
import { isBotPlayer } from "@/lib/botUtils";

let io: SocketIOServer | null = null;

export function initializeSocket(server: HTTPServer) {
  io = new SocketIOServer(server, {
    path: "/api/socket",
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", async (socket) => {
    console.log("Client connected:", socket.id);

    // Verify authentication on connection
    const auth = await verifySocketAuth(socket);
    if (!auth) {
      socket.emit("error", { message: "Authentication required" });
      socket.disconnect();
      return;
    }

    // Store authenticated user info on socket
    (socket as any).userId = auth.userId;
    (socket as any).walletAddress = auth.walletAddress;

    socket.on("join-room", async (data: { gameId: string }) => {
      try {
        const { gameId } = data;
        const room = `room:${gameId}`;
        
        console.log("[SOCKET SERVER] join-room", {
          socketId: socket.id,
          gameId,
          room,
          authenticatedUserId: (socket as any).userId,
        });

        // Verify game exists
        let game: any;
        let players: any[] = [];

        if (!hasDatabase()) {
          // Use memory store
          const memoryGame = memoryStore.getGame(gameId);
          if (!memoryGame) {
            console.error("[SOCKET SERVER] join-room: Game not found", { gameId, socketId: socket.id });
            socket.emit("error", { message: "Game not found" });
            return;
          }
          game = memoryGame;
          players = memoryStore.getPlayersByGame(gameId).map(p => {
            const user = memoryStore.getUser(p.userId);
            return {
              ...p,
              user: user ? {
                id: user.id,
                walletAddress: user.walletAddress,
                username: user.username,
              } : null,
            };
          });
        } else {
          // Use database
          game = await prisma.game.findUnique({
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
            console.error("[SOCKET SERVER] join-room: Game not found", { gameId, socketId: socket.id });
            socket.emit("error", { message: "Game not found" });
            return;
          }
          players = game.players;
        }

        socket.join(room);
        console.log("[SOCKET SERVER] join-room: Socket joined room", {
          socketId: socket.id,
          room,
          gameId,
          gameStatus: game.status,
        });

        // Send current game state
        const gameState = game.turnState ? JSON.parse(game.turnState) : null;
        const boardConfig = JSON.parse(game.boardConfig) as BoardConfig;

        socket.emit("state-update", {
          gameId,
          state: gameState,
          boardConfig,
        });

        // Broadcast player list update
        io!.to(room).emit("player-joined", {
          gameId,
          players: players.map((p) => ({
            id: p.id,
            userId: p.userId,
            user: p.user,
            isReady: p.isReady,
            isHost: p.isHost,
            hasPaidBuyIn: p.hasPaidBuyIn,
          })),
        });
      } catch (error) {
        console.error("Error joining room:", error);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    socket.on("leave-room", (data: { gameId: string }) => {
      const room = `room:${data.gameId}`;
      socket.leave(room);
    });

    socket.on("player-ready", async (data: { gameId: string; ready: boolean }) => {
      try {
        const { gameId, ready } = data;
        const room = `room:${gameId}`;

        // Update in DB would be handled by API route
        // Here we just broadcast
        io!.to(room).emit("player-ready-update", {
          gameId,
          ready,
        });
      } catch (error) {
        console.error("Error updating ready status:", error);
        socket.emit("error", { message: "Failed to update ready status" });
      }
    });

    socket.on("action", async (data: { gameId: string; action: GameAction; playerId: string }) => {
      console.log("[SOCKET SERVER] received action", {
        socketId: socket.id,
        gameId: data.gameId,
        action: data.action,
        playerId: data.playerId,
      });

      try {
        const { gameId, action, playerId } = data;

        // 1) грузим игру и стейт из БД или memory store
        let game: any;
        let state: GameState;
        let boardConfig: BoardConfig;

        if (!hasDatabase()) {
          // Use memory store
          const memoryGame = memoryStore.getGame(gameId);
          if (!memoryGame || !memoryGame.turnState) {
            console.error("[SOCKET SERVER] Game not found or has no state", { gameId });
            socket.emit("error", { message: "Game not found" });
            return;
          }
          game = memoryGame;
          state = JSON.parse(memoryGame.turnState);
          boardConfig = JSON.parse(memoryGame.boardConfig);
        } else {
          // Use database
          game = await prisma.game.findUnique({
            where: { id: gameId },
            include: {
              players: true,
            },
          });

          if (!game || !game.turnState) {
            console.error("[SOCKET SERVER] Game not found or has no state", { gameId });
            socket.emit("error", { message: "Game not found" });
            return;
          }

          state = JSON.parse(game.turnState);
          boardConfig = JSON.parse(game.boardConfig);
        }

        // Verify player belongs to authenticated user
        const authenticatedUserId = (socket as any).userId;
        if (!authenticatedUserId) {
          console.error("[SOCKET SERVER] Action rejected: no authenticated user");
          socket.emit("error", { message: "Authentication required" });
          return;
        }

        const player = game.players.find(p => p.id === playerId);
        if (!player || player.userId !== authenticatedUserId) {
          socket.emit("error", { message: "Unauthorized action" });
          return;
        }

        // If game is FINISHED, send state-update instead of processing action
        if (game.status === "FINISHED") {
          console.log("[SOCKET SERVER] Game already finished, sending final state");
          socket.emit("state-update", {
            gameId,
            state,
            boardConfig,
            gameStatus: "FINISHED",
            gameFinished: true,
          });
          return;
        }

        // If game is not IN_PROGRESS, send error
        if (game.status !== "IN_PROGRESS") {
          console.error("[SOCKET SERVER] Game is not in progress", { gameId, status: game.status });
          socket.emit("error", { message: `Game is not in progress. Current status: ${game.status}` });
          return;
        }

        // 2) применяем действие
        // Validate action first
        const validation = validateAction(state, action, playerId, boardConfig);
        if (!validation.valid) {
          socket.emit("error", { message: validation.error || "Invalid action" });
          return;
        }

        const newState = applyAction(state, action, boardConfig);

        // Check if action was rejected (error in lastAction)
        const errorIndicators = ["Cannot", "Invalid", "already", "Insufficient", "don't", "not found", "bankrupt", "no longer"];
        if (newState.lastAction && errorIndicators.some(indicator => 
          newState.lastAction!.toLowerCase().includes(indicator.toLowerCase())
        )) {
          socket.emit("error", { message: newState.lastAction });
          return;
        }

        console.log("[SOCKET SERVER] action applied", {
          gameId,
          phase: newState.phase,
          currentPlayerIndex: newState.currentPlayerIndex,
          turnNumber: newState.turnNumber,
        });

        // Check for game end
        const gameEnd = checkGameEnd(newState, boardConfig);
        const gameFinished = gameEnd.ended;

        if (gameFinished) {
          newState.gameEnded = true;
          newState.winnerId = gameEnd.winnerId;
          newState.winnerNetWorth = gameEnd.winnerNetWorth;
        }

        // 3) сохраняем стейт обратно в БД или memory store
        if (!hasDatabase()) {
          // Use memory store
          memoryStore.updateGame(gameId, {
            turnState: JSON.stringify(newState),
            status: gameFinished ? "FINISHED" : game.status,
            ...(gameFinished && gameEnd.winnerId ? {
              winnerId: gameEnd.winnerId,
              endedAt: new Date(),
            } : {}),
          });
        } else {
          // Use database
          await prisma.game.update({
            where: { id: gameId },
            data: {
              turnState: JSON.stringify(newState),
              status: gameFinished ? "FINISHED" : game.status,
              ...(gameFinished && gameEnd.winnerId ? {
                winnerId: gameEnd.winnerId,
                endedAt: new Date(),
              } : {}),
            },
          });
        }

        // 4) шлём state-update во ВСЮ комнату (включая отправителя)
        io!.to(`room:${gameId}`).emit("state-update", {
          gameId,
          gameStatus: gameFinished ? "FINISHED" : "IN_PROGRESS",
          state: newState,
          boardConfig,
        });

        console.log("[SOCKET SERVER] broadcasting state-update", {
          gameId,
          phase: newState.phase,
          currentPlayerIndex: newState.currentPlayerIndex,
          turnNumber: newState.turnNumber,
        });

        // 5) если теперь ход бота — запускаем автоход
        // Без лишних условий по фазе: бот должен уметь сам разрулить всё, что начинается с его хода
        const currentPlayer = newState.players[newState.currentPlayerIndex];
        if (currentPlayer && isBotPlayer(currentPlayer.id) && !gameFinished) {
          console.log("[SOCKET SERVER] Bot turn detected, starting playBotTurn", {
            gameId,
            playerId: currentPlayer.id,
            phase: newState.phase,
          });
          playBotTurn(gameId, currentPlayer.id, newState, boardConfig).catch((err) => {
            console.error("[BOT] error in playBotTurn", err);
          });
        }
      } catch (err: any) {
        console.error("[SOCKET SERVER] action handler error", err);
        socket.emit("error", { message: err?.message ?? "Unknown server error" });
      }
    });

    socket.on("chat-message", (data: { gameId: string; message: string }) => {
      const authenticatedUserId = (socket as any).userId;
      if (!authenticatedUserId) {
        socket.emit("error", { message: "Authentication required" });
        return;
      }

      const room = `room:${data.gameId}`;
      io!.to(room).emit("chat-message", {
        gameId: data.gameId,
        message: data.message,
        userId: authenticatedUserId, // Use authenticated user, not client-supplied
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
}

/**
 * Полностью отыгрывает ход бота от начала до конца
 * Гарантирует, что ход бота никогда не останется в состоянии phase === 'END_TURN'
 */
async function playBotTurn(
  gameId: string,
  botPlayerId: string,
  initialState: GameState,
  boardConfig: BoardConfig
): Promise<void> {
  const socketIOInstance = getIO();
  if (!socketIOInstance) {
    console.error("[BOT] Socket IO not available, cannot play bot turn");
    return;
  }

  const room = `room:${gameId}`;
  let state = initialState;

  // Safety guard: если по какой-то причине currentPlayer не бот — выходим
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.id !== botPlayerId || !isBotPlayer(botPlayerId)) {
    console.log("[BOT] playBotTurn called but current player is not a bot", {
      currentPlayerId: currentPlayer?.id,
      botPlayerId,
      isBot: currentPlayer ? isBotPlayer(currentPlayer.id) : false,
    });
    return;
  }

  console.log("[BOT] Start bot turn", {
    gameId,
    playerIndex: state.currentPlayerIndex,
    playerId: botPlayerId,
    phase: state.phase,
  });

  try {
    // 1) Бот бросает кубики (если еще не бросил)
    if (state.phase === "ROLL") {
      const rollAction: GameAction = { type: "ROLL_DICE" };
      const validation = validateAction(state, rollAction, botPlayerId, boardConfig);
      
      if (!validation.valid) {
        console.error("[BOT] Cannot roll dice", validation.error);
        return;
      }

      state = applyAction(state, rollAction, boardConfig);

      // Сохраняем в БД
      await prisma.game.update({
        where: { id: gameId },
        data: {
          turnState: JSON.stringify(state),
        },
      });

      // Отправляем state-update
      socketIOInstance.to(room).emit("state-update", {
        gameId,
        state,
        boardConfig,
        gameStatus: "IN_PROGRESS",
      });

      console.log("[BOT] After ROLL_DICE", {
        phase: state.phase,
        currentPlayerIndex: state.currentPlayerIndex,
        position: state.players[state.currentPlayerIndex]?.position,
        diceRoll: state.diceRoll,
      });

      // Небольшая пауза, чтобы клиент увидел анимацию
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    // Получаем свежее состояние из БД
    const freshGame = await prisma.game.findUnique({
      where: { id: gameId },
    });
    if (!freshGame || freshGame.status !== "IN_PROGRESS") {
      console.log("[BOT] Game not in progress, exiting");
      return;
    }
    state = freshGame.turnState ? (JSON.parse(freshGame.turnState) as GameState) : state;

    // Проверяем, что это все еще ход бота
    const botPlayer = state.players[state.currentPlayerIndex];
    if (!botPlayer || botPlayer.id !== botPlayerId || !isBotPlayer(botPlayerId)) {
      console.log("[BOT] Not bot's turn anymore, exiting");
      return;
    }

    // Если игра закончилась, выходим
    // Note: freshGame.status is already checked to be "IN_PROGRESS" above, so we only check state.gameEnded
    if (state.gameEnded) {
      console.log("[BOT] Game finished, exiting");
      return;
    }

    // 2) Смотрим, что за тайл и какая фаза
    const landedTile = boardConfig.tiles[botPlayer.position];

    // Если фаза не ACTION (например END_TURN) — бот ничего не может решить.
    // В этом случае нужно просто завершить ход за него.
    const canConsiderBuying =
      state.phase === "ACTION" &&
      landedTile &&
      landedTile.type === "PROPERTY" &&
      !state.players.some(p => p.properties.includes(landedTile.id)) &&
      landedTile.price &&
      botPlayer.balance >= landedTile.price;

    if (!canConsiderBuying) {
      console.log("[BOT] Nothing to buy or wrong phase, auto END_TURN", {
        phase: state.phase,
        tileType: landedTile?.type,
        tileOwned: landedTile ? state.players.some(p => p.properties.includes(landedTile.id)) : false,
        balance: botPlayer.balance,
        tilePrice: landedTile?.price,
      });

      // Если фаза уже END_TURN, просто переключаем на следующего игрока
      if (state.phase === "END_TURN") {
        const { advanceToNextPlayer } = await import("@/server/gameEngine");
        state = advanceToNextPlayer(state);
      } else {
        // Если фаза ACTION, но нельзя купить — скипаем
        const skipAction: GameAction = { type: "SKIP_BUY" };
        const skipValidation = validateAction(state, skipAction, botPlayerId, boardConfig);
        if (skipValidation.valid) {
          state = applyAction(state, skipAction, boardConfig);
        } else {
          // Если скип не валиден, принудительно переключаем ход
          const { advanceToNextPlayer } = await import("@/server/gameEngine");
          state = advanceToNextPlayer(state);
        }
      }

      // Проверяем окончание игры
      const gameEnd = checkGameEnd(state, boardConfig);
      if (gameEnd.ended) {
        state.gameEnded = true;
        state.winnerId = gameEnd.winnerId;
        state.winnerNetWorth = gameEnd.winnerNetWorth;
      }

      // Сохраняем в БД
      await prisma.game.update({
        where: { id: gameId },
        data: {
          turnState: JSON.stringify(state),
          status: gameEnd.ended ? "FINISHED" : "IN_PROGRESS",
          ...(gameEnd.ended && gameEnd.winnerId ? {
            winnerId: gameEnd.winnerId,
            endedAt: new Date(),
          } : {}),
        },
      });

      // Отправляем state-update
      socketIOInstance.to(room).emit("state-update", {
        gameId,
        state,
        boardConfig,
        gameStatus: gameEnd.ended ? "FINISHED" : "IN_PROGRESS",
        gameFinished: gameEnd.ended,
      });

      console.log("[BOT] Turn passed to next player", {
        currentPlayerIndex: state.currentPlayerIndex,
        phase: state.phase,
        nextPlayerIsBot: isBotPlayer(state.players[state.currentPlayerIndex]?.id || ""),
      });

      // Если следующий игрок тоже бот, запускаем его ход
      if (!gameEnd.ended && state.phase === "ROLL") {
        const nextPlayer = state.players[state.currentPlayerIndex];
        if (nextPlayer && isBotPlayer(nextPlayer.id)) {
          console.log("[BOT] Next player is also a bot, will play automatically");
          setTimeout(() => playBotTurn(gameId, nextPlayer.id, state, boardConfig), 1000);
        }
      }

      return;
    }

    // 3) Бот принимает решение: купить или скипнуть
    const shouldBuy = Math.random() < 0.7; // 70% шанс купить

    const secondAction: GameAction = shouldBuy
      ? { type: "BUY_PROPERTY", tileId: landedTile.id }
      : { type: "SKIP_BUY" };

    console.log("[BOT] Decision", { shouldBuy, tileId: landedTile.id, tileName: landedTile.name });

    const secondValidation = validateAction(state, secondAction, botPlayerId, boardConfig);
    if (!secondValidation.valid) {
      console.error("[BOT] Cannot perform action", secondValidation.error);
      // Если действие невалидно, принудительно переключаем ход
      const { advanceToNextPlayer } = await import("@/server/gameEngine");
      state = advanceToNextPlayer(state);
    } else {
      state = applyAction(state, secondAction, boardConfig);
    }

    // Проверяем окончание игры
    const gameEnd = checkGameEnd(state, boardConfig);
    if (gameEnd.ended) {
      state.gameEnded = true;
      state.winnerId = gameEnd.winnerId;
      state.winnerNetWorth = gameEnd.winnerNetWorth;
    }

    // Сохраняем в БД
    await prisma.game.update({
      where: { id: gameId },
      data: {
        turnState: JSON.stringify(state),
        status: gameEnd.ended ? "FINISHED" : "IN_PROGRESS",
        ...(gameEnd.ended && gameEnd.winnerId ? {
          winnerId: gameEnd.winnerId,
          endedAt: new Date(),
        } : {}),
      },
    });

    // Отправляем state-update
    socketIOInstance.to(room).emit("state-update", {
      gameId,
      state,
      boardConfig,
      gameStatus: gameEnd.ended ? "FINISHED" : "IN_PROGRESS",
      gameFinished: gameEnd.ended,
    });

    console.log("[BOT] After BUY/SKIP", {
      phase: state.phase,
      currentPlayerIndex: state.currentPlayerIndex,
      nextPlayerIsBot: isBotPlayer(state.players[state.currentPlayerIndex]?.id || ""),
    });

    // 4) Если после BUY/SKIP фаза не перешла к другому игроку —
    // явно завершаем ход и переключаемся
    const finalBotPlayer = state.players[state.currentPlayerIndex];
    if (finalBotPlayer && isBotPlayer(finalBotPlayer.id) && state.phase !== "ROLL") {
      console.log("[BOT] Still bot turn after action, force END_TURN + next player", {
        phase: state.phase,
        currentPlayerIndex: state.currentPlayerIndex,
      });

      const { advanceToNextPlayer } = await import("@/server/gameEngine");
      state = advanceToNextPlayer(state);

      // Проверяем окончание игры
      const finalGameEnd = checkGameEnd(state, boardConfig);
      if (finalGameEnd.ended) {
        state.gameEnded = true;
        state.winnerId = finalGameEnd.winnerId;
        state.winnerNetWorth = finalGameEnd.winnerNetWorth;
      }

      // Сохраняем в БД
      await prisma.game.update({
        where: { id: gameId },
        data: {
          turnState: JSON.stringify(state),
          status: finalGameEnd.ended ? "FINISHED" : "IN_PROGRESS",
          ...(finalGameEnd.ended && finalGameEnd.winnerId ? {
            winnerId: finalGameEnd.winnerId,
            endedAt: new Date(),
          } : {}),
        },
      });

      // Отправляем state-update
      socketIOInstance.to(room).emit("state-update", {
        gameId,
        state,
        boardConfig,
        gameStatus: finalGameEnd.ended ? "FINISHED" : "IN_PROGRESS",
        gameFinished: finalGameEnd.ended,
      });

      console.log("[BOT] Final state after turn", {
        phase: state.phase,
        currentPlayerIndex: state.currentPlayerIndex,
      });
    }

    // Если следующий игрок тоже бот, запускаем его ход
    if (!state.gameEnded && state.phase === "ROLL") {
      const nextPlayer = state.players[state.currentPlayerIndex];
      if (nextPlayer && isBotPlayer(nextPlayer.id)) {
        console.log("[BOT] Next player is also a bot, will play automatically");
        setTimeout(() => playBotTurn(gameId, nextPlayer.id, state, boardConfig), 1000);
      }
    }
  } catch (error) {
    console.error("[BOT] Error in playBotTurn:", error);
    // В случае ошибки принудительно переключаем ход, чтобы игра не зависла
    try {
      const { advanceToNextPlayer } = await import("@/server/gameEngine");
      const errorState = await prisma.game.findUnique({
        where: { id: gameId },
      });
      if (errorState && errorState.turnState) {
        let state = JSON.parse(errorState.turnState) as GameState;
        const botPlayer = state.players[state.currentPlayerIndex];
        if (botPlayer && isBotPlayer(botPlayer.id)) {
          state = advanceToNextPlayer(state);
          await prisma.game.update({
            where: { id: gameId },
            data: { turnState: JSON.stringify(state) },
          });
          const socketIO = getIO();
          if (socketIO) {
            socketIO.to(`room:${gameId}`).emit("state-update", {
              gameId,
              state,
              boardConfig,
              gameStatus: "IN_PROGRESS",
            });
          }
        }
      }
    } catch (recoveryError) {
      console.error("[BOT] Error during recovery:", recoveryError);
    }
  }
}

export function getIO(): SocketIOServer | null {
  return io;
}

