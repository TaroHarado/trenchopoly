"use client";

import boardConfigData from "@/config/board.json";
import { BoardConfig, BoardTile } from "@/lib/types";

const boardConfig = boardConfigData as BoardConfig;

// Minimal color mapping for property groups
const colorMap: Record<string, string> = {
  brown: "bg-gray-800",
  "light-blue": "bg-gray-300",
  pink: "bg-gray-400",
  orange: "bg-gray-500",
  red: "bg-gray-600",
  yellow: "bg-gray-200",
  green: "bg-gray-700",
  "dark-blue": "bg-gray-900",
  railroad: "bg-gray-600",
  utility: "bg-gray-500",
};

export function GamePreviewBoard() {
  const getTileColor = (tile: BoardTile): string => {
    if (tile.type === "PROPERTY" && tile.colorGroup) {
      return colorMap[tile.colorGroup] || "bg-gray-400";
    }
    if (tile.type === "START") return "bg-black";
    if (tile.type === "JAIL") return "bg-gray-900";
    if (tile.type === "GO_TO_JAIL") return "bg-gray-900";
    if (tile.type === "FREE_PARKING") return "bg-gray-100";
    if (tile.type === "TAX") return "bg-gray-300";
    if (tile.type === "CHANCE") return "bg-gray-200";
    return "bg-gray-400";
  };

  const getTileByPosition = (position: number): BoardTile | null => {
    return boardConfig.tiles.find(t => t.position === position) || null;
  };

  // Build the board layout
  const bottomRow = Array.from({ length: 11 }, (_, i) => getTileByPosition(i)).filter(Boolean) as BoardTile[];
  const rightColumn = Array.from({ length: 9 }, (_, i) => getTileByPosition(19 - i)).filter(Boolean) as BoardTile[];
  const topRow = Array.from({ length: 11 }, (_, i) => getTileByPosition(30 - i)).filter(Boolean) as BoardTile[];
  const leftColumn = Array.from({ length: 9 }, (_, i) => getTileByPosition(31 + i)).filter(Boolean) as BoardTile[];

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-2xl font-light mb-6 text-black text-center">
          Game Board Preview
        </h3>

        {/* Monopoly board square layout */}
        <div className="relative" style={{ aspectRatio: "1 / 1", maxWidth: "500px", margin: "0 auto" }}>
          {/* Top row */}
          <div className="flex">
            {topRow.map((tile) => (
              <div
                key={tile.id}
                className={`${getTileColor(tile)} border border-gray-300 flex-1 p-1.5 text-center text-[10px]`}
                title={tile.name}
              >
                <div className="text-white font-medium truncate drop-shadow leading-tight">
                  {tile.name.length > 6 ? tile.name.slice(0, 5) + ".." : tile.name}
                </div>
                {tile.type === "PROPERTY" && tile.price && (
                  <div className="text-white text-[8px] mt-0.5 font-medium">${tile.price}</div>
                )}
              </div>
            ))}
          </div>

          {/* Middle section: left column, center space, right column */}
          <div className="flex">
            {/* Left column */}
            <div className="flex flex-col">
              {leftColumn.map((tile) => (
                <div
                  key={tile.id}
                  className={`${getTileColor(tile)} border border-gray-300 flex-1 p-1.5 text-center text-[10px]`}
                  style={{ minHeight: "40px" }}
                  title={tile.name}
                >
                  <div className="text-white font-medium truncate drop-shadow leading-tight">
                    {tile.name.length > 6 ? tile.name.slice(0, 5) + ".." : tile.name}
                  </div>
                  {tile.type === "PROPERTY" && tile.price && (
                    <div className="text-white text-[8px] mt-0.5 font-medium">${tile.price}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Center space */}
            <div className="flex-1 bg-gray-50 border border-gray-200 flex items-center justify-center">
              <div className="text-center p-4">
                <div className="text-3xl mb-2">🎲</div>
                <div className="text-gray-900 font-light text-sm">TRENCHOPOLY</div>
              </div>
            </div>

            {/* Right column */}
            <div className="flex flex-col">
              {rightColumn.map((tile) => (
                <div
                  key={tile.id}
                  className={`${getTileColor(tile)} border border-gray-300 flex-1 p-1.5 text-center text-[10px]`}
                  style={{ minHeight: "40px" }}
                  title={tile.name}
                >
                  <div className="text-white font-medium truncate drop-shadow leading-tight">
                    {tile.name.length > 6 ? tile.name.slice(0, 5) + ".." : tile.name}
                  </div>
                  {tile.type === "PROPERTY" && tile.price && (
                    <div className="text-white text-[8px] mt-0.5 font-medium">${tile.price}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex">
            {bottomRow.map((tile) => (
              <div
                key={tile.id}
                className={`${getTileColor(tile)} border border-gray-300 flex-1 p-1.5 text-center text-[10px]`}
                title={tile.name}
              >
                <div className="text-white font-medium truncate drop-shadow leading-tight">
                  {tile.name.length > 6 ? tile.name.slice(0, 5) + ".." : tile.name}
                </div>
                {tile.type === "PROPERTY" && tile.price && (
                  <div className="text-white text-[8px] mt-0.5 font-medium">${tile.price}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-6 text-center">
          40 unique locations
        </p>
      </div>
    </div>
  );
}
