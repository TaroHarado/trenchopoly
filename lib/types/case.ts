export type CaseRarity = 'COMMON' | 'RARE' | 'EPIC' | 'ULTRA';

export interface CaseItem {
  id: string;        // e.g. 'bonk'
  name: string;      // e.g. 'BONK'
  ticker: string;    // same as name for now
  rarity: CaseRarity;
  imageUrl: string;  // placeholder for now, e.g. `/cards/bonk.png`
}

export interface LootCase {
  id: string;        // 'free-test' | 'welcome-pack'
  title: string;
  priceSol: number;  // 0 or 0.025
  free?: boolean;    // marks the free case
  items: CaseItem[];
}

