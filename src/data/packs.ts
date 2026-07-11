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
}

export const PACKS: PackConfig[] = [
  {
    id: 'basic',
    nameKey: 'pack.basic',
    descKey: 'pack.basicDesc',
    price: 500,
    nacklPrice: 5,
    cardCount: 5,
    rarityWeights: { common: 80, uncommon: 20 },
    allowedRarities: ['common', 'uncommon'],
  },
  {
    id: 'standard',
    nameKey: 'pack.standard',
    descKey: 'pack.standardDesc',
    price: 700,
    nacklPrice: 7,
    cardCount: 5,
    rarityWeights: { common: 60, uncommon: 30, rare: 10 },
    allowedRarities: ['common', 'uncommon', 'rare'],
  },
  {
    id: 'advanced',
    nameKey: 'pack.advanced',
    descKey: 'pack.advancedDesc',
    price: 1000,
    nacklPrice: 10,
    cardCount: 5,
    rarityWeights: { uncommon: 50, rare: 25, epic: 15, legendary: 10 },
    allowedRarities: ['uncommon', 'rare', 'epic', 'legendary'],
  },
];

export function getPackById(id: string): PackConfig | undefined {
  return PACKS.find((p) => p.id === id);
}
