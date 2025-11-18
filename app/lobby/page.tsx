"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { CreateGameModal } from "@/components/CreateGameModal";
import { GameType, GameStatus } from "@/lib/types";

interface GamePlayer {
  id: string;
  user: {
    walletAddress: string;
    username: string | null;
  };
}

interface GameCreator {
  walletAddress: string;
  username: string | null;
}

interface Game {
  id: string;
  code: string;
  type: GameType;
  buyInSol: number | null;
  maxPlayers: number;
  status: GameStatus;
  creator: GameCreator;
  players: GamePlayer[];
}

export default function LobbyPage() {
  const [activeTab, setActiveTab] = useState<"free" | "paid">("free");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, refetch } = useQuery<{ games: Game[] }>({
    queryKey: ["games", activeTab],
    queryFn: async () => {
      const type = activeTab === "free" ? "FREE" : "PAID";
      const res = await fetch(`/api/games?type=${type}&status=WAITING`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 5000,
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-medium text-black">
            Game Lobby
          </h1>
          <WalletButton />
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Tabs */}
          <div className="flex gap-1 mb-8 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("free")}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === "free"
                  ? "text-black border-b-2 border-black"
                  : "text-gray-500 hover:text-black"
              }`}
            >
              Free games
            </button>
            <button
              onClick={() => setActiveTab("paid")}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === "paid"
                  ? "text-black border-b-2 border-black"
                  : "text-gray-500 hover:text-black"
              }`}
            >
              Games with SOL buy-ins
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Games List */}
            <div className="lg:col-span-2 space-y-4">
              {data?.games?.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
              {(!data?.games || data.games.length === 0) && (
                <div className="text-center py-16 text-gray-500">
                  <p className="text-lg">No games available. Create one to get started!</p>
                </div>
              )}
            </div>

            {/* Create Game Card */}
            <div className="lg:col-span-1">
              <div className="card p-8">
                <h2 className="text-2xl font-medium mb-4 text-black">
                  Create Game
                </h2>
                <p className="text-gray-600 mb-6">
                  Start a new game room and invite friends to play.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary w-full"
                >
                  Create Room
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateGameModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function GameCard({ game }: { game: Game }) {
  const playerCount = game.players.length;
  const isFull = playerCount >= game.maxPlayers;

  return (
    <div className="card p-6">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-xl font-medium text-black">
              Room {game.code}
            </h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              game.type === "FREE" 
                ? "bg-gray-100 text-gray-700" 
                : "bg-black text-white"
            }`}>
              {game.type === "FREE" ? "FREE" : `${game.buyInSol} SOL`}
            </span>
          </div>
          <p className="text-gray-600 mb-2">
            Host: {game.creator.username || game.creator.walletAddress.slice(0, 8)}
          </p>
          <p className="text-sm text-gray-500">
            Players: {playerCount}/{game.maxPlayers}
          </p>
        </div>
        <Link
          href={`/game/${game.id}`}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            isFull
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "btn-primary"
          }`}
        >
          {isFull ? "Full" : "Join"}
        </Link>
      </div>
    </div>
  );
}
