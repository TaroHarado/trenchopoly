"use client";

import { useState, useEffect } from "react";

interface DiceAnimationProps {
  diceRoll: [number, number] | null;
  isRolling: boolean;
  onRollComplete?: () => void;
}

export function DiceDisplay({ diceRoll, isRolling, onRollComplete }: DiceAnimationProps) {
  const [displayRoll, setDisplayRoll] = useState<[number, number] | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isRolling) {
      setIsAnimating(true);
      // Animate for 0.6-1 second with random dice faces
      const duration = 600 + Math.random() * 400;
      const interval = setInterval(() => {
        setDisplayRoll([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ]);
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        setIsAnimating(false);
        if (diceRoll) {
          setDisplayRoll(diceRoll);
          onRollComplete?.();
        }
      }, duration);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    } else if (diceRoll) {
      setDisplayRoll(diceRoll);
      setIsAnimating(false);
    }
  }, [isRolling, diceRoll, onRollComplete]);

  const renderDie = (value: number) => {
    const dots = [
      [], // 0 (not used)
      [[0.5, 0.5]], // 1
      [[0.25, 0.25], [0.75, 0.75]], // 2
      [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]], // 3
      [[0.25, 0.25], [0.25, 0.75], [0.75, 0.25], [0.75, 0.75]], // 4
      [[0.25, 0.25], [0.25, 0.75], [0.5, 0.5], [0.75, 0.25], [0.75, 0.75]], // 5
      [[0.25, 0.25], [0.25, 0.5], [0.25, 0.75], [0.75, 0.25], [0.75, 0.5], [0.75, 0.75]], // 6
    ];

    const dieValue = value || 1;

    return (
      <div className={`
        w-20 h-20 bg-white rounded-xl shadow-2xl border-4 border-zinc-800
        flex items-center justify-center relative
        ${isAnimating ? "animate-spin" : ""}
        transition-all duration-300
        hover:scale-110
      `}>
        <svg className="w-full h-full p-2" viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet">
          {dots[dieValue]?.map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="0.12"
              fill="black"
              className={isAnimating ? "animate-pulse" : ""}
            />
          ))}
        </svg>
      </div>
    );
  };

  const currentValue = displayRoll || diceRoll || [1, 1];
  const total = currentValue[0] + currentValue[1];

  if (!diceRoll && !isRolling) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-4 bg-zinc-900/80 backdrop-blur-sm rounded-xl p-6 border-2 border-emerald-400/30">
      <div className="flex gap-4">
        {renderDie(currentValue[0])}
        {renderDie(currentValue[1])}
      </div>
      {!isAnimating && diceRoll && (
        <div className="text-3xl font-bold text-emerald-400">
          {total}
        </div>
      )}
      {isAnimating && (
        <div className="text-sm text-zinc-400 animate-pulse">
          Rolling...
        </div>
      )}
    </div>
  );
}

// Export with both names for compatibility
export const DiceAnimation = DiceDisplay;

