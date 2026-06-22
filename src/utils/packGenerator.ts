import type { Card, Rarity } from '../types';
import { cards } from '../data/cards';
import { getPackById, type PackConfig } from '../data/packs';

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rollRarity(config: PackConfig): Rarity {
  const entries = Object.entries(config.rarityWeights).filter(([r]) => {
    if (!config.allowedRarities) return true;
    return config.allowedRarities.includes(r as Rarity);
  }) as [Rarity, number][];

  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;

  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }

  return entries[entries.length - 1][0];
}

function getRandomCardByRarity(rarity: Rarity): Card {
  const pool = cards.filter((c) => c.rarity === rarity);
  return pickRandom(pool);
}

export function openPack(packId: string): Card[] {
  const config = getPackById(packId);
  if (!config) return [];

  const result: Card[] = [];
  for (let i = 0; i < config.cardCount; i++) {
    const rarity = rollRarity(config);
    const card = getRandomCardByRarity(rarity);
    result.push({ ...card });
  }
  return result;
}
