import type { Card, Rarity } from '../types';
import { cards } from '../data/cards';

function rollRarity(): Rarity {
  const roll = Math.random() * 100;
  if (roll < 5) return 'legendary';
  if (roll < 30) return 'rare';
  return 'common';
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function openPack(): Card[] {
  const pack: Card[] = [];
  for (let i = 0; i < 3; i++) {
    const rarity = rollRarity();
    const pool = cards.filter((c) => c.rarity === rarity);
    pack.push(pickRandom(pool));
  }
  return pack;
}
