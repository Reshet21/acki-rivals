import { describe, it, expect } from 'vitest';
import { openPack } from './packGenerator';
import { cards } from '../data/cards';

describe('openPack', () => {
  it('returns an empty array for an unknown pack', () => {
    expect(openPack('does-not-exist')).toEqual([]);
  });

  it('starter pack yields cardCount fresh common/uncommon cards', () => {
    const result = openPack('starter');
    expect(result).toHaveLength(10);

    for (const card of result) {
      expect(['common', 'uncommon']).toContain(card.rarity);
      // every card must map to a real pool entry
      expect(cards.find((c) => c.id === card.id)).toBeDefined();
    }

    // returned cards are clones, not references into the pool
    expect(cards.includes(result[0])).toBe(false);
  });

  it('advanced pack never yields common cards', () => {
    const rarities = new Set<string>();
    for (let i = 0; i < 50; i++) {
      for (const card of openPack('advanced')) {
        rarities.add(card.rarity);
      }
    }
    expect(rarities.has('common')).toBe(false);
    expect(rarities.size).toBeGreaterThan(0);
  });

  it('each card carries the full card shape', () => {
    const [card] = openPack('basic');
    expect(card).toMatchObject({
      id: expect.any(Number),
      name: expect.any(String),
      clan: expect.any(String),
      power: expect.any(Number),
      damage: expect.any(Number),
      ability: expect.any(String),
      rarity: expect.any(String),
    });
  });
});
