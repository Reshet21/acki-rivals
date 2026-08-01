import { describe, it, expect } from 'vitest';
import type { Card } from '../types';
import { calculateRoundAttack, resolveRound } from './battleLogic';

function makeCard(overrides: Partial<Card> & Pick<Card, 'id' | 'power' | 'damage'>): Card {
  return {
    name: `card-${overrides.id}`,
    clan: 'Неоновые Наемники',
    ability: '',
    rarity: 'common',
    ...overrides,
  };
}

describe('calculateRoundAttack', () => {
  it('is 0 for zero power regardless of pillz', () => {
    expect(calculateRoundAttack(0, 0)).toBe(0);
    expect(calculateRoundAttack(0, 3)).toBe(0);
  });

  it('scales with the pillz multiplier', () => {
    // attack = round(power * (1 + pillz) * [0.9, 1.1])
    for (let i = 0; i < 20; i++) {
      const noPillz = calculateRoundAttack(10, 0);
      expect(noPillz).toBeGreaterThanOrEqual(9);
      expect(noPillz).toBeLessThanOrEqual(11);

      const withPillz = calculateRoundAttack(10, 1);
      expect(withPillz).toBeGreaterThanOrEqual(18);
      expect(withPillz).toBeLessThanOrEqual(22);
    }
  });

  it('returns an exact value when the factor always rounds to the same integer', () => {
    // 4 * 1 * [0.9, 1.1] = [3.6, 4.4] → always rounds to 4
    for (let i = 0; i < 20; i++) {
      expect(calculateRoundAttack(4, 0)).toBe(4);
    }
  });
});

describe('resolveRound — winner determination', () => {
  it('player wins when much stronger', () => {
    const player = makeCard({ id: 1, power: 10, damage: 4 });
    const ai = makeCard({ id: 2, power: 1, damage: 1 });
    const r = resolveRound(player, 0, ai, 0);
    expect(r.winner).toBe('player');
    expect(r.damageDealt).toBe(4);
    expect(r.playerAttack).toBeGreaterThan(r.aiAttack);
  });

  it('ai wins when much stronger', () => {
    const player = makeCard({ id: 1, power: 1, damage: 1 });
    const ai = makeCard({ id: 2, power: 10, damage: 5 });
    const r = resolveRound(player, 0, ai, 0);
    expect(r.winner).toBe('ai');
    expect(r.damageDealt).toBe(5);
  });

  it('draws when attacks are equal', () => {
    const player = makeCard({ id: 1, power: 5, damage: 3 });
    const ai = makeCard({ id: 2, power: 5, damage: 3 });
    const r = resolveRound(player, 0, ai, 0);
    expect(r.winner).toBe('draw');
    expect(r.damageDealt).toBe(0);
  });
});

describe('resolveRound — abilities', () => {
  it('applies +1 power to final power', () => {
    const player = makeCard({ id: 1, power: 5, damage: 3, ability: '+1 power' });
    const ai = makeCard({ id: 2, power: 1, damage: 1 });
    const r = resolveRound(player, 0, ai, 0);
    expect(r.playerBasePower).toBe(5);
    expect(r.playerFinalPower).toBe(6);
    expect(r.winner).toBe('player');
  });

  it('stop opponent ability cancels the opponent modifier', () => {
    const player = makeCard({ id: 1, power: 3, damage: 3, ability: 'stop opponent ability' });
    const ai = makeCard({ id: 2, power: 3, damage: 3, ability: '+4 power' });
    const r = resolveRound(player, 0, ai, 0);
    // Without cancellation the ai would hit 7 power and win
    expect(r.winner).toBe('draw');
    expect(r.aiFinalPower).toBe(3);
  });

  it('double damage doubles the dealt damage on a win', () => {
    const player = makeCard({ id: 1, power: 10, damage: 4, ability: 'double damage' });
    const ai = makeCard({ id: 2, power: 1, damage: 1 });
    const r = resolveRound(player, 0, ai, 0);
    expect(r.winner).toBe('player');
    expect(r.damageDealt).toBe(8);
  });

  it('heal applies when the card loses', () => {
    const player = makeCard({ id: 1, power: 1, damage: 1, ability: 'heal 1' });
    const ai = makeCard({ id: 2, power: 10, damage: 5 });
    const r = resolveRound(player, 0, ai, 0);
    expect(r.winner).toBe('ai');
    expect(r.healAmount).toBe(1);
    expect(r.damageDealt).toBe(5);
  });

  it('poison applies when the card loses', () => {
    const player = makeCard({ id: 1, power: 1, damage: 1, ability: 'poison 1' });
    const ai = makeCard({ id: 2, power: 10, damage: 5 });
    const r = resolveRound(player, 0, ai, 0);
    expect(r.winner).toBe('ai');
    expect(r.poisonAmount).toBe(1);
  });

  it('life steal applies when the card wins', () => {
    const player = makeCard({ id: 1, power: 10, damage: 4, ability: 'life steal 1' });
    const ai = makeCard({ id: 2, power: 1, damage: 1 });
    const r = resolveRound(player, 0, ai, 0);
    expect(r.winner).toBe('player');
    expect(r.lifeStealAmount).toBe(1);
  });

  it('reduces opponent power', () => {
    const player = makeCard({ id: 1, power: 10, damage: 3, ability: '-1 opponent power' });
    const ai = makeCard({ id: 2, power: 5, damage: 3 });
    const r = resolveRound(player, 0, ai, 0);
    expect(r.aiFinalPower).toBe(4);
    expect(r.winner).toBe('player');
  });

  it('clamps power to 0', () => {
    const player = makeCard({ id: 1, power: 1, damage: 1 });
    const ai = makeCard({ id: 2, power: 10, damage: 5, ability: '-2 opponent power' });
    const r = resolveRound(player, 0, ai, 0);
    expect(r.playerFinalPower).toBe(0);
    expect(r.winner).toBe('ai');
  });

  it('armor reduces damage taken on a loss', () => {
    const player = makeCard({ id: 1, power: 1, damage: 1, ability: '-2 opponent damage' });
    const ai = makeCard({ id: 2, power: 10, damage: 5 });
    const r = resolveRound(player, 0, ai, 0);
    expect(r.winner).toBe('ai');
    expect(r.damageDealt).toBe(3);
  });

  it('armor can reduce damage to zero', () => {
    const player = makeCard({ id: 1, power: 1, damage: 1, ability: '-2 opponent damage' });
    const ai = makeCard({ id: 2, power: 10, damage: 1 });
    const r = resolveRound(player, 0, ai, 0);
    expect(r.winner).toBe('ai');
    expect(r.damageDealt).toBe(0);
  });
});

describe('resolveRound — clan bonuses', () => {
  it('neon mercs gain +1 power when 2+ are in hand', () => {
    const player = makeCard({ id: 1, power: 5, damage: 3, clan: 'Неоновые Наемники' });
    const ally = makeCard({ id: 3, power: 2, damage: 2, clan: 'Неоновые Наемники' });
    const ai = makeCard({ id: 2, power: 3, damage: 3, clan: 'Цифровые Монахи' });
    const r = resolveRound(player, 0, ai, 0, [player, ally], [ai]);
    expect(r.playerFinalPower).toBe(6); // 5 + 1 clan power
    expect(r.winner).toBe('player');
  });

  it('digital monks gain +1 damage when 2+ are in hand', () => {
    const player = makeCard({ id: 1, power: 10, damage: 4, clan: 'Цифровые Монахи' });
    const ally = makeCard({ id: 3, power: 2, damage: 2, clan: 'Цифровые Монахи' });
    const ai = makeCard({ id: 2, power: 1, damage: 1, clan: 'Неоновые Наемники' });
    const r = resolveRound(player, 0, ai, 0, [player, ally], [ai]);
    expect(r.winner).toBe('player');
    expect(r.damageDealt).toBe(5); // 4 + 1 clan damage
  });

  it('no clan bonus with a single clan card', () => {
    const player = makeCard({ id: 1, power: 5, damage: 3, clan: 'Неоновые Наемники' });
    const ai = makeCard({ id: 2, power: 3, damage: 3, clan: 'Цифровые Монахи' });
    const r = resolveRound(player, 0, ai, 0, [player], [ai]);
    expect(r.playerFinalPower).toBe(5);
  });
});

describe('resolveRound — combo abilities', () => {
  it('activates a combo when both partners are in hand', () => {
    // cards id 1 + 23 → both gain +2 power (combo_power_both)
    // partner is a different clan so the clan bonus (+1) does not interfere
    const player = makeCard({ id: 1, power: 3, damage: 2 });
    const partner = makeCard({ id: 23, power: 2, damage: 2, clan: 'Цифровые Монахи' });
    const ai = makeCard({ id: 2, power: 1, damage: 1 });
    const r = resolveRound(player, 0, ai, 0, [player, partner], [ai]);
    expect(r.playerFinalPower).toBe(5); // 3 + 2 combo
    expect(r.winner).toBe('player');
  });

  it('does not activate a combo without the partner', () => {
    const player = makeCard({ id: 1, power: 3, damage: 2 });
    const ai = makeCard({ id: 2, power: 1, damage: 1 });
    const r = resolveRound(player, 0, ai, 0, [player], [ai]);
    expect(r.playerFinalPower).toBe(3);
  });
});

describe('resolveRound — stars', () => {
  it('includes stars in final power but not base power', () => {
    const player = makeCard({ id: 1, power: 5, damage: 3, stars: 2 });
    const ai = makeCard({ id: 2, power: 1, damage: 1 });
    const r = resolveRound(player, 0, ai, 0);
    expect(r.playerBasePower).toBe(5);
    expect(r.playerFinalPower).toBe(7);
  });
});
