import { CardDefinition } from "@/lib/types";

export const TREND_CARDS: CardDefinition[] = [
  {
    id: "trend-1",
    deck: "TREND",
    title: "Airdrop Season",
    description: "You received an airdrop! Collect $200 from the bank.",
    effectType: "BALANCE_DELTA",
    amount: 200,
  },
  {
    id: "trend-2",
    deck: "TREND",
    title: "Rug Pull",
    description: "You got rugged! Pay $150 to the bank.",
    effectType: "BALANCE_DELTA",
    amount: -150,
  },
  {
    id: "trend-3",
    deck: "TREND",
    title: "Bull Run",
    description: "Market pumps! Advance 3 spaces and collect $100.",
    effectType: "MOVE_RELATIVE",
    moveSpaces: 3,
    amount: 100,
  },
  {
    id: "trend-4",
    deck: "TREND",
    title: "Liquidation Cascade",
    description: "Market crashes! Pay $100 to each player.",
    effectType: "GLOBAL_EVENT",
    globalAmountPerPlayer: -100,
  },
  {
    id: "trend-5",
    deck: "TREND",
    title: "Early Presale",
    description: "You got early access! Move to the nearest unowned property. If you pass GO, collect $200.",
    effectType: "MOVE_TO_TILE",
    // Will be calculated dynamically to nearest unowned property
  },
  {
    id: "trend-6",
    deck: "TREND",
    title: "CT Influencer Shill",
    description: "Your shill went viral! Each player pays you $50.",
    effectType: "GLOBAL_EVENT",
    globalAmountPerPlayer: 50,
  },
  {
    id: "trend-7",
    deck: "TREND",
    title: "Flash Loan",
    description: "You took a flash loan. Collect $150 from the bank.",
    effectType: "BALANCE_DELTA",
    amount: 150,
  },
  {
    id: "trend-8",
    deck: "TREND",
    title: "Smart Contract Bug",
    description: "You found a bug! Collect $100 from the bank.",
    effectType: "BALANCE_DELTA",
    amount: 100,
  },
  {
    id: "trend-9",
    deck: "TREND",
    title: "Gas War",
    description: "High gas fees! Pay $75 to the bank.",
    effectType: "BALANCE_DELTA",
    amount: -75,
  },
  {
    id: "trend-10",
    deck: "TREND",
    title: "Governance Proposal Passed",
    description: "Your proposal passed! Collect $125 from the bank.",
    effectType: "BALANCE_DELTA",
    amount: 125,
  },
];

export const PUMP_CARDS: CardDefinition[] = [
  {
    id: "pump-1",
    deck: "PUMP",
    title: "Whale Buy",
    description: "A whale bought in! Collect $200 from the bank.",
    effectType: "BALANCE_DELTA",
    amount: 200,
  },
  {
    id: "pump-2",
    deck: "PUMP",
    title: "Dump It",
    description: "Someone dumped! Pay $150 to the bank.",
    effectType: "BALANCE_DELTA",
    amount: -150,
  },
  {
    id: "pump-3",
    deck: "PUMP",
    title: "Pump Signal",
    description: "Pump incoming! Advance 5 spaces.",
    effectType: "MOVE_RELATIVE",
    moveSpaces: 5,
  },
  {
    id: "pump-4",
    deck: "PUMP",
    title: "Rekt",
    description: "You got rekt! Go directly to Jail. Do not pass GO, do not collect $200.",
    effectType: "GO_TO_JAIL",
  },
  {
    id: "pump-5",
    deck: "PUMP",
    title: "Get Out of Jail Free",
    description: "This card may be kept until needed or sold.",
    effectType: "GET_OUT_OF_JAIL",
  },
  {
    id: "pump-6",
    deck: "PUMP",
    title: "Moon Mission",
    description: "To the moon! Move to GO and collect $200.",
    effectType: "MOVE_TO_TILE",
    targetTileId: "start",
    amount: 200,
  },
  {
    id: "pump-7",
    deck: "PUMP",
    title: "FOMO Buy",
    description: "You FOMO'd in! Pay $100 to the bank.",
    effectType: "BALANCE_DELTA",
    amount: -100,
  },
  {
    id: "pump-8",
    deck: "PUMP",
    title: "Diamond Hands",
    description: "You held! Collect $150 from the bank.",
    effectType: "BALANCE_DELTA",
    amount: 150,
  },
  {
    id: "pump-9",
    deck: "PUMP",
    title: "Paper Hands",
    description: "You paper-handed! Pay $75 to each player.",
    effectType: "GLOBAL_EVENT",
    globalAmountPerPlayer: -75,
  },
  {
    id: "pump-10",
    deck: "PUMP",
    title: "Token Launch",
    description: "Your token launched! Collect $175 from the bank.",
    effectType: "BALANCE_DELTA",
    amount: 175,
  },
];

// Shuffle function for deck management
export function shuffleDeck<T>(deck: T[]): T[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Initialize decks for a game
export function initializeDecks(): { trend: string[]; pump: string[] } {
  return {
    trend: shuffleDeck(TREND_CARDS.map(c => c.id)),
    pump: shuffleDeck(PUMP_CARDS.map(c => c.id)),
  };
}

// Get card by ID
export function getCardById(cardId: string): CardDefinition | undefined {
  return [...TREND_CARDS, ...PUMP_CARDS].find(c => c.id === cardId);
}

// Draw top card from deck
export function drawCard(deck: string[]): { cardId: string; newDeck: string[] } | null {
  if (deck.length === 0) return null;
  const cardId = deck[0];
  const newDeck = [...deck.slice(1), cardId]; // Move to bottom for reshuffle
  return { cardId, newDeck };
}

