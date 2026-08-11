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

export interface PackOpenResult {
  cards: Card[];
  /** Новый счётчик pity (паков без топ-редкости). 0 — гарантия сработала или выпала естественно. */
  newPity: number;
  /** Гарантия сработала (топ-редкость выдана принудительно). */
  pityTriggered: boolean;
}

/**
 * Открыть пак.
 *
 * Pity-система (как в продвинутых коллекционных играх):
 * если у пака задан config.pity, каждый пак без топ-редкости увеличивает
 * счётчик, а на `max`-м паке топ-редкость выпадает гарантированно
 * (последняя карта пака). Счётчик сбрасывается при выпадении.
 */
export function openPack(packId: string, pity = 0): PackOpenResult {
  const config = getPackById(packId);
  if (!config) return { cards: [], newPity: 0, pityTriggered: false };

  const result: Card[] = [];
  for (let i = 0; i < config.cardCount; i++) {
    result.push({ ...getRandomCardByRarity(rollRarity(config)) });
  }

  let newPity = pity;
  let pityTriggered = false;
  if (config.pity) {
    const { rarity, max } = config.pity;
    const hasTopRarity = result.some((c) => c.rarity === rarity);
    if (hasTopRarity) {
      newPity = 0;
    } else if (pity + 1 >= max) {
      result[result.length - 1] = getRandomCardByRarity(rarity);
      newPity = 0;
      pityTriggered = true;
    } else {
      newPity = pity + 1;
    }
  }

  return { cards: result, newPity, pityTriggered };
}
