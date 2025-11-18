"use client";

import { GameState, BoardConfig, BoardTile } from "@/lib/types";

interface BoardRingProps {
  boardConfig: BoardConfig;
  gameState: GameState;
  currentPlayerId: string;
  onTileClick?: (tile: BoardTile) => void;
}

// Color mapping for property groups - vivid colors
const colorMap: Record<string, { bg: string; strip: string }> = {
  brown: { bg: "bg-amber-100", strip: "bg-amber-800" },
  "light-blue": { bg: "bg-cyan-100", strip: "bg-cyan-600" },
  pink: { bg: "bg-pink-100", strip: "bg-pink-600" },
  orange: { bg: "bg-orange-100", strip: "bg-orange-600" },
  red: { bg: "bg-red-100", strip: "bg-red-700" },
  yellow: { bg: "bg-yellow-100", strip: "bg-yellow-600" },
  green: { bg: "bg-green-100", strip: "bg-green-700" },
  "dark-blue": { bg: "bg-blue-100", strip: "bg-blue-800" },
  railroad: { bg: "bg-gray-200", strip: "bg-gray-800" },
  utility: { bg: "bg-gray-200", strip: "bg-gray-700" },
};

// Special tile colors
const specialTileColors: Record<string, { bg: string; text: string }> = {
  START: { bg: "bg-emerald-500", text: "text-white" },
  JAIL: { bg: "bg-red-800", text: "text-white" },
  GO_TO_JAIL: { bg: "bg-red-900", text: "text-white" },
  FREE_PARKING: { bg: "bg-green-500", text: "text-white" },
  TAX: { bg: "bg-yellow-500", text: "text-black" },
  CHANCE: { bg: "bg-purple-500", text: "text-white" },
};

interface TileProps {
  tile: BoardTile;
  orientation: "horizontal" | "vertical";
  isCorner: boolean;
  isCurrentPosition: boolean;
  playersOnTile: Array<{ id: string; userId: string }>;
  isOwned: boolean;
  onClick?: () => void;
}

function HorizontalTile({
  tile,
  isCorner,
  isCurrentPosition,
  playersOnTile,
  isOwned,
  onClick,
}: TileProps) {
  const isProperty = tile.type === "PROPERTY";
  const colorInfo = isProperty && tile.colorGroup ? colorMap[tile.colorGroup] : null;
  const specialColor = !isProperty ? specialTileColors[tile.type] : null;
  const bgColor = colorInfo?.bg || specialColor?.bg || "bg-zinc-200";
  const textColor = specialColor?.text || "text-black";

  return (
    <div
      onClick={onClick}
      className={`
        relative flex flex-col
        ${isCorner ? "w-20 h-20" : "w-16 h-20"}
        ${bgColor} ${textColor}
        border-2 ${isCurrentPosition ? "border-emerald-400 shadow-lg shadow-emerald-400/50" : "border-zinc-800"}
        transition-all cursor-pointer hover:scale-105
      `}
    >
      {/* Color strip at top for properties */}
      {isProperty && colorInfo && (
        <div className={`h-3 ${colorInfo.strip}`} />
      )}

      {/* Tile content */}
      <div className="flex-1 flex flex-col items-center justify-center p-1 text-center">
        <div className="text-xs font-bold leading-tight mb-0.5 line-clamp-2">
          {tile.name}
        </div>
        {tile.price && (
          <div className="text-[10px] font-semibold mt-auto">
            ${tile.price}
          </div>
        )}
      </div>

      {/* Player tokens */}
      {playersOnTile.length > 0 && (
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
          {playersOnTile.map((player, idx) => {
            const playerIndex = idx % 6;
            const colors = ["bg-blue-500", "bg-red-500", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500"];
            return (
              <div
                key={player.id}
                className={`w-3 h-3 rounded-full border-2 border-white ${colors[playerIndex]}`}
                title={player.userId}
              />
            );
          })}
        </div>
      )}

      {/* Ownership indicator */}
      {isOwned && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-900/40" />
      )}
    </div>
  );
}

function VerticalTile({
  tile,
  isCorner,
  isCurrentPosition,
  playersOnTile,
  isOwned,
  onClick,
}: TileProps) {
  const isProperty = tile.type === "PROPERTY";
  const colorInfo = isProperty && tile.colorGroup ? colorMap[tile.colorGroup] : null;
  const specialColor = !isProperty ? specialTileColors[tile.type] : null;
  const bgColor = colorInfo?.bg || specialColor?.bg || "bg-zinc-200";
  const textColor = specialColor?.text || "text-black";

  return (
    <div
      onClick={onClick}
      className={`
        relative flex flex-row
        ${isCorner ? "w-20 h-20" : "w-20 h-16"}
        ${bgColor} ${textColor}
        border-2 ${isCurrentPosition ? "border-emerald-400 shadow-lg shadow-emerald-400/50" : "border-zinc-800"}
        transition-all cursor-pointer hover:scale-105
      `}
    >
      {/* Color strip at left for properties */}
      {isProperty && colorInfo && (
        <div className={`w-3 ${colorInfo.strip}`} />
      )}

      {/* Tile content */}
      <div className="flex-1 flex flex-col items-center justify-center p-1 text-center">
        <div className="text-xs font-bold leading-tight mb-0.5 line-clamp-2">
          {tile.name}
        </div>
        {tile.price && (
          <div className="text-[10px] font-semibold mt-auto">
            ${tile.price}
          </div>
        )}
      </div>

      {/* Player tokens */}
      {playersOnTile.length > 0 && (
        <div className="absolute -right-1 top-1/2 transform -translate-y-1/2 flex flex-col gap-0.5">
          {playersOnTile.map((player, idx) => {
            const playerIndex = idx % 6;
            const colors = ["bg-blue-500", "bg-red-500", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500"];
            return (
              <div
                key={player.id}
                className={`w-3 h-3 rounded-full border-2 border-white ${colors[playerIndex]}`}
                title={player.userId}
              />
            );
          })}
        </div>
      )}

      {/* Ownership indicator */}
      {isOwned && (
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-zinc-900/40" />
      )}
    </div>
  );
}

export function BoardRing({ boardConfig, gameState, currentPlayerId, onTileClick }: BoardRingProps) {
  const tiles = boardConfig.tiles;
  
  // Get current player position
  const currentPlayer = gameState.players.find(p => p.userId === currentPlayerId);
  const currentPosition = currentPlayer?.position ?? 0;

  // Helper to get players on a tile
  const getPlayersOnTile = (tilePos: number) => {
    return gameState.players
      .filter(p => p.position === tilePos && p.active)
      .map(p => ({ id: p.id, userId: p.userId }));
  };

  // Helper to check if tile is owned
  const isTileOwned = (tileId: string) => {
    return gameState.players.some(p => p.properties.includes(tileId));
  };

  // Helper to get tile by position
  const getTileByPos = (pos: number) => tiles.find(t => t.position === pos);

  // Arrange tiles according to Monopoly layout:
  // Bottom row (left→right): [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
  const bottomRow = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
    .map(pos => getTileByPos(pos))
    .filter((t): t is BoardTile => t !== undefined);

  // Right column (top→bottom): [31, 32, 33, 34, 35, 36, 37, 38, 39]
  const rightCol = [31, 32, 33, 34, 35, 36, 37, 38, 39]
    .map(pos => getTileByPos(pos))
    .filter((t): t is BoardTile => t !== undefined);

  // Top row (right→left): [30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20]
  const topRow = [30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20]
    .map(pos => getTileByPos(pos))
    .filter((t): t is BoardTile => t !== undefined);

  // Left column (bottom→top): [19, 18, 17, 16, 15, 14, 13, 12, 11]
  const leftCol = [19, 18, 17, 16, 15, 14, 13, 12, 11]
    .map(pos => getTileByPos(pos))
    .filter((t): t is BoardTile => t !== undefined);

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="relative bg-zinc-900/80 border-4 border-zinc-700 rounded-lg p-2">
        {/* Top row */}
        <div className="flex justify-between mb-1">
          {topRow.map((tile) => {
            const isCorner = tile.position === 20 || tile.position === 30;
            return (
              <HorizontalTile
                key={tile.id}
                tile={tile}
                orientation="horizontal"
                isCorner={isCorner}
                isCurrentPosition={tile.position === currentPosition}
                playersOnTile={getPlayersOnTile(tile.position)}
                isOwned={isTileOwned(tile.id)}
                onClick={() => onTileClick?.(tile)}
              />
            );
          })}
        </div>

        {/* Middle section */}
        <div className="flex justify-between items-start">
          {/* Left column */}
          <div className="flex flex-col gap-1">
            {leftCol.map((tile) => {
              const isCorner = tile.position === 11 || tile.position === 19;
              return (
                <VerticalTile
                  key={tile.id}
                  tile={tile}
                  orientation="vertical"
                  isCorner={isCorner}
                  isCurrentPosition={tile.position === currentPosition}
                  playersOnTile={getPlayersOnTile(tile.position)}
                  isOwned={isTileOwned(tile.id)}
                  onClick={() => onTileClick?.(tile)}
                />
              );
            })}
          </div>

          {/* Center area - reserved for dice and modals */}
          <div className="flex-1 mx-2 my-1 min-h-[200px] flex items-center justify-center relative">
            {/* Center content will be overlaid by parent */}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-1">
            {rightCol.map((tile) => {
              const isCorner = tile.position === 31 || tile.position === 39;
              return (
                <VerticalTile
                  key={tile.id}
                  tile={tile}
                  orientation="vertical"
                  isCorner={isCorner}
                  isCurrentPosition={tile.position === currentPosition}
                  playersOnTile={getPlayersOnTile(tile.position)}
                  isOwned={isTileOwned(tile.id)}
                  onClick={() => onTileClick?.(tile)}
                />
              );
            })}
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex justify-between mt-1">
          {bottomRow.map((tile) => {
            const isCorner = tile.position === 0 || tile.position === 10;
            return (
              <HorizontalTile
                key={tile.id}
                tile={tile}
                orientation="horizontal"
                isCorner={isCorner}
                isCurrentPosition={tile.position === currentPosition}
                playersOnTile={getPlayersOnTile(tile.position)}
                isOwned={isTileOwned(tile.id)}
                onClick={() => onTileClick?.(tile)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

