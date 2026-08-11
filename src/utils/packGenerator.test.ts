import { describe, it, expect } from 'vitest';
import { openPack } from './packGenerator';
import { cards } from '../data/cards';

describe('openPack', () => {
  it('returns an empty result for an unknown pack', () => {
    const result = openPack('does-not-exist');
    expect(result.cards).toEqual([]);
    expect(result.newPity).toBe(0);
  });

  it('starter pack yields cardCount fresh common/uncommon cards', () => {
    const result = openPack('starter');
    expect(result.cards).toHaveLength(10);

    for (const card of result.cards) {
      expect(['common', 'uncommon']).toContain(card.rarity);
      // every card must map to a real pool entry
      expect(cards.find((c) => c.id === card.id)).toBeDefined();
    }

    // returned cards are clones, not references into the pool
    expect(cards.includes(result.cards[0])).toBe(false);
  });

  it('advanced pack never yields common cards', () => {
    const rarities = new Set<string>();
    for (let i = 0; i < 50; i++) {
      for (const card of openPack('advanced').cards) {
        rarities.add(card.rarity);
      }
    }
    expect(rarities.has('common')).toBe(false);
    expect(rarities.size).toBeGreaterThan(0);
  });

  it('each card carries the full card shape', () => {
    const [card] = openPack('basic').cards;
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

  it('pity counter increments when no top rarity drops', () => {
    // advanced: pity on legendary, max 8 — с pity=3 и без легендарки в дропе
    // счётчик должен стать 4. Проверяем сброс: pity=0 + легендарка в дропе → 0.
    const r = openPack('advanced', 3);
    if (!r.cards.some((c) => c.rarity === 'legendary')) {
      expect(r.newPity).toBe(4);
    }
  });

  it('pity guarantee forces top rarity on max-th pack', () => {
    // pity=7 (максимум перед гарантией): последняя карта обязана стать legendary
    const r = openPack('advanced', 7);
    expect(r.pityTriggered).toBe(true);
    expect(r.cards[r.cards.length - 1].rarity).toBe('legendary');
    expect(r.newPity).toBe(0);
  });

  it('pity resets when top rarity drops naturally', () => {
    // Ищем пак с натуральной легендаркой: pity должен сброситься в 0
    for (let i = 0; i < 200; i++) {
      const r = openPack('advanced', 4);
      if (r.cards.some((c) => c.rarity === 'legendary')) {
        expect(r.newPity).toBe(0);
        return;
      }
    }
    // 200 паков по 5 карт × 2% — легендарка почти гарантирована статистически
    expect.unreachable('legendary never dropped in 200 packs');
  });

  it('basic pack has no pity counter', () => {
    const r = openPack('basic', 0);
    expect(r.newPity).toBe(0);
    expect(r.pityTriggered).toBe(false);
  });
});
