// In-memory storage for games when database is not configured
// This allows the app to work locally without a database

interface MemoryUser {
  id: string;
  walletAddress: string;
  username: string | null;
  createdAt: Date;
}

interface MemoryGamePlayer {
  id: string;
  gameId: string;
  userId: string;
  position: number;
  balance: number;
  isReady: boolean;
  isHost: boolean;
  hasPaidBuyIn: boolean;
  joinedAt: Date;
}

interface MemoryGame {
  id: string;
  code: string;
  type: "FREE" | "PAID";
  buyInSol: number | null;
  maxPlayers: number;
  status: "WAITING" | "IN_PROGRESS" | "FINISHED";
  creatorId: string;
  boardConfig: string;
  turnState: string | null;
  winnerId: string | null;
  endedAt: Date | null;
  createdAt: Date;
}

class MemoryStore {
  private users: Map<string, MemoryUser> = new Map();
  private games: Map<string, MemoryGame> = new Map();
  private players: Map<string, MemoryGamePlayer> = new Map();
  private gamePlayers: Map<string, string[]> = new Map(); // gameId -> playerIds[]

  // Users
  createUser(walletAddress: string, username: string | null = null): MemoryUser {
    const id = walletAddress;
    const user: MemoryUser = {
      id,
      walletAddress,
      username,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  getUser(id: string): MemoryUser | undefined {
    return this.users.get(id);
  }

  getUserByWallet(walletAddress: string): MemoryUser | undefined {
    return Array.from(this.users.values()).find(u => u.walletAddress === walletAddress);
  }

  // Games
  createGame(data: {
    code: string;
    type: "FREE" | "PAID";
    buyInSol: number | null;
    maxPlayers: number;
    creatorId: string;
    boardConfig: string;
  }): MemoryGame {
    const id = `game-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const game: MemoryGame = {
      id,
      ...data,
      status: "WAITING",
      turnState: null,
      winnerId: null,
      endedAt: null,
      createdAt: new Date(),
    };
    this.games.set(id, game);
    this.gamePlayers.set(id, []);
    return game;
  }

  getGame(id: string): MemoryGame | undefined {
    return this.games.get(id);
  }

  getGameByCode(code: string): MemoryGame | undefined {
    return Array.from(this.games.values()).find(g => g.code === code);
  }

  getAllGames(filters?: {
    type?: string;
    status?: string;
    buyInMin?: number;
    buyInMax?: number;
  }): MemoryGame[] {
    let games = Array.from(this.games.values());

    if (filters) {
      if (filters.type) {
        games = games.filter(g => g.type === filters.type);
      }
      if (filters.status) {
        games = games.filter(g => g.status === filters.status);
      }
      if (filters.buyInMin !== undefined) {
        games = games.filter(g => g.buyInSol !== null && g.buyInSol >= filters.buyInMin!);
      }
      if (filters.buyInMax !== undefined) {
        games = games.filter(g => g.buyInSol !== null && g.buyInSol <= filters.buyInMax!);
      }
    }

    return games.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  updateGame(id: string, updates: Partial<MemoryGame>): MemoryGame | null {
    const game = this.games.get(id);
    if (!game) return null;
    
    Object.assign(game, updates);
    this.games.set(id, game);
    return game;
  }

  // Players
  createPlayer(data: {
    gameId: string;
    userId: string;
    isHost: boolean;
    isReady: boolean;
    hasPaidBuyIn: boolean;
  }): MemoryGamePlayer {
    const id = `player-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const player: MemoryGamePlayer = {
      id,
      gameId: data.gameId,
      userId: data.userId,
      position: 0,
      balance: 1500,
      isHost: data.isHost,
      isReady: data.isReady,
      hasPaidBuyIn: data.hasPaidBuyIn,
      joinedAt: new Date(),
    };
    this.players.set(id, player);
    
    const gamePlayerIds = this.gamePlayers.get(data.gameId) || [];
    gamePlayerIds.push(id);
    this.gamePlayers.set(data.gameId, gamePlayerIds);
    
    return player;
  }

  getPlayer(id: string): MemoryGamePlayer | undefined {
    return this.players.get(id);
  }

  getPlayersByGame(gameId: string): MemoryGamePlayer[] {
    const playerIds = this.gamePlayers.get(gameId) || [];
    return playerIds.map(id => this.players.get(id)!).filter(Boolean);
  }

  updatePlayer(id: string, updates: Partial<MemoryGamePlayer>): MemoryGamePlayer | null {
    const player = this.players.get(id);
    if (!player) return null;
    
    Object.assign(player, updates);
    this.players.set(id, player);
    return player;
  }

  deletePlayer(id: string): boolean {
    const player = this.players.get(id);
    if (!player) return false;
    
    const gamePlayerIds = this.gamePlayers.get(player.gameId) || [];
    const index = gamePlayerIds.indexOf(id);
    if (index > -1) {
      gamePlayerIds.splice(index, 1);
      this.gamePlayers.set(player.gameId, gamePlayerIds);
    }
    
    return this.players.delete(id);
  }
}

// Singleton instance
export const memoryStore = new MemoryStore();

// Helper to check if database is available
export function hasDatabase(): boolean {
  const dbUrl = process.env.DATABASE_URL;
  return !!(
    dbUrl &&
    dbUrl !== "file:./prisma/dev.db" &&
    !dbUrl.includes("undefined")
  );
}

