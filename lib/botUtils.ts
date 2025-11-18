/**
 * Client-safe bot utility functions
 * These can be used both on server and client
 */

/**
 * Checks if a userId belongs to a bot
 * Bots are identified by checking if the user's walletAddress starts with "bot-"
 * We need to check this via the user object, not userId directly
 */
export function isBotUser(userId: string): boolean {
  // This is a fallback - in practice, we check walletAddress
  // But for backward compatibility, we keep this check
  return userId.startsWith("bot-user-");
}

/**
 * Checks if a walletAddress belongs to a bot
 */
export function isBotWalletAddress(walletAddress: string): boolean {
  return walletAddress.startsWith("bot-");
}

/**
 * Checks if a playerId belongs to a bot
 */
export function isBotPlayer(playerId: string): boolean {
  return playerId.startsWith("bot-");
}

