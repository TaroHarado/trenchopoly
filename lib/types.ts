// Shared TypeScript types and DTOs

export type GameStatus = "WAITING" | "IN_PROGRESS" | "FINISHED";
export type GameType = "FREE" | "PAID";
export type CustomItemType = "TILE" | "CARD";
export type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
export type ListingStatus = "ACTIVE" | "SOLD" | "CANCELLED";

// Board tile types
export type TileType =
  | "START"
  | "PROPERTY"
  | "TAX"
  | "GO_TO_JAIL"
  | "JAIL"
  | "CHANCE"
  | "FREE_PARKING"
  | "CUSTOM_TILE";

export interface BoardTile {
  id: string;
  type: TileType;
  name: string;
  position: number;
  // Property-specific
  price?: number;
  rent?: number;
  colorGroup?: string;
  // Custom tile
  customItemId?: string;
}

export interface BoardConfig {
  tiles: BoardTile[];
  customTiles?: string[]; // inventory item IDs
  customCards?: string[]; // inventory item IDs
}

// Game state
export interface PlayerState {
  id: string;
  userId: string;
  position: number;
  balance: number;
  properties: string[]; // tile IDs
  inJail: boolean;
  jailTurns: number;
  active: boolean; // false if bankrupt
  getOutOfJailCards: number; // number of "Get Out of Jail Free" cards
}

export interface GameState {
  currentPlayerIndex: number;
  players: PlayerState[];
  diceRoll?: [number, number];
  lastAction?: string;
  phase: "ROLL" | "ACTION" | "END_TURN" | "AWAITING_TRADE_RESPONSE";
  turnNumber: number;
  gameEnded?: boolean;
  winnerId?: string;
  winnerNetWorth?: number;
  turnLimit?: number; // optional turn limit
  currentCard?: CardDefinition; // card being resolved
  tradeProposals: TradeProposal[];
  cardDecks: {
    trend: string[]; // card IDs in deck
    pump: string[]; // card IDs in deck
  };
  gameJustStarted?: boolean; // true if game just started (for preventing immediate end)
  minTurnsBeforeEnd?: number; // minimum turns before game can end (for single-player with bot)
}

// Card system
export type CardEffectType =
  | "BALANCE_DELTA"
  | "MOVE_RELATIVE"
  | "MOVE_TO_TILE"
  | "GET_OUT_OF_JAIL"
  | "GO_TO_JAIL"
  | "PROPERTY_BONUS"
  | "GLOBAL_EVENT";

export interface CardDefinition {
  id: string;
  deck: "TREND" | "PUMP";
  title: string;
  description: string;
  effectType: CardEffectType;
  amount?: number;
  targetTileId?: string;
  globalAmountPerPlayer?: number;
  moveSpaces?: number;
}

// Trading system
export interface TradeProposal {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offeredPropertyIds: string[];
  requestedPropertyIds: string[];
  cashFromFromPlayer?: number;
  cashFromToPlayer?: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
}

// Game actions
export type GameAction =
  | { type: "ROLL_DICE" }
  | { type: "END_TURN" }
  | { type: "BUY_PROPERTY"; tileId: string }
  | { type: "SKIP_BUY" }
  | { type: "PAY_RENT"; tileId: string; amount: number }
  | { type: "DRAW_CARD" }
  | { type: "RESOLVE_CARD" }
  | { type: "USE_JAIL_CARD" }
  | { type: "PAY_TAX"; amount: number }
  | { type: "DECLARE_BANKRUPTCY" }
  | { type: "PROPOSE_TRADE"; proposal: Omit<TradeProposal, "id" | "status"> }
  | { type: "ACCEPT_TRADE"; proposalId: string }
  | { type: "DECLINE_TRADE"; proposalId: string }
  | { type: "CANCEL_TRADE"; proposalId: string };

// API Request/Response types
export interface CreateGameRequest {
  type: GameType;
  buyInSol?: number;
  maxPlayers?: number;
  isPrivate?: boolean;
  customItemIds?: string[];
}

export interface JoinGameRequest {
  gameId: string;
}

export interface PrepareBuyInResponse {
  amountLamports: number;
  houseWalletPublicKey: string;
  gameId: string;
}

export interface ConfirmBuyInRequest {
  gameId: string;
  signature: string;
}

export interface PrepareMarketBuyResponse {
  amountLamports: number;
  sellerWalletAddress: string;
  houseWalletPublicKey: string;
  listingId: string;
}

export interface ConfirmMarketBuyRequest {
  listingId: string;
  signature: string;
}

export interface OpenCaseRequest {
  caseId: string;
  signature?: string; // For future SOL payment verification
}

export interface CreateListingRequest {
  inventoryItemId: string;
  priceSol: number;
}

// Socket.io events
export interface SocketEvents {
  // Client -> Server
  "join-room": { gameId: string };
  "leave-room": { gameId: string };
  "player-ready": { gameId: string; ready: boolean };
  "game-start": { gameId: string };
  "action": { gameId: string; action: GameAction };
  "chat-message": { gameId: string; message: string };

  // Server -> Client
  "state-update": { gameId: string; state: GameState; boardConfig: BoardConfig };
  "player-joined": { gameId: string; player: any };
  "player-left": { gameId: string; playerId: string };
  "error": { message: string };
}

