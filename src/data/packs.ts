import type { Rarity } from '../types';

export interface PackConfig {
  id: string;
  nameKey: string;
  descKey: string;
  price: number; // Legacy credits price (kept for battles reward)
  nacklPrice: number; // Real NACKL token price
  cardCount: number;
  rarityWeights: Partial<Record<Rarity, number>>;
  allowedRarities?: Rarity[];
  /** Pity: топ-редкость гарантирована каждые `max` паков (как в Hearthstone/Genshin). */
  pity?: { rarity: Rarity; max: number };
}

export const PACKS: PackConfig[] = [
  {
    id: 'starter',
    nameKey: 'pack.starter',
    descKey: 'pack.starterDesc',
    price: 0,
    nacklPrice: 0,
    cardCount: 10,
    rarityWeights: { common: 85, uncommon: 15 },
    allowedRarities: ['common', 'uncommon'],
  },
  {
    id: 'basic',
    nameKey: 'pack.basic',
    descKey: 'pack.basicDesc',
    price: 500,
    nacklPrice: 5,
    cardCount: 5,
    rarityWeights: { common: 74, uncommon: 22, rare: 4 },
    allowedRarities: ['common', 'uncommon', 'rare'],
  },
  {
    id: 'standard',
    nameKey: 'pack.standard',
    descKey: 'pack.standardDesc',
    price: 700,
    nacklPrice: 7,
    cardCount: 5,
    rarityWeights: { common: 52, uncommon: 30, rare: 15, epic: 3 },
    allowedRarities: ['common', 'uncommon', 'rare', 'epic'],
    pity: { rarity: 'epic', max: 8 },
  },
  {
    id: 'advanced',
    nameKey: 'pack.advanced',
    descKey: 'pack.advancedDesc',
    price: 1000,
    nacklPrice: 10,
    cardCount: 5,
    rarityWeights: { uncommon: 50, rare: 33, epic: 15, legendary: 2 },
    allowedRarities: ['uncommon', 'rare', 'epic', 'legendary'],
    pity: { rarity: 'legendary', max: 8 },
  },
];

export function getPackById(id: string): PackConfig | undefined {
  return PACKS.find((p) => p.id === id);
}
