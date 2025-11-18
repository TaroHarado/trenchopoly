"use client";

import { GameState, BoardConfig, BoardTile } from "@/lib/types";

interface RingBoardProps {
  gameState: GameState;
  boardConfig: BoardConfig;
  currentPlayerId: string;
  onTileClick?: (tile: BoardTile) => void;
}

// Color mapping for property groups
const colorMap: Record<string, string> = {
  brown: "bg-amber-900",
  "light-blue": "bg-cyan-500",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
  red: "bg-red-600",
  yellow: "bg-yellow-400",
  green: "bg-green-600",
  "dark-blue": "bg-blue-800",
  railroad: "bg-gray-700",
  utility: "bg-gray-500",
};

export function RingBoard({ gameState, boardConfig, currentPlayerId, onTileClick }: RingBoardProps) {
  const tiles = boardConfig.tiles;
  const totalTiles = tiles.length;
  
  // Get current player position
  const currentPlayer = gameState.players.find(p => p.userId === currentPlayerId);
  const currentPosition = currentPlayer?.position ?? 0;

  // Arrange tiles in a ring (Monopoly-style):
  // Bottom row: positions 0-10 (left to right) - 11 tiles
  // Right column: positions 11-19 (bottom to top) - 9 tiles  
  // Top row: positions 20-30 (right to left) - 11 tiles
  // Left column: positions 31-39 (top to bottom) - 9 tiles
  // Total: 40 tiles
  
  const getTileColor = (tile: BoardTile): string => {
    if (tile.type === "PROPERTY" && tile.colorGroup) {
      return colorMap[tile.colorGroup] || "bg-zinc-700";
    }
    if (tile.type === "START") return "bg-emerald-500";
    if (tile.type === "JAIL") return "bg-red-800";
    if (tile.type === "GO_TO_JAIL") return "bg-red-900";
    if (tile.type === "FREE_PARKING") return "bg-green-500";
    if (tile.type === "TAX") return "bg-yellow-600";
    if (tile.type === "CHANCE") return "bg-purple-500";
    return "bg-zinc-700";
  };

  const getTileIcon = (tile: BoardTile): string => {
    if (tile.type === "START") return "🚀";
    if (tile.type === "JAIL") return "🔒";
    if (tile.type === "GO_TO_JAIL") return "⚡";
    if (tile.type === "FREE_PARKING") return "🅿️";
    if (tile.type === "TAX") return "💰";
    if (tile.type === "CHANCE") return "🎲";
    if (tile.type === "PROPERTY") return "🏠";
    return "📍";
  };

  // Helper to get tile by position
  const getTileByPosition = (pos: number) => tiles.find(t => t.position === pos);

  // Check if tile has any players
  const getPlayersOnTile = (tilePos: number) => {
    return gameState.players.filter(p => p.position === tilePos && p.active);
  };

  // Render a single tile
  const renderTile = (tile: BoardTile, orientation: "horizontal" | "vertical", isCorner = false) => {
    const isCurrentPosition = tile.position === currentPosition;
    const playersOnTile = getPlayersOnTile(tile.position);
    const isOwned = gameState.players.some(p => p.properties.includes(tile.id));
    const owner = gameState.players.find(p => p.properties.includes(tile.id));

    return (
      <div
        key={tile.id}
        onClick={() => onTileClick?.(tile)}
        className={`
          relative ${getTileColor(tile)} border-2 rounded transition-all
          ${isCurrentPosition ? "border-emerald-400 shadow-lg shadow-emerald-400/50 scale-105" : "border-zinc-800"}
          ${isCorner ? "w-24 h-24" : orientation === "horizontal" ? "w-20 h-16" : "w-16 h-20"}
          hover:scale-110 cursor-pointer
        `}
      >
        {/* Tile content */}
        <div className={`p-1 h-full flex flex-col items-center justify-center text-center ${orientation === "horizontal" ? "flex-row" : "flex-col"}`}>
          <div className="text-lg">{getTileIcon(tile)}</div>
          <div className="text-[10px] font-semibold text-zinc-100 truncate w-full px-1">
            {tile.name}
          </div>
          {tile.type === "PROPERTY" && tile.price && (
            <div className="text-[8px] text-zinc-200">${tile.price}</div>
          )}
        </div>

        {/* Player tokens */}
        {playersOnTile.length > 0 && (
          <div className="absolute -top-1 -right-1 flex gap-0.5">
            {playersOnTile.map((player, idx) => {
              const playerIndex = gameState.players.findIndex(p => p.id === player.id);
              const colors = ["bg-blue-500", "bg-red-500", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500"];
              return (
                <div
                  key={player.id}
                  className={`w-3 h-3 rounded-full border border-zinc-900 ${colors[playerIndex % colors.length]}`}
                  title={player.userId}
                />
              );
            })}
          </div>
        )}

        {/* Ownership indicator */}
        {isOwned && owner && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-900/60" />
        )}
      </div>
    );
  };

  // Get tiles for each side, sorted by position
  const bottomRow = tiles.filter(t => t.position >= 0 && t.position <= 10).sort((a, b) => a.position - b.position);
  const rightCol = tiles.filter(t => t.position >= 11 && t.position <= 19).sort((a, b) => b.position - a.position); // Bottom to top
  const topRow = tiles.filter(t => t.position >= 20 && t.position <= 30).sort((a, b) => b.position - a.position); // Right to left
  const leftCol = tiles.filter(t => t.position >= 31 && t.position <= 39).sort((a, b) => a.position - b.position); // Top to bottom

  return (
    <div className="relative w-full">
      {/* Ring board container - square layout */}
      <div className="relative bg-zinc-900/60 border-4 border-zinc-800 rounded-lg p-2">
        {/* Top row */}
        <div className="flex justify-between mb-1">
          {topRow.map((tile) => (
            <div key={tile.id}>
              {renderTile(tile, "horizontal", tile.position === 20 || tile.position === 30)}
            </div>
          ))}
        </div>

        {/* Middle section: left column, center, right column */}
        <div className="flex justify-between items-start">
          {/* Left column */}
          <div className="flex flex-col gap-1">
            {leftCol.map((tile) => (
              <div key={tile.id}>
                {renderTile(tile, "vertical", tile.position === 31 || tile.position === 39)}
              </div>
            ))}
          </div>

          {/* Center area - will be overlaid with dice/modals by parent */}
          <div className="flex-1 mx-2 my-1 min-h-[180px] flex items-center justify-center relative">
            {/* Placeholder - parent will overlay content here */}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-1">
            {rightCol.map((tile) => (
              <div key={tile.id}>
                {renderTile(tile, "vertical", tile.position === 11 || tile.position === 19)}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex justify-between mt-1">
          {bottomRow.map((tile) => (
            <div key={tile.id}>
              {renderTile(tile, "horizontal", tile.position === 0 || tile.position === 10)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

