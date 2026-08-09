/**
 * api-lib/battle/types.ts — серверные типы боя (копия src/types.ts).
 * Изолированы от клиента: Vercel-функции не могут импортировать из src/.
 */

export type Clan = 'Неоновые Наемники' | 'Цифровые Монахи';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Card {
  id: number;
  uid?: string;
  name: string;
  clan: Clan;
  power: number;
  damage: number;
  ability: string;
  rarity: Rarity;
  stars?: number;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  apply: (ctx: AbilityContext) => AbilityResult;
}

export interface AbilityContext {
  playerCard: Card;
  playerPillz: number;
  aiCard: Card;
  aiPillz: number;
}

export interface AbilityResult {
  powerModifier?: number;
  damageModifier?: number;
  opponentPowerModifier?: number;
  opponentDamageModifier?: number;
  pillzModifier?: number;
  healModifier?: number;
  poisonModifier?: number;
  lifeStealModifier?: number;
  doubleDamage?: boolean;
  retaliateModifier?: number;
  cancelOpponentAbility?: boolean;
}

export interface RoundResult {
  winner: 'player' | 'ai' | 'draw';
  damageDealt: number;
  playerAttack: number;
  aiAttack: number;
  playerBasePower: number;
  playerFinalPower: number;
  aiBasePower: number;
  aiFinalPower: number;
  healAmount: number;
  poisonAmount: number;
  lifeStealAmount: number;
  opponentDamageReduction: number;
}
