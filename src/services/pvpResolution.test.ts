import { describe, it, expect } from 'vitest';
import type { Card, RoundResult } from '../types';
import {
  resolvePvpRound,
  roundResultForView,
  applyRoundDamage,
  winnerFromHP,
  type PvpRoundResult,
} from './pvpResolution';

function makeCard(overrides: Partial<Card> & Pick<Card, 'id' | 'power' | 'damage'>): Card {
  return {
    name: `card-${overrides.id}`,
    clan: 'Неоновые Наемники',
    ability: '',
    rarity: 'common',
    ...overrides,
  };
}

function makeRoundResult(overrides: Partial<PvpRoundResult> = {}): PvpRoundResult {
  return {
    hostCardId: 1, guestCardId: 2, hostPillzUsed: 0, guestPillzUsed: 0,
    hostAttack: 10, guestAttack: 5, hostBasePower: 5, hostFinalPower: 5,
    guestBasePower: 3, guestFinalPower: 3, winner: 'host', damage: 4,
    healAmount: 0, poisonAmount: 0, lifeStealAmount: 0, opponentDamageReduction: 0,
    ...overrides,
  };
}

function makeViewResult(overrides: Partial<RoundResult> = {}): RoundResult {
  return {
    winner: 'draw', damageDealt: 0, playerAttack: 0, aiAttack: 0,
    playerBasePower: 0, playerFinalPower: 0, aiBasePower: 0, aiFinalPower: 0,
    healAmount: 0, poisonAmount: 0, lifeStealAmount: 0, opponentDamageReduction: 0,
    ...overrides,
  };
}

describe('resolvePvpRound', () => {
  it('maps a player win to a host win with host/guest fields', () => {
    const host = makeCard({ id: 1, power: 10, damage: 4 });
    const guest = makeCard({ id: 2, power: 1, damage: 1 });
    const rr = resolvePvpRound({
      hostCard: host, hostPillz: 2,
      guestCard: guest, guestPillz: 0,
      hostDeck: [host], guestDeck: [guest],
    });
    expect(rr.winner).toBe('host');
    expect(rr.hostCardId).toBe(1);
    expect(rr.guestCardId).toBe(2);
    expect(rr.hostPillzUsed).toBe(2);
    expect(rr.guestPillzUsed).toBe(0);
    expect(rr.hostBasePower).toBe(10);
    expect(rr.guestBasePower).toBe(1);
    expect(rr.damage).toBe(4);
  });

  it('maps an ai win to a guest win', () => {
    const host = makeCard({ id: 1, power: 1, damage: 1 });
    const guest = makeCard({ id: 2, power: 10, damage: 5 });
    const rr = resolvePvpRound({
      hostCard: host, hostPillz: 0,
      guestCard: guest, guestPillz: 0,
      hostDeck: [host], guestDeck: [guest],
    });
    expect(rr.winner).toBe('guest');
    expect(rr.damage).toBe(5);
  });

  it('maps a draw to a draw', () => {
    const host = makeCard({ id: 1, power: 5, damage: 3 });
    const guest = makeCard({ id: 2, power: 5, damage: 3 });
    const rr = resolvePvpRound({
      hostCard: host, hostPillz: 0,
      guestCard: guest, guestPillz: 0,
      hostDeck: [host], guestDeck: [guest],
    });
    expect(rr.winner).toBe('draw');
    expect(rr.damage).toBe(0);
  });
});

describe('roundResultForView', () => {
  it('host perspective of a host win', () => {
    const rr = makeRoundResult({
      winner: 'host', hostAttack: 10, guestAttack: 5,
      hostBasePower: 7, hostFinalPower: 8,
      guestBasePower: 3, guestFinalPower: 2,
      damage: 4,
    });
    const view = roundResultForView(rr, 'host');
    expect(view.winner).toBe('player');
    expect(view.playerAttack).toBe(10);
    expect(view.aiAttack).toBe(5);
    expect(view.playerBasePower).toBe(7);
    expect(view.playerFinalPower).toBe(8);
    expect(view.aiBasePower).toBe(3);
    expect(view.aiFinalPower).toBe(2);
    expect(view.damageDealt).toBe(4);
  });

  it('guest perspective of the same host win swaps host/guest', () => {
    const rr = makeRoundResult({
      winner: 'host', hostAttack: 10, guestAttack: 5,
      hostBasePower: 7, hostFinalPower: 8,
      guestBasePower: 3, guestFinalPower: 2,
    });
    const view = roundResultForView(rr, 'guest');
    expect(view.winner).toBe('ai');
    expect(view.playerAttack).toBe(5);
    expect(view.aiAttack).toBe(10);
    expect(view.playerBasePower).toBe(3);
    expect(view.playerFinalPower).toBe(2);
    expect(view.aiBasePower).toBe(7);
    expect(view.aiFinalPower).toBe(8);
  });

  it('draw stays draw for both perspectives', () => {
    const rr = makeRoundResult({ winner: 'draw' });
    expect(roundResultForView(rr, 'host').winner).toBe('draw');
    expect(roundResultForView(rr, 'guest').winner).toBe('draw');
  });

  it('guest win shows player perspective as the guest', () => {
    const rr = makeRoundResult({ winner: 'guest', hostAttack: 3, guestAttack: 9, damage: 5 });
    const view = roundResultForView(rr, 'guest');
    expect(view.winner).toBe('player');
    expect(view.playerAttack).toBe(9);
    expect(view.aiAttack).toBe(3);
    expect(view.damageDealt).toBe(5);
  });

  it('round-trips with resolvePvpRound for the host', () => {
    const host = makeCard({ id: 1, power: 10, damage: 4, ability: '+1 power' });
    const guest = makeCard({ id: 2, power: 1, damage: 1 });
    const rr = resolvePvpRound({
      hostCard: host, hostPillz: 0,
      guestCard: guest, guestPillz: 0,
      hostDeck: [host], guestDeck: [guest],
    });
    const view = roundResultForView(rr, 'host');
    expect(view.winner).toBe('player');
    expect(view.playerBasePower).toBe(10);
    expect(view.playerFinalPower).toBe(11);
    expect(view.aiBasePower).toBe(1);
    expect(view.aiFinalPower).toBe(1);
    expect(view.damageDealt).toBe(4);
  });
});

describe('applyRoundDamage', () => {
  it('player win: damage → loser heals → winner lifesteals → loser poisoned', () => {
    const r = makeViewResult({
      winner: 'player', damageDealt: 4, healAmount: 2,
      lifeStealAmount: 1, poisonAmount: 1,
    });
    const out = applyRoundDamage(10, 10, r, 12);
    // opp: 10 − 4 = 6 → +2 heal = 8 → −1 poison = 7
    expect(out.oppHP).toBe(7);
    // mine: 10 + 1 lifesteal = 11
    expect(out.myHP).toBe(11);
    expect(out.ended).toBe(false);
  });

  it('ai win mirrors the same logic', () => {
    const r = makeViewResult({
      winner: 'ai', damageDealt: 4, healAmount: 2,
      lifeStealAmount: 1, poisonAmount: 1,
    });
    const out = applyRoundDamage(10, 10, r, 12);
    expect(out.myHP).toBe(7);
    expect(out.oppHP).toBe(11);
  });

  it('draw leaves HP unchanged', () => {
    const out = applyRoundDamage(7, 9, makeViewResult({ winner: 'draw' }), 12);
    expect(out.myHP).toBe(7);
    expect(out.oppHP).toBe(9);
    expect(out.ended).toBe(false);
  });

  it('clamps opponent to 0 and flags ended', () => {
    const r = makeViewResult({ winner: 'player', damageDealt: 20 });
    const out = applyRoundDamage(5, 3, r, 12);
    expect(out.oppHP).toBe(0);
    expect(out.ended).toBe(true);
  });

  it('caps heal at total HP', () => {
    const r = makeViewResult({ winner: 'ai', healAmount: 5, damageDealt: 0 });
    const out = applyRoundDamage(10, 10, r, 12);
    expect(out.myHP).toBe(12);
  });

  it('clamps opponent to 0 when damage + poison exceed HP', () => {
    const r = makeViewResult({ winner: 'player', damageDealt: 2, poisonAmount: 5 });
    const out = applyRoundDamage(10, 3, r, 12);
    // opp: 3 − 2 = 1 → −5 → clamp 0
    expect(out.oppHP).toBe(0);
    expect(out.ended).toBe(true);
  });
});

describe('winnerFromHP', () => {
  it('returns win/loss/draw based on remaining HP', () => {
    expect(winnerFromHP(5, 0)).toBe('win');
    expect(winnerFromHP(0, 5)).toBe('loss');
    expect(winnerFromHP(0, 0)).toBe('draw');
    expect(winnerFromHP(3, 3)).toBe('draw');
    expect(winnerFromHP(1, 0)).toBe('win');
  });
});
