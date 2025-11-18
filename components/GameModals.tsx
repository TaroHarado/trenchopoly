"use client";

import { useState, useEffect } from "react";
import { GameState, BoardConfig, BoardTile, GameAction } from "@/lib/types";
import { DiceDisplay } from "@/components/DiceAnimation";

interface GameModalsProps {
  gameState: GameState;
  boardConfig: BoardConfig;
  isCurrentPlayer: boolean;
  actionLoading: boolean;
  isRolling?: boolean; // New: specific rolling state
  gameStatus: string; // "WAITING" | "IN_PROGRESS" | "FINISHED"
  onAction: (action: GameAction) => void;
  onClose?: () => void;
}

export function GameModals({
  gameState,
  boardConfig,
  isCurrentPlayer,
  actionLoading,
  isRolling = false,
  gameStatus,
  onAction,
}: GameModalsProps) {
  // Local state to control when to show decision modal after dice animation
  const [showDecision, setShowDecision] = useState(false);

  console.log("GameModals render:", {
    gameStatus,
    isCurrentPlayer,
    phase: gameState?.phase,
    diceRoll: gameState?.diceRoll,
    hasOnAction: typeof onAction === "function",
    showDecision,
  });

  // Effect to handle delayed showing of decision modal after dice roll
  useEffect(() => {
    if (!isCurrentPlayer) {
      setShowDecision(false);
      return;
    }

    // When state-update arrives after ROLL_DICE with phase === 'ACTION' and diceRoll exists
    if (gameState.phase === "ACTION" && gameState.diceRoll && gameState.diceRoll.length === 2) {
      setShowDecision(false);
      const timer = setTimeout(() => {
        setShowDecision(true);
      }, 900); // Delay to show dice animation first (900ms matches dice animation duration)

      return () => clearTimeout(timer);
    } else {
      // In any other phase, don't show decision modal
      setShowDecision(false);
    }
  }, [gameState.phase, gameState.diceRoll, isCurrentPlayer]);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const currentTile = boardConfig.tiles[currentPlayer.position];
  const canBuy = currentTile?.type === "PROPERTY" &&
    !gameState.players.some(p => p.properties.includes(currentTile.id)) &&
    currentTile.price &&
    currentPlayer.balance >= currentTile.price;

  // Only show modals if game is in progress
  if (gameStatus !== "IN_PROGRESS") {
    console.log("GameModals: Game not in progress, returning null");
    return null;
  }

  // Modal 1: Your Turn (ROLL phase)
  if (isCurrentPlayer && gameState.phase === "ROLL" && !gameState.diceRoll) {
    console.log("Rendering Your Turn modal", {
      isCurrentPlayer,
      phase: gameState.phase,
      diceRoll: gameState.diceRoll,
      gameStatus,
      actionLoading,
    });

    return (
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100]"
        onClick={(e) => {
          console.log("Backdrop clicked");
          // Prevent closing on backdrop click
          e.stopPropagation();
        }}
        style={{ pointerEvents: "auto" }}
      >
        <div 
          className="bg-zinc-900 border-2 border-emerald-400 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl"
          onClick={(e) => {
            console.log("Modal content clicked");
            e.stopPropagation();
          }}
          style={{ pointerEvents: "auto" }}
        >
          <div className="text-center">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent mb-2">
              Your Turn!
            </h2>
            <p className="text-zinc-400 mb-6">We're rooting for you 🧪</p>
            <button
              type="button"
              onClick={(e) => {
                console.log("=== ROLL DICE BUTTON CLICKED ===");
                e.preventDefault();
                e.stopPropagation();
                
                const debugInfo = {
                  gameStatus,
                  actionLoading,
                  phase: gameState.phase,
                  diceRoll: gameState.diceRoll,
                  onActionType: typeof onAction,
                  isFunction: typeof onAction === "function",
                  buttonDisabled: actionLoading || gameStatus !== "IN_PROGRESS",
                };
                console.log("Button click debug:", debugInfo);
                
                // Check if button should be disabled
                if (actionLoading || isRolling) {
                  console.warn("Button is disabled: actionLoading or isRolling is true");
                  return;
                }
                
                if (gameStatus !== "IN_PROGRESS") {
                  console.warn("Button is disabled: gameStatus is not IN_PROGRESS:", gameStatus);
                  return;
                }
                
                // Check if onAction is a function
                if (typeof onAction !== "function") {
                  console.error("ERROR: onAction is not a function!", { onAction });
                  alert("Error: onAction is not a function. Check console.");
                  return;
                }
                
                // Call onAction
                console.log("Calling onAction with ROLL_DICE action...");
                try {
                  const action = { type: "ROLL_DICE" as const };
                  console.log("Action object:", action);
                  onAction(action);
                  console.log("✅ onAction called successfully");
                } catch (error) {
                  console.error("❌ Error calling onAction:", error);
                  alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
                }
              }}
              disabled={actionLoading || isRolling || gameStatus !== "IN_PROGRESS"}
              className="w-full px-8 py-4 bg-gradient-to-r from-indigo-500 to-emerald-400 text-black rounded-lg font-semibold hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-lg cursor-pointer"
              style={{ pointerEvents: "auto" }}
            >
              {(actionLoading || isRolling) ? "Rolling..." : "Roll the Dice"}
            </button>
            {gameStatus !== "IN_PROGRESS" && (
              <p className="text-sm text-red-400 mt-2">Game is not in progress</p>
            )}
            <div className="mt-4 text-xs text-zinc-500">
              Debug: Status={gameStatus}, Loading={actionLoading ? "Yes" : "No"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Modal 2: ACTION phase - show dice animation first, then decision modal
  if (isCurrentPlayer && gameState.phase === "ACTION" && gameState.diceRoll && gameState.diceRoll.length === 2) {
    // First: Show only dice animation (before showDecision is true)
    if (!showDecision) {
      return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border-2 border-emerald-400 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              <DiceDisplay diceRoll={gameState.diceRoll} isRolling={false} />
            </div>
          </div>
        </div>
      );
    }

    // Second: Show decision modal (after delay) - only if can buy
    if (canBuy && currentTile) {
      return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border-2 border-emerald-400 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-zinc-100 mb-2">Buy it?</h2>
              <p className="text-zinc-400 mb-4">
                {currentTile.name}
              </p>
              {/* Compact dice display */}
              <div className="mb-4 flex justify-center">
                <DiceDisplay diceRoll={gameState.diceRoll} isRolling={false} />
              </div>
              <p className="text-sm text-zinc-500 mb-6">
                If you skip, this property will go to auction later.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => onAction({ type: "BUY_PROPERTY", tileId: currentTile.id })}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-black rounded-lg font-semibold hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? "Processing..." : `Buy for $${currentTile.price}`}
                </button>
                <button
                  onClick={() => onAction({ type: "SKIP_BUY" })}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 bg-zinc-800 text-zinc-300 rounded-lg font-semibold hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // If can't buy (already owned, insufficient funds, etc.), show just dice result
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-zinc-900 border-2 border-emerald-400 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
          <div className="text-center">
            <DiceDisplay diceRoll={gameState.diceRoll} isRolling={false} />
            <p className="text-zinc-400 mt-4">
              {currentTile?.name || "Landed on a tile"}
            </p>
            <button
              onClick={() => onAction({ type: "SKIP_BUY" })}
              disabled={actionLoading}
              className="mt-4 px-6 py-3 bg-zinc-800 text-zinc-300 rounded-lg font-semibold hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Modal 3: Casino/Jackpot (if implemented)
  // This would show when landing on casino/jackpot tiles
  // For now, we'll handle it via the action phase

  return null;
}

