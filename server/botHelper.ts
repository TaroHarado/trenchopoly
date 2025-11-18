import { PlayerState } from "@/lib/types";
import { isBotUser, isBotPlayer } from "@/lib/botUtils";

/**
 * Creates a bot player for single-player games
 * Bot uses a special userId format: "bot-{gameId}-{index}"
 * Note: userId will be updated to actual User.id after User is created in DB
 */
export function createBotPlayer(gameId: string, index: number = 0): {
  id: string;
  userId: string; // Will be updated to actual User.id after creation
  name: string;
} {
  const botId = `bot-${gameId}-${index}`;
  const botUserId = `bot-user-${gameId}-${index}`; // Temporary, will be replaced with actual User.id
  
  return {
    id: botId,
    userId: botUserId,
    name: `Bot ${index + 1}`,
  };
}

// Re-export for convenience
export { isBotUser, isBotPlayer };

/**
 * Creates a PlayerState for a bot
 */
export function createBotPlayerState(
  botId: string,
  botUserId: string,
  startingBalance: number = 1500
): PlayerState {
  return {
    id: botId,
    userId: botUserId,
    position: 0,
    balance: startingBalance,
    properties: [],
    inJail: false,
    jailTurns: 0,
    active: true,
    getOutOfJailCards: 0,
  };
}

