/**
 * pvpResolution.ts
 *
 * Чистая логика PvP-резолвинга раунда, вынесенная из PvpBattleScreen.
 * Всё здесь — чистые функции: одинаковые входы → одинаковые выходы,
 * поэтому их можно юнит-тестировать без React и Supabase.
 */

import type { Card, RoundResult } from '../types';
import { resolveRound } from '../utils/battleLogic';
import type { GameState } from './pvpService';

export type PvpRoundResult = NonNullable<GameState['roundResult']>;

export interface PvpRoundInput {
  hostCard: Card;
  hostPillz: number;
  guestCard: Card;
  guestPillz: number;
  hostDeck: Card[];
  guestDeck: Card[];
}

/** Host резолвит раунд: resolveRound + маппинг player/ai → host/guest. */
export function resolvePvpRound(input: PvpRoundInput): PvpRoundResult {
  const r = resolveRound(
    input.hostCard, input.hostPillz,
    input.guestCard, input.guestPillz,
    input.hostDeck, input.guestDeck,
  );
  return {
    hostCardId: input.hostCard.id,
    guestCardId: input.guestCard.id,
    hostPillzUsed: input.hostPillz,
    guestPillzUsed: input.guestPillz,
    hostAttack: r.playerAttack,
    guestAttack: r.aiAttack,
    hostBasePower: r.playerBasePower,
    hostFinalPower: r.playerFinalPower,
    guestBasePower: r.aiBasePower,
    guestFinalPower: r.aiFinalPower,
    winner: r.winner === 'player' ? 'host' : r.winner === 'ai' ? 'guest' : 'draw',
    damage: r.damageDealt,
    healAmount: r.healAmount,
    poisonAmount: r.poisonAmount,
    lifeStealAmount: r.lifeStealAmount,
    opponentDamageReduction: r.opponentDamageReduction,
  };
}

/** Представление раунда для конкретного игрока (host/guest → player/ai). */
export function roundResultForView(rr: PvpRoundResult, perspective: 'host' | 'guest'): RoundResult {
  const isGuest = perspective === 'guest';
  return {
    winner: rr.winner === 'draw' ? 'draw'
      : isGuest ? (rr.winner === 'guest' ? 'player' : 'ai')
        : (rr.winner === 'host' ? 'player' : 'ai'),
    damageDealt: rr.damage,
    playerAttack: isGuest ? rr.guestAttack : rr.hostAttack,
    aiAttack: isGuest ? rr.hostAttack : rr.guestAttack,
    playerBasePower: isGuest ? rr.guestBasePower : rr.hostBasePower,
    playerFinalPower: isGuest ? rr.guestFinalPower : rr.hostFinalPower,
    aiBasePower: isGuest ? rr.hostBasePower : rr.guestBasePower,
    aiFinalPower: isGuest ? rr.hostFinalPower : rr.guestFinalPower,
    healAmount: rr.healAmount,
    poisonAmount: rr.poisonAmount,
    lifeStealAmount: rr.lifeStealAmount,
    opponentDamageReduction: rr.opponentDamageReduction,
  };
}

export interface DamageOutcome {
  myHP: number;
  oppHP: number;
  ended: boolean;
}

/**
 * Применяет результат раунда к HP (с точки зрения одного игрока).
 *
 * Порядок применения (воспроизводит оригинальный код в PvpBattleScreen):
 *   1. damage → проигравший получает урон
 *   2. heal  → проигравший лечится (cap totalHP)
 *   3. life steal → победитель вампирит (cap totalHP)
 *   4. poison → проигравший дополнительно отравлен
 */
export function applyRoundDamage(
  myHP: number,
  oppHP: number,
  result: RoundResult,
  totalHP: number,
): DamageOutcome {
  let mine = myHP;
  let theirs = oppHP;

  if (result.winner === 'player') {
    theirs = Math.max(0, theirs - result.damageDealt);
    theirs = Math.min(totalHP, theirs + result.healAmount);
    mine = Math.min(totalHP, mine + result.lifeStealAmount);
    theirs = Math.max(0, theirs - result.poisonAmount);
  } else if (result.winner === 'ai') {
    mine = Math.max(0, mine - result.damageDealt);
    mine = Math.min(totalHP, mine + result.healAmount);
    theirs = Math.min(totalHP, theirs + result.lifeStealAmount);
    mine = Math.max(0, mine - result.poisonAmount);
  }

  return { myHP: mine, oppHP: theirs, ended: mine <= 0 || theirs <= 0 };
}

/** Исход боя по оставшемуся HP (возвращает результат с точки зрения игрока). */
export function winnerFromHP(myHP: number, oppHP: number): 'win' | 'loss' | 'draw' {
  if (myHP > oppHP) return 'win';
  if (oppHP > myHP) return 'loss';
  return 'draw';
}
