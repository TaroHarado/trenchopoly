"use client";

import { GameState } from "@/lib/types";
import { isBotWalletAddress } from "@/lib/botUtils";

interface PlayersPanelProps {
  gameState: GameState;
  currentUserId: string;
  gamePlayers: Array<{
    id: string;
    userId: string;
    user: { walletAddress: string; username: string | null } | null;
    isHost: boolean;
  }>;
}

export function PlayersPanel({ gameState, currentUserId, gamePlayers }: PlayersPanelProps) {
  const colors = [
    "bg-blue-500",
    "bg-red-500",
    "bg-green-500",
    "bg-yellow-500",
    "bg-purple-500",
    "bg-pink-500",
  ];

  const getPlayerColor = (index: number) => colors[index % colors.length];

  const getPlayerInitials = (username: string | null, walletAddress: string | null) => {
    if (walletAddress && isBotWalletAddress(walletAddress)) {
      return "🤖";
    }
    if (username) {
      return username.slice(0, 2).toUpperCase();
    }
    if (walletAddress) {
      return walletAddress.slice(0, 2).toUpperCase();
    }
    return "??";
  };

  const getPlayerDisplayName = (gamePlayer: typeof gamePlayers[0] | undefined) => {
    if (gamePlayer?.user && isBotWalletAddress(gamePlayer.user.walletAddress)) {
      return "Bot";
    }
    if (gamePlayer?.user) {
      return gamePlayer.user.username || gamePlayer.user.walletAddress.slice(0, 8);
    }
    return "Unknown";
  };

  return (
    <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-lg p-4">
      <h2 className="text-xl font-bold mb-4 text-zinc-100">Players</h2>
      <div className="space-y-3">
        {gameState.players.map((player, index) => {
          const gamePlayer = gamePlayers.find(gp => gp.userId === player.userId);
          const isCurrentTurn = gameState.currentPlayerIndex === index;
          const isCurrentUser = player.userId === currentUserId;
          const isActive = player.active;
          const isBot = gamePlayer?.user ? isBotWalletAddress(gamePlayer.user.walletAddress) : false;

          return (
            <div
              key={player.id}
              className={`
                p-4 rounded-lg border-2 transition-all
                ${isCurrentTurn 
                  ? "border-emerald-400 bg-emerald-500/10 shadow-lg shadow-emerald-400/20"
                  : "border-zinc-800 bg-zinc-900/60"
                }
                ${!isActive ? "opacity-50" : ""}
              `}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className={`
                  w-12 h-12 rounded-full ${getPlayerColor(index)}
                  flex items-center justify-center text-white font-bold text-lg
                  flex-shrink-0
                `}>
                  {getPlayerInitials(
                    gamePlayer?.user?.username || null, 
                    gamePlayer?.user?.walletAddress || null
                  )}
                </div>

                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-zinc-100 truncate">
                      {getPlayerDisplayName(gamePlayer)}
                    </p>
                    {gamePlayer?.isHost && (
                      <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs rounded-full border border-indigo-500/30">
                        HOST
                      </span>
                    )}
                    {isCurrentTurn && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full border border-emerald-500/30 animate-pulse">
                        TURN
                      </span>
                    )}
                    {!isActive && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/30">
                        BANKRUPT
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-emerald-400">
                      ${player.balance.toLocaleString()}
                    </span>
                    {player.properties.length > 0 && (
                      <span className="text-xs text-zinc-400">
                        {player.properties.length} properties
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

