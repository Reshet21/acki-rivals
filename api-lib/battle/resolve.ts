/**
 * api-lib/battle/resolve.ts — серверный резолв PvP-раунда.
 * Байт-в-байт копия src/utils/battleLogic.ts + src/services/pvpResolution.ts,
 * изолированная от клиента. Резолв происходит ТОЛЬКО на сервере —
 * клиент не может подменить результат.
 */
import type { Card, RoundResult } from './types.js';
import { getAbility } from './abilities.js';
import { clanBonuses, comboAbilities } from './cards.js';

function randomFactor(): number {
  return 0.9 + Math.random() * 0.2;
}

export function calculateRoundAttack(power: number, pillz: number): number {
  return Math.round(power * (1 + pillz) * randomFactor());
}

function applyClanBonus(hand: Card[], card: Card): { powerBonus: number; damageBonus: number } {
  const sameClanCount = hand.filter((c) => c.clan === card.clan).length;
  if (sameClanCount < 2) return { powerBonus: 0, damageBonus: 0 };

  const bonus = clanBonuses[card.clan];
  if (!bonus) return { powerBonus: 0, damageBonus: 0 };

  if (bonus.effect === 'clan_power') return { powerBonus: bonus.value, damageBonus: 0 };
  if (bonus.effect === 'clan_damage') return { powerBonus: 0, damageBonus: bonus.value };
  return { powerBonus: 0, damageBonus: 0 };
}

function applyCombo(hand: Card[], card: Card): { powerBonus: number; damageBonus: number; extraHeal: number; extraPoison: number } {
  let powerBonus = 0;
  let damageBonus = 0;
  let extraHeal = 0;
  let extraPoison = 0;

  for (const combo of comboAbilities) {
    const hasCard1 = hand.some((c) => c.id === combo.card1);
    const hasCard2 = hand.some((c) => c.id === combo.card2);
    if (!hasCard1 || !hasCard2) continue;

    const isCard1 = card.id === combo.card1;
    const isCard2 = card.id === combo.card2;

    switch (combo.effect) {
      case 'combo_power_both':
        if (isCard1 || isCard2) powerBonus += combo.value;
        break;
      case 'combo_power_1':
        if (isCard1) powerBonus += combo.value;
        break;
      case 'combo_damage_both':
        if (isCard1 || isCard2) damageBonus += combo.value;
        break;
      case 'combo_damage_1':
        if (isCard1) damageBonus += combo.value;
        break;
      case 'combo_heal_both':
        if (isCard1 || isCard2) extraHeal += combo.value;
        break;
      case 'combo_heal_1':
        if (isCard1) extraHeal += combo.value;
        break;
      case 'combo_poison_both':
        if (isCard1 || isCard2) extraPoison += combo.value;
        break;
      case 'combo_lifesteal_both':
        if (isCard1 || isCard2) extraHeal += combo.value;
        break;
    }
  }

  return { powerBonus, damageBonus, extraHeal, extraPoison };
}

export function resolveRound(
  playerCard: Card,
  playerPillz: number,
  aiCard: Card,
  aiPillz: number,
  playerHand?: Card[],
  aiHand?: Card[],
): RoundResult {
  const pH = playerHand || [playerCard];
  const aH = aiHand || [aiCard];

  let playerPower = playerCard.power + (playerCard.stars ?? 0);
  let playerDamage = playerCard.damage + (playerCard.stars ?? 0);
  let aiPower = aiCard.power + (aiCard.stars ?? 0);
  let aiDamage = aiCard.damage + (aiCard.stars ?? 0);

  const pClan = applyClanBonus(pH, playerCard);
  const aClan = applyClanBonus(aH, aiCard);
  playerPower += pClan.powerBonus;
  playerDamage += pClan.damageBonus;
  aiPower += aClan.powerBonus;
  aiDamage += aClan.damageBonus;

  const pCombo = applyCombo(pH, playerCard);
  const aCombo = applyCombo(aH, aiCard);
  playerPower += pCombo.powerBonus;
  playerDamage += pCombo.damageBonus;
  aiPower += aCombo.powerBonus;
  aiDamage += aCombo.damageBonus;

  const playerAbility = getAbility(playerCard.ability);
  const aiAbility = getAbility(aiCard.ability);

  let playerAbilityResult = playerAbility?.apply({
    playerCard,
    playerPillz,
    aiCard,
    aiPillz,
  });
  let aiAbilityResult = aiAbility?.apply({
    playerCard: aiCard,
    playerPillz: aiPillz,
    aiCard: playerCard,
    aiPillz: playerPillz,
  });

  if (playerAbilityResult?.cancelOpponentAbility) aiAbilityResult = undefined;
  if (aiAbilityResult?.cancelOpponentAbility) playerAbilityResult = undefined;

  if (playerAbilityResult) {
    playerPower += playerAbilityResult.powerModifier ?? 0;
    aiPower += playerAbilityResult.opponentPowerModifier ?? 0;
  }
  if (aiAbilityResult) {
    aiPower += aiAbilityResult.powerModifier ?? 0;
    playerPower += aiAbilityResult.opponentPowerModifier ?? 0;
  }
  if (playerAbilityResult) playerDamage += playerAbilityResult.damageModifier ?? 0;
  if (aiAbilityResult) aiDamage += aiAbilityResult.damageModifier ?? 0;

  playerPower = Math.max(0, playerPower);
  aiPower = Math.max(0, aiPower);
  playerDamage = Math.max(0, playerDamage);
  aiDamage = Math.max(0, aiDamage);

  const playerAttack = calculateRoundAttack(playerPower, playerPillz);
  const aiAttack = calculateRoundAttack(aiPower, aiPillz);

  let winner: 'player' | 'ai' | 'draw' = 'draw';
  let damage = 0;

  if (playerAttack > aiAttack) { winner = 'player'; damage = playerDamage; }
  else if (aiAttack > playerAttack) { winner = 'ai'; damage = aiDamage; }

  if (winner === 'player' && playerAbilityResult?.doubleDamage) damage *= 2;
  if (winner === 'ai' && aiAbilityResult?.doubleDamage) damage *= 2;

  let healAmount = 0;
  let poisonAmount = 0;
  let lifeStealAmount = 0;
  let opponentDamageReduction = 0;

  if (winner === 'player') {
    lifeStealAmount = (playerAbilityResult?.lifeStealModifier ?? 0) + pCombo.extraHeal;
    healAmount = aiAbilityResult?.healModifier ?? 0;
    poisonAmount = (aiAbilityResult?.poisonModifier ?? 0) + aCombo.extraPoison;
    opponentDamageReduction = aiAbilityResult?.opponentDamageModifier ?? 0;
  } else if (winner === 'ai') {
    lifeStealAmount = (aiAbilityResult?.lifeStealModifier ?? 0) + aCombo.extraHeal;
    healAmount = playerAbilityResult?.healModifier ?? 0;
    poisonAmount = (playerAbilityResult?.poisonModifier ?? 0) + pCombo.extraPoison;
    opponentDamageReduction = playerAbilityResult?.opponentDamageModifier ?? 0;
  }

  damage = Math.max(0, damage + opponentDamageReduction);

  return {
    winner,
    damageDealt: damage,
    playerAttack,
    aiAttack,
    playerBasePower: playerCard.power,
    playerFinalPower: playerPower,
    aiBasePower: aiCard.power,
    aiFinalPower: aiPower,
    healAmount,
    poisonAmount,
    lifeStealAmount,
    opponentDamageReduction,
  };
}

export interface PvpRoundResult {
  hostCardId: number;
  guestCardId: number;
  hostPillzUsed: number;
  guestPillzUsed: number;
  hostAttack: number;
  guestAttack: number;
  hostBasePower: number;
  hostFinalPower: number;
  guestBasePower: number;
  guestFinalPower: number;
  winner: 'host' | 'guest' | 'draw';
  damage: number;
  healAmount: number;
  poisonAmount: number;
  lifeStealAmount: number;
  opponentDamageReduction: number;
}

export interface PvpRoundInput {
  hostCard: Card;
  hostPillz: number;
  guestCard: Card;
  guestPillz: number;
  hostDeck: Card[];
  guestDeck: Card[];
}

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

export interface DamageOutcome {
  hostHP: number;
  guestHP: number;
  ended: boolean;
}

/**
 * Применяет результат раунда к HP (host/guest). Тот же порядок, что в
 * applyRoundDamage из src (см. pvpResolution.ts): damage → heal → steal → poison.
 */
export function applyRoundDamageToState(hostHP: number, guestHP: number, rr: PvpRoundResult, totalHP: number): DamageOutcome {
  let h = hostHP;
  let g = guestHP;

  if (rr.winner === 'host') {
    g = Math.max(0, g - rr.damage);
    g = Math.min(totalHP, g + rr.healAmount);
    h = Math.min(totalHP, h + rr.lifeStealAmount);
    g = Math.max(0, g - rr.poisonAmount);
  } else if (rr.winner === 'guest') {
    h = Math.max(0, h - rr.damage);
    h = Math.min(totalHP, h + rr.healAmount);
    g = Math.min(totalHP, g + rr.lifeStealAmount);
    h = Math.max(0, h - rr.poisonAmount);
  }

  return { hostHP: h, guestHP: g, ended: h <= 0 || g <= 0 };
}
