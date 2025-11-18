"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CreateGameModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateGameModal({ onClose, onSuccess }: CreateGameModalProps) {
  const router = useRouter();
  const [gameType, setGameType] = useState<"FREE" | "PAID">("FREE");
  const [buyInSol, setBuyInSol] = useState<0.1 | 0.25 | 1>(0.1);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [isPrivate, setIsPrivate] = useState(false);
  const [useCustomItems, setUseCustomItems] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: gameType,
          buyInSol: gameType === "PAID" ? buyInSol : undefined,
          maxPlayers,
          isPrivate,
          customItemIds: useCustomItems ? [] : undefined,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Failed to create game");
        return;
      }

      const { game } = await res.json();
      onSuccess();
      router.push(`/game/${game.id}`);
    } catch (error) {
      console.error("Error creating game:", error);
      alert("Failed to create game");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">Create Game</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Game Type */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-zinc-300">
              Game Type
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setGameType("FREE")}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition ${
                  gameType === "FREE"
                    ? "bg-green-600 text-white"
                    : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                }`}
              >
                Free game
              </button>
              <button
                type="button"
                onClick={() => setGameType("PAID")}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition ${
                  gameType === "PAID"
                    ? "bg-yellow-600 text-white"
                    : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                }`}
              >
                Game with SOL buy-in
              </button>
            </div>
          </div>

          {/* Buy-in Amount */}
          {gameType === "PAID" && (
            <div>
              <label className="block text-sm font-semibold mb-2 text-zinc-300">
                Buy-in Amount
              </label>
              <div className="flex gap-2">
                {[0.1, 0.25, 1].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setBuyInSol(amount as 0.1 | 0.25 | 1)}
                    className={`flex-1 px-4 py-2 rounded-lg font-semibold transition ${
                      buyInSol === amount
                        ? "bg-purple-600 text-white"
                        : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                    }`}
                  >
                    {amount} SOL
                  </button>
                ))}
              </div>
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-400/30 rounded-lg">
                <p className="text-sm text-yellow-400">
                  Each player pays {buyInSol} SOL to join. Winner takes the pot,
                  the platform takes a 10% fee.
                </p>
              </div>
            </div>
          )}

          {/* Max Players */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-zinc-300">
              Max Players: {maxPlayers}
            </label>
            <input
              type="range"
              min="1"
              max="6"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-zinc-300">Private room</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useCustomItems}
                onChange={(e) => setUseCustomItems(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-zinc-300">
                Use my custom tiles and cards
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-zinc-800 text-zinc-300 rounded-lg font-semibold hover:bg-zinc-700 border border-zinc-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-emerald-400 text-black rounded-lg font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

