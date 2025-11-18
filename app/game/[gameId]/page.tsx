"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { GameState, BoardConfig, GameAction, BoardTile } from "@/lib/types";
import { BuyInButton } from "@/components/BuyInButton";
import { BoardRing } from "@/components/game/BoardRing";
import { PlayersPanel } from "@/components/PlayersPanel";
import { GameModals } from "@/components/GameModals";
import { DiceDisplay } from "@/components/DiceAnimation";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [boardConfig, setBoardConfig] = useState<BoardConfig | null>(null);
  const [chatMessages, setChatMessages] = useState<
    Array<{ userId: string; message: string; timestamp: string }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [isRolling, setIsRolling] = useState(false); // New: prevent double-click
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [readyLoading, setReadyLoading] = useState(false);
  const actionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const actionInProgressRef = useRef(false); // New: race condition protection

  const { data: gameData, refetch } = useQuery({
    queryKey: ["game", gameId],
    queryFn: async () => {
      const res = await fetch(`/api/games/${gameId}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: authData } = useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Load game state from DB if game is already in progress or finished
  useEffect(() => {
    if (gameData?.game) {
      if (gameData.game.status === "IN_PROGRESS") {
        try {
          if (gameData.game.turnState) {
            const state = JSON.parse(gameData.game.turnState) as GameState;
            setGameState(state);
            console.log("Loaded game state from DB:", state);
          }
          if (gameData.game.boardConfig) {
            const board = JSON.parse(gameData.game.boardConfig) as BoardConfig;
            setBoardConfig(board);
            console.log("Loaded board config from DB:", board);
          }
        } catch (error) {
          console.error("Error parsing game state:", error);
          setErrorMessage(`Failed to load game state: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      } else if (gameData.game.status === "FINISHED") {
        // Load final game state for finished game
        try {
          if (gameData.game.turnState) {
            const state = JSON.parse(gameData.game.turnState) as GameState;
            setGameState(state);
            console.log("Loaded finished game state from DB:", state);
          }
          if (gameData.game.boardConfig) {
            const board = JSON.parse(gameData.game.boardConfig) as BoardConfig;
            setBoardConfig(board);
            console.log("Loaded board config from DB for finished game:", board);
          }
        } catch (error) {
          console.error("Error parsing finished game state:", error);
        }
      } else if (gameData.game.status === "WAITING") {
        // Clear state when game is waiting
        setGameState(null);
        setBoardConfig(null);
      }
    }
  }, [gameData]);

  useEffect(() => {
    if (!gameId) return;

    const newSocket = io(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000", {
      path: "/api/socket",
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected! Socket ID:", newSocket.id);
      console.log("Emitting join-room with gameId:", gameId);
      newSocket.emit("join-room", { gameId });
      console.log("✅ join-room event emitted");
    });

    newSocket.on("disconnect", (reason) => {
      console.warn("⚠️ Socket disconnected! Reason:", reason);
      setErrorMessage(`Socket disconnected: ${reason}. Please refresh the page.`);
    });

    newSocket.on("state-update", async (data: { 
      state: GameState; 
      boardConfig: BoardConfig; 
      gameStatus?: string;
      gameFinished?: boolean; // New: explicit flag from server
    }) => {
      console.log("=== RECEIVED state-update ===", {
        gameId: data.state ? "present" : "missing",
        gameStatus: data.gameStatus,
        gameFinished: data.gameFinished,
        stateGameEnded: data.state?.gameEnded,
        hasState: !!data.state,
        hasBoardConfig: !!data.boardConfig,
        currentPlayerIndex: data.state?.currentPlayerIndex,
        phase: data.state?.phase,
        turnNumber: data.state?.turnNumber,
        diceRoll: data.state?.diceRoll,
        socketId: newSocket.id,
        timestamp: new Date().toISOString(),
      });
      
      // CRITICAL: Always update state if provided, even if boardConfig is missing
      // This ensures UI updates even if boardConfig wasn't sent
      if (data.state) {
        console.log("Updating gameState:", {
          currentPlayerIndex: data.state.currentPlayerIndex,
          phase: data.state.phase,
          turnNumber: data.state.turnNumber,
          playersCount: data.state.players.length,
        });
        setGameState(data.state);
      }
      
      if (data.boardConfig) {
        console.log("Updating boardConfig:", {
          tilesCount: data.boardConfig.tiles.length,
        });
        setBoardConfig(data.boardConfig);
      }
      
      // Clear timeout if it exists
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current);
        actionTimeoutRef.current = null;
      }
      
      // Reset loading states
      setActionLoading(false);
      setIsRolling(false);
      actionInProgressRef.current = false;
      setErrorMessage(null); // Clear any error messages

      // CRITICAL: Check if game finished - this is SUCCESS, not error
      const isGameFinished = data.gameFinished === true || 
                            data.gameStatus === "FINISHED" || 
                            data.state?.gameEnded === true;
      
      if (isGameFinished) {
        console.log("✅ Game finished successfully! Updating UI to show finished screen...");
        // Only refetch once to get final game state with winner info from DB
        // This is the ONLY place we refetch after state-update (for finished games)
        try {
          await refetch();
        } catch (error) {
          console.error("Error refetching after game finished:", error);
        }
        // Don't show error - game finished is success!
        return;
      }

      // CRITICAL: Do NOT sync with backend after every state-update!
      // The state from socket is the source of truth for real-time updates.
      // Only load from DB on initial page load (in useEffect with gameData dependency).
      // Syncing here would overwrite live updates with potentially stale DB data.
    });

    newSocket.on("chat-message", (data: {
      userId: string;
      message: string;
      timestamp: string;
    }) => {
      setChatMessages((prev) => [...prev, data]);
    });

    newSocket.on("error", async (data: { message: string }) => {
      console.error("Socket error:", data);
      
      // Clear timeout if it exists
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current);
        actionTimeoutRef.current = null;
      }
      
      // Reset loading states
      setActionLoading(false);
      setIsRolling(false);
      actionInProgressRef.current = false;
      
      // CRITICAL: Check if error is "Game finished" or similar
      // If so, treat it as success - sync and show finished screen, NO ERROR MESSAGE
      const errorMsg = data.message.toLowerCase();
      const isGameFinishedError = errorMsg.includes("finished") || 
                                 errorMsg.includes("ended") || 
                                 (errorMsg.includes("not in progress") && errorMsg.includes("finished"));
      
      if (isGameFinishedError) {
        console.log("⚠️ Game finished (from error handler). Syncing with backend to show finished screen...");
        // Sync with backend to get actual game status
        try {
          await refetch();
          // Don't set error message - game finished is success!
          // The refetch will update gameData, which will trigger the finished screen render
        } catch (error) {
          console.error("Error refetching after game finished error:", error);
          // Even if refetch fails, don't show error to user
        }
      } else {
        // Only show error for actual errors (not game finished)
        setErrorMessage(data.message);
      }
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setErrorMessage("Connection error. Please refresh the page.");
      setActionLoading(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [gameId, refetch]);

  const handleAction = async (action: GameAction) => {
    console.log("=== handleAction CALLED ===");
    console.log("Action:", action);
    
    // CRITICAL: Double-click protection
    if (actionInProgressRef.current) {
      console.warn("⚠️ Action already in progress, ignoring duplicate request");
      return;
    }

    // CRITICAL: Check if game is finished BEFORE processing action
    if (gameData?.game?.status === "FINISHED") {
      console.log("⚠️ Game is already finished. Refetching to show finished screen...");
      // Don't show error - just sync and let the finished screen render
      try {
        await refetch();
      } catch (error) {
        console.error("Error refetching finished game:", error);
      }
      return;
    }

    // CRITICAL: Check if rolling is already in progress (for ROLL_DICE action)
    if (action.type === "ROLL_DICE" && isRolling) {
      console.warn("⚠️ Roll already in progress, ignoring duplicate request");
      return;
    }

    console.log("State check:", {
      hasSocket: !!socket,
      hasGameState: !!gameState,
      hasAuth: !!authData?.user,
      socketConnected: socket?.connected,
      socketId: socket?.id,
      gameStatus: gameData?.game?.status,
      isRolling,
      actionInProgress: actionInProgressRef.current,
    });

    if (!socket) {
      console.error("❌ Action blocked: No socket");
      setErrorMessage("Socket not connected. Please refresh the page.");
      return;
    }

    if (!socket.connected) {
      console.error("❌ Action blocked: Socket not connected");
      setErrorMessage("Socket not connected. Please refresh the page.");
      return;
    }

    if (!gameState) {
      console.error("❌ Action blocked: No game state");
      setErrorMessage("Game state not loaded. Please refresh the page.");
      return;
    }

    if (!authData?.user) {
      console.error("❌ Action blocked: Not authenticated");
      setErrorMessage("Not authenticated. Please log in.");
      return;
    }

    // Set loading states IMMEDIATELY to prevent double-click
    actionInProgressRef.current = true;
    if (action.type === "ROLL_DICE") {
      setIsRolling(true);
    }
    setActionLoading(true);
    setErrorMessage(null);

    console.log("✅ All checks passed, proceeding with action...");

    // CRITICAL: Check game status before sending action
    // This prevents "Game is not in progress" errors
    if (gameData?.game?.status !== "IN_PROGRESS") {
      console.warn("Game status check failed. Refreshing game data...", {
        currentStatus: gameData?.game?.status,
        gameId,
      });
      // Try to refresh game data
      const refreshed = await refetch();
      // Check again after refresh - use refreshed data
      const refreshedGame = refreshed.data?.game;
      if (refreshedGame?.status !== "IN_PROGRESS") {
        setErrorMessage(`Game is not in progress. Current status: ${refreshedGame?.status || "unknown"}. Please refresh the page.`);
        setActionLoading(false);
        setIsRolling(false);
        actionInProgressRef.current = false;
        return;
      }
      // If status is now IN_PROGRESS, continue with action
    }

    // Double-check: ensure we're not sending actions for inactive players
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.active) {
      setErrorMessage("Cannot perform action: player is inactive");
      setActionLoading(false);
      setIsRolling(false);
      actionInProgressRef.current = false;
      return;
    }

    console.log("Sending action:", { 
      gameId, 
      action, 
      playerId: currentPlayer.id,
      gameStatus: gameData?.game?.status,
      phase: gameState.phase
    });
    
    // Clear any existing timeout
    if (actionTimeoutRef.current) {
      clearTimeout(actionTimeoutRef.current);
    }
    
    const emitData = {
      gameId,
      action,
      playerId: currentPlayer.id,
    };

    console.log("=== EMITTING ACTION TO SOCKET ===");
    console.log("[SOCKET EMIT]", {
      event: "action",
      payload: emitData,
      socketId: socket.id,
      socketConnected: socket.connected,
      socketDisconnected: socket.disconnected,
    });

    if (!socket.connected) {
      console.error("❌ Cannot emit: Socket is not connected!");
      setErrorMessage("Socket is not connected. Please refresh the page.");
      setActionLoading(false);
      return;
    }

    try {
      socket.emit("action", emitData);
      console.log("✅ Action emitted successfully via socket.emit()");
      console.log("Waiting for server response (state-update or error)...");
    } catch (error) {
      console.error("❌ Error emitting action:", error);
      setErrorMessage(`Failed to send action: ${error instanceof Error ? error.message : "Unknown error"}`);
      setActionLoading(false);
      return;
    }

    // Safety timeout: reset loading after 10 seconds if no response
    actionTimeoutRef.current = setTimeout(() => {
      console.warn("⚠️ Action timeout - no response received");
      setActionLoading(false);
      setIsRolling(false);
      actionInProgressRef.current = false;
      setErrorMessage("Action timed out. Please try again.");
      actionTimeoutRef.current = null;
    }, 10000);
  };

  const handleSendChat = () => {
    if (!socket || !chatInput.trim()) return;
    socket.emit("chat-message", {
      gameId,
      message: chatInput,
      // userId is authenticated on server
    });
    setChatInput("");
  };

  const handleReady = async () => {
    setReadyLoading(true);
    try {
      const res = await fetch(`/api/games/${gameId}/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ready: true }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        setErrorMessage(error.error || "Failed to set ready status");
        return;
      }
      refetch();
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to set ready status");
    } finally {
      setReadyLoading(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    setErrorMessage(null);
    try {
      // Double-check game status before attempting to start
      await refetch();
      const currentGame = gameData?.game;
      if (currentGame && currentGame.status !== "WAITING") {
        setErrorMessage(`Game is already ${currentGame.status === "IN_PROGRESS" ? "in progress" : "finished"}`);
        setStarting(false);
        return;
      }

      const res = await fetch(`/api/games/${gameId}/start`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        const errorMsg = error.error || "Failed to start game";
        console.error("Start game error:", error);
        setErrorMessage(`${errorMsg}${error.details ? `\n\nDetails: ${error.details}` : ""}`);
        // Refetch to get updated game status
        await refetch();
        return;
      }
      const result = await res.json();
      console.log("Game started successfully:", result);
      // Refetch to get updated game state and status
      await refetch();
      // Force reload game state from DB
      const updatedGame = await fetch(`/api/games/${gameId}`, { credentials: "include" });
      if (updatedGame.ok) {
        const updatedData = await updatedGame.json();
        if (updatedData.game?.status === "IN_PROGRESS" && updatedData.game?.turnState) {
          try {
            const state = JSON.parse(updatedData.game.turnState) as GameState;
            const board = JSON.parse(updatedData.game.boardConfig) as BoardConfig;
            setGameState(state);
            setBoardConfig(board);
            console.log("Game state loaded after start:", state);
          } catch (error) {
            console.error("Error parsing game state after start:", error);
          }
        }
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to start game");
      // Refetch to get updated game status
      await refetch();
    } finally {
      setStarting(false);
    }
  };

  if (!gameData?.game) {
    return <div className="p-8 text-zinc-400">Loading...</div>;
  }

  const game = gameData.game;

  // CRITICAL: Show finished screen if game is finished
  if (game.status === "FINISHED") {
    const winner = game.players.find((p) => p.id === game.winnerId);
    const winnerUser = winner?.user;
    const isWinner = winner?.userId === authData?.user?.id;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-950 p-8">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-zinc-900/40 backdrop-blur-xl border-2 border-emerald-400/50 rounded-xl shadow-2xl p-8 text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent mb-4">
              Game Finished!
            </h1>
            
            {winner && (
              <div className="mb-6">
                <div className={`inline-block px-6 py-3 rounded-xl mb-4 ${
                  isWinner 
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-black" 
                    : "bg-zinc-800 text-zinc-300"
                }`}>
                  <p className="text-lg font-semibold">
                    {isWinner ? "🎉 You Won!" : "Winner"}
                  </p>
                  <p className="text-sm mt-1">
                    {winnerUser?.username || winnerUser?.walletAddress.slice(0, 8) || "Unknown"}
                  </p>
                </div>
              </div>
            )}

            {gameState?.gameEnded && gameState.winnerNetWorth !== undefined && (
              <div className="mb-6">
                <p className="text-zinc-400 mb-2">Final Net Worth</p>
                <p className="text-3xl font-bold text-emerald-400">
                  ${gameState.winnerNetWorth.toLocaleString()}
                </p>
              </div>
            )}

            <div className="mt-8 space-y-4">
              <button
                onClick={() => router.push("/lobby")}
                className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-emerald-400 text-black rounded-lg font-semibold hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-indigo-500/20"
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Display error message if any
  if (errorMessage) {
    // Show error banner
  }
  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  const isCurrentPlayer = gameState && authData?.user
    ? currentPlayer?.userId === authData.user.id
    : false;

  // Debug logging
  console.log("GamePage render state:", {
    gameStatus: game?.status,
    hasGameState: !!gameState,
    hasBoardConfig: !!boardConfig,
    isCurrentPlayer,
    currentPlayerId: authData?.user?.id,
    currentPlayerUserId: currentPlayer?.userId,
    phase: gameState?.phase,
    diceRoll: gameState?.diceRoll,
    socketConnected: socket?.connected,
    socketId: socket?.id,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-950 p-8">
      <div className="container mx-auto">
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-400/50 text-red-400 rounded-lg">
            <p className="font-semibold">Error:</p>
            <p>{errorMessage}</p>
            <button
              onClick={() => setErrorMessage(null)}
              className="mt-2 text-sm underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {/* Header */}
        <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">
                Room {game.code}
              </h1>
              <div className="flex items-center gap-3">
                <p className="text-zinc-400">
                  {game.type === "FREE" ? "Free Game" : `${game.buyInSol} SOL Buy-in`}
                </p>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  game.status === "WAITING" 
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    : game.status === "IN_PROGRESS"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30"
                }`}>
                  {game.status === "WAITING" ? "Waiting" : game.status === "IN_PROGRESS" ? "In Progress" : "Finished"}
                </span>
              </div>
            </div>
            <div className="flex gap-4">
              {game.status === "WAITING" && (
                <>
                  <button
                    onClick={handleReady}
                    disabled={readyLoading}
                    className="px-6 py-2 bg-emerald-500 text-black rounded-lg font-semibold hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {readyLoading ? "Processing..." : "Ready"}
                  </button>
                  {game.players.find((p) => p.isHost)?.userId === authData?.user?.id && (
                    <button
                      onClick={handleStart}
                      disabled={starting}
                      className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-emerald-400 text-black rounded-lg font-semibold hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {starting ? "Starting..." : "Start Game"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Three-column layout: Players | Board | Chat+Log+Actions */}
        {/* Desktop: [minmax(260px,280px)_minmax(480px,1fr)_minmax(260px,300px)] */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,280px)_minmax(480px,1fr)_minmax(260px,300px)] gap-4">
          {/* Left Column: Players */}
          <div>
            {game.status === "IN_PROGRESS" && gameState ? (
              <PlayersPanel
                gameState={gameState}
                currentUserId={authData?.user?.id || ""}
                gamePlayers={game.players}
              />
            ) : (
              <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4 text-zinc-100">Players</h2>
                <div className="space-y-3">
                  {game.players.map((player: {
                    id: string;
                    userId: string;
                    user: { walletAddress: string; username: string | null };
                    isReady: boolean;
                    isHost: boolean;
                    hasPaidBuyIn: boolean;
                  }) => {
                    const isCurrentUser = player.userId === authData?.user?.id;
                    const needsBuyIn = game.type === "PAID" && !player.hasPaidBuyIn && isCurrentUser;
                    
                    return (
                      <div
                        key={player.id}
                        className="flex flex-col gap-2 p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-zinc-100">
                              {player.user.username || player.user.walletAddress.slice(0, 8)}
                              {player.isHost && " (Host)"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {player.isReady && (
                              <span className="text-emerald-400 text-xs">Ready</span>
                            )}
                            {game.type === "PAID" && player.hasPaidBuyIn && (
                              <span className="text-xs text-emerald-400">Paid</span>
                            )}
                          </div>
                        </div>
                        {needsBuyIn && (
                          <BuyInButton
                            gameId={gameId}
                            buyInSol={game.buyInSol || 0}
                            onSuccess={() => refetch()}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Center Column: Board + Dice + Modals */}
          <div>
            <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-lg p-6">
              {game.status === "IN_PROGRESS" && gameState && boardConfig ? (
                <div className="relative">
                  {/* Ring Board */}
                  <BoardRing
                    boardConfig={boardConfig}
                    gameState={gameState}
                    currentPlayerId={authData?.user?.id || ""}
                  />

                  {/* Center overlay for dice and modals - positioned over center of ring board */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className="pointer-events-auto">
                      {/* Dice Display */}
                      {(gameState.diceRoll || (actionLoading && gameState.phase === "ROLL")) && (
                        <DiceDisplay
                          diceRoll={gameState.diceRoll || null}
                          isRolling={actionLoading && gameState.phase === "ROLL"}
                        />
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-zinc-400">Waiting for game to start...</p>
                </div>
              )}
            </div>
          </div>

          {/* Game Modals - rendered outside board container to avoid z-index/positioning issues */}
          {game.status === "IN_PROGRESS" && gameState && boardConfig && (
            <GameModals
              gameState={gameState}
              boardConfig={boardConfig}
              isCurrentPlayer={isCurrentPlayer}
              actionLoading={actionLoading}
              isRolling={isRolling}
              gameStatus={game.status}
              onAction={handleAction}
            />
          )}

          {/* Right Column: Chat + Log + Actions */}
          <div className="space-y-4">
            {/* Chat */}
            <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-lg p-4 flex flex-col h-64">
              <h2 className="text-lg font-bold mb-3 text-zinc-100">Chat</h2>
              <div className="flex-1 overflow-y-auto mb-3 space-y-2 text-sm">
                {chatMessages.map((msg, idx) => {
                  const player = game.players.find((p) => p.userId === msg.userId);
                  const displayName = player?.user?.username || player?.user?.walletAddress?.slice(0, 8) || msg.userId;
                  return (
                    <div key={idx}>
                      <span className="font-semibold text-emerald-400">{displayName}:</span>{" "}
                      <span className="text-zinc-300">{msg.message}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendChat()}
                  className="flex-1 px-3 py-2 text-sm border border-zinc-700 bg-zinc-900/60 text-zinc-100 rounded-lg focus:outline-none focus:border-emerald-400/50"
                  placeholder="Type a message..."
                />
                <button
                  onClick={handleSendChat}
                  className="px-3 py-2 bg-gradient-to-r from-indigo-500 to-emerald-400 text-black rounded-lg font-semibold hover:scale-105 active:scale-95 transition-transform text-sm"
                >
                  Send
                </button>
              </div>
            </div>

            {/* Action Log */}
            {gameState && (
              <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-lg p-4 flex flex-col h-48">
                <h2 className="text-lg font-bold mb-3 text-zinc-100">Game Log</h2>
                <div className="flex-1 overflow-y-auto space-y-1 text-xs text-zinc-400">
                  {gameState.lastAction && (
                    <div className="p-2 bg-zinc-900/60 rounded">
                      {gameState.lastAction}
                    </div>
                  )}
                  <div className="text-zinc-500">
                    Turn {gameState.turnNumber}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            {gameState && isCurrentPlayer && gameState.phase === "ACTION" && (
              <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-lg p-4">
                <h2 className="text-lg font-bold mb-3 text-zinc-100">Actions</h2>
                <div className="space-y-2">
                  <button
                    onClick={() => handleAction({ type: "END_TURN" })}
                    disabled={actionLoading}
                    className="w-full px-4 py-2 bg-zinc-700 text-zinc-100 rounded-lg font-semibold hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    End Turn
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GameBoard({
  gameState,
  boardConfig,
  onAction,
  isCurrentPlayer,
  actionLoading,
}: {
  gameState: GameState;
  boardConfig: BoardConfig;
  onAction: (action: GameAction) => void;
  isCurrentPlayer: boolean;
  actionLoading: boolean;
}) {
  return (
    <div>
      <div className="mb-6 p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg">
            <p className="text-lg font-semibold text-zinc-100">
              Current Player: {gameState.players[gameState.currentPlayerIndex].userId}
            </p>
            {gameState.lastAction && (
              <p className="text-zinc-400 mt-2">{gameState.lastAction}</p>
            )}
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-4 gap-4">
          {boardConfig.tiles.map((tile) => {
            const currentPlayerPos = gameState.players[gameState.currentPlayerIndex].position;
            const hasPlayer = tile.position === currentPlayerPos;
            
            return (
              <div key={tile.id} className="relative">
                <Tile tile={tile} />
                {hasPlayer && (
                  <div className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-400 rounded-full border-2 border-zinc-900 shadow-lg shadow-emerald-400/50"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isCurrentPlayer && gameState.phase === "ROLL" && (
        <button
          onClick={() => onAction({ type: "ROLL_DICE" })}
          disabled={actionLoading}
              className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-emerald-400 text-black rounded-lg font-semibold hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {actionLoading ? "Processing..." : "Roll Dice"}
        </button>
      )}

      {isCurrentPlayer && gameState.phase === "ACTION" && (
        <div className="flex gap-4 flex-wrap">
          {(() => {
            const currentTile = boardConfig.tiles[gameState.players[gameState.currentPlayerIndex].position];
            const canBuy = currentTile?.type === "PROPERTY" &&
              !gameState.players.some(p => p.properties.includes(currentTile.id)) &&
              currentTile.price &&
              gameState.players[gameState.currentPlayerIndex].balance >= currentTile.price;

            return (
              <>
                {canBuy && (
                  <button
                    onClick={() => onAction({ type: "BUY_PROPERTY", tileId: currentTile.id })}
                    disabled={actionLoading}
                        className="px-6 py-3 bg-emerald-500 text-black rounded-lg font-semibold hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? "Processing..." : `Buy ${currentTile.name} ($${currentTile.price})`}
                  </button>
                )}
                {currentTile?.type === "CHANCE" && !gameState.currentCard && (
                  <button
                    onClick={() => onAction({ type: "DRAW_CARD" })}
                    disabled={actionLoading}
                        className="px-6 py-3 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-400 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? "Processing..." : "Draw Card"}
                  </button>
                )}
                {gameState.currentCard && (
                  <button
                    onClick={() => onAction({ type: "RESOLVE_CARD" })}
                    disabled={actionLoading}
                        className="px-6 py-3 bg-yellow-500 text-black rounded-lg font-semibold hover:bg-yellow-400 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? "Processing..." : "Resolve Card"}
                  </button>
                )}
                <button
                  onClick={() => onAction({ type: "END_TURN" })}
                  disabled={actionLoading}
                        className="px-6 py-3 bg-zinc-700 text-zinc-100 rounded-lg font-semibold hover:bg-zinc-600 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? "Processing..." : "End Turn"}
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function Tile({ tile }: { tile: BoardTile }) {
  return (
        <div className="bg-zinc-900/60 border-2 border-zinc-800 rounded-lg p-4 text-center hover:border-emerald-400/50 hover:scale-105 transition-all">
          <p className="font-semibold text-sm text-zinc-100">{tile.name}</p>
          {tile.price && <p className="text-xs text-zinc-400">${tile.price}</p>}
          {tile.rent && <p className="text-xs text-zinc-500">Rent: ${tile.rent}</p>}
        </div>
  );
}

