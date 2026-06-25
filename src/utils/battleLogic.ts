import type { Card, RoundResult } from '../types';
import { getAbility } from '../data/abilities';

// Urban Rivals: Attack = Power × Pillz × random(0.9, 1.1)
function randomFactor(): number {
  return 0.9 + Math.random() * 0.2;
}

export function calculateRoundAttack(power: number, pillz: number): number {
  return Math.round(power * pillz * randomFactor());
}

export function resolveRound(
  playerCard: Card,
  playerPillz: number,
  aiCard: Card,
  aiPillz: number,
): RoundResult {
  let playerPower = playerCard.power + (playerCard.stars ?? 0);
  let playerDamage = playerCard.damage + (playerCard.stars ?? 0);
  let aiPower = aiCard.power + (aiCard.stars ?? 0);
  let aiDamage = aiCard.damage + (aiCard.stars ?? 0);

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

  // Cancel opponent abilities
  if (playerAbilityResult?.cancelOpponentAbility) {
    aiAbilityResult = undefined;
  }
  if (aiAbilityResult?.cancelOpponentAbility) {
    playerAbilityResult = undefined;
  }

  // Apply power modifiers
  if (playerAbilityResult) {
    playerPower += playerAbilityResult.powerModifier ?? 0;
    playerPower += playerAbilityResult.opponentPowerModifier ?? 0;
  }
  if (aiAbilityResult) {
    aiPower += aiAbilityResult.powerModifier ?? 0;
    aiPower += aiAbilityResult.opponentPowerModifier ?? 0;
  }

  // Apply damage modifiers
  if (playerAbilityResult) {
    playerDamage += playerAbilityResult.damageModifier ?? 0;
  }
  if (aiAbilityResult) {
    aiDamage += aiAbilityResult.damageModifier ?? 0;
  }

  // Clamp
  playerPower = Math.max(0, playerPower);
  aiPower = Math.max(0, aiPower);
  playerDamage = Math.max(0, playerDamage);
  aiDamage = Math.max(0, aiDamage);

  const playerAttack = calculateRoundAttack(playerPower, playerPillz);
  const aiAttack = calculateRoundAttack(aiPower, aiPillz);

  let winner: 'player' | 'ai' | 'draw' = 'draw';
  let damage = 0;

  if (playerAttack > aiAttack) {
    winner = 'player';
    damage = playerDamage;
  } else if (aiAttack > playerAttack) {
    winner = 'ai';
    damage = aiDamage;
  }

  // Compute secondary effects
  let healAmount = 0;
  let poisonAmount = 0;
  let lifeStealAmount = 0;
  let opponentDamageReduction = 0;

  if (winner === 'player') {
    lifeStealAmount = playerAbilityResult?.lifeStealModifier ?? 0;
    healAmount = aiAbilityResult?.healModifier ?? 0;
    poisonAmount = aiAbilityResult?.poisonModifier ?? 0;
    opponentDamageReduction = aiAbilityResult?.opponentDamageModifier ?? 0;
  } else if (winner === 'ai') {
    lifeStealAmount = aiAbilityResult?.lifeStealModifier ?? 0;
    healAmount = playerAbilityResult?.healModifier ?? 0;
    poisonAmount = playerAbilityResult?.poisonModifier ?? 0;
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
