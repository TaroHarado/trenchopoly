import { LootCase, CaseRarity, CaseItem } from '@/lib/types/case';

export const RARITY_WEIGHTS: Record<CaseRarity, number> = {
  COMMON: 80,
  RARE: 12,
  EPIC: 5,
  ULTRA: 3,
};

export const CASE_ITEMS: CaseItem[] = [
  // COMMON
  { id: 'pnut',  name: 'PNUT',  ticker: 'PNUT',  rarity: 'COMMON', imageUrl: '/cards/pnut.png' },
  { id: 'bagwork', name: 'BAGWORK', ticker: 'BAGWORK', rarity: 'COMMON', imageUrl: '/cards/bagwork.png' },
  { id: 'bonk',  name: 'BONK',  ticker: 'BONK',  rarity: 'COMMON', imageUrl: '/cards/bonk.png' },
  { id: 'wif',   name: 'WIF',   ticker: 'WIF',   rarity: 'COMMON', imageUrl: '/cards/wif.png' },
  { id: 'popcat',name: 'POPCAT',ticker: 'POPCAT',rarity: 'COMMON', imageUrl: '/cards/popcat.png' },
  { id: 'myro',  name: 'MYRO',  ticker: 'MYRO',  rarity: 'COMMON', imageUrl: '/cards/myro.png' },
  { id: 'michi', name: 'MICHI', ticker: 'MICHI', rarity: 'COMMON', imageUrl: '/cards/michi.png' },
  { id: 'samo',  name: 'SAMO',  ticker: 'SAMO',  rarity: 'COMMON', imageUrl: '/cards/samo.png' },

  // RARE
  { id: 'me',    name: 'ME',    ticker: 'ME',    rarity: 'RARE',   imageUrl: '/cards/me.png' },
  { id: 'drift', name: 'DRIFT', ticker: 'DRIFT', rarity: 'RARE',   imageUrl: '/cards/drift.png' },
  { id: 'ray',   name: 'RAY',   ticker: 'RAY',   rarity: 'RARE',   imageUrl: '/cards/ray.png' },

  // EPIC
  { id: 'jito',  name: 'JITO',  ticker: 'JITO',  rarity: 'EPIC',   imageUrl: '/cards/jito.png' },
  { id: 'pump',  name: 'PUMP',  ticker: 'PUMP',  rarity: 'EPIC',   imageUrl: '/cards/pump.png' },
  { id: 'jup',   name: 'JUP',   ticker: 'JUP',   rarity: 'EPIC',   imageUrl: '/cards/jup.png' },

  // ULTRA
  { id: 'sol',   name: 'SOL',   ticker: 'SOL',   rarity: 'ULTRA',  imageUrl: '/cards/sol.png' },
];

export const TRENCHOPOLY_CASES: LootCase[] = [
  {
    id: 'free-test',
    title: 'Free Test Case',
    priceSol: 0,
    free: true,
    items: CASE_ITEMS,
  },
  {
    id: 'welcome-pack',
    title: 'Welcome Pack',
    priceSol: 0.025,
    free: false,
    items: CASE_ITEMS,
  },
];

export function pickRarity(): CaseRarity {
  const roll = Math.random() * 100;
  let acc = 0;

  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS) as [CaseRarity, number][]) {
    acc += weight;
    if (roll <= acc) return rarity;
  }

  return 'COMMON';
}

export function pickItemFromCase(lootCase: LootCase): CaseItem {
  const rarity = pickRarity();
  const candidates = lootCase.items.filter((i) => i.rarity === rarity);
  const pool = candidates.length ? candidates : lootCase.items;
  return pool[Math.floor(Math.random() * pool.length)];
}

