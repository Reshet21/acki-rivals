/**
 * api-lib/battle/abilities.ts — способности карт (серверная копия src/data/abilities.ts).
 */
import type { Ability, AbilityResult } from './types.js';

export const abilities: Ability[] = [
  { id: '+1 power', name: 'Укрепление', description: '+1 к своей силе.', apply: (): AbilityResult => ({ powerModifier: 1 }) },
  { id: '+1 pillz', name: 'Запас', description: '+1 пиллз на этот раунд.', apply: (): AbilityResult => ({ pillzModifier: 1 }) },
  { id: '-1 opponent power', name: 'Ослабление', description: '-1 к силе противника.', apply: (): AbilityResult => ({ opponentPowerModifier: -1 }) },
  { id: '-2 opponent damage', name: 'Броня', description: '-2 к урону противника.', apply: (): AbilityResult => ({ opponentDamageModifier: -2 }) },
  { id: 'heal 1', name: 'Первая помощь', description: 'Восстанови 1 HP при проигрыше.', apply: (): AbilityResult => ({ healModifier: 1 }) },
  { id: 'poison 1', name: 'Токсин', description: '+1 доп. урона при проигрыше.', apply: (): AbilityResult => ({ poisonModifier: 1 }) },
  { id: '+2 power', name: 'Боевой дух', description: '+2 к своей силе.', apply: (): AbilityResult => ({ powerModifier: 2 }) },
  { id: '+1 damage', name: 'Усиление удара', description: '+1 к своему урону при победе.', apply: (): AbilityResult => ({ damageModifier: 1 }) },
  { id: 'heal 2', name: 'Регенерация', description: 'Восстанови 2 HP при проигрыше.', apply: (): AbilityResult => ({ healModifier: 2 }) },
  { id: 'poison 2', name: 'Яд', description: '+2 доп. урона при проигрыше.', apply: (): AbilityResult => ({ poisonModifier: 2 }) },
  { id: 'life steal 1', name: 'Вытягивание жизни', description: 'Восстанови 1 HP при победе.', apply: (): AbilityResult => ({ lifeStealModifier: 1 }) },
  { id: '-2 opponent power', name: 'Подавление', description: '-2 к силе противника.', apply: (): AbilityResult => ({ opponentPowerModifier: -2 }) },
  { id: '+3 power', name: 'Трансценденция', description: '+3 к своей силе.', apply: (): AbilityResult => ({ powerModifier: 3 }) },
  { id: '+2 damage', name: 'Критический удар', description: '+2 к своему урону при победе.', apply: (): AbilityResult => ({ damageModifier: 2 }) },
  { id: 'heal 3', name: 'Божественное исцеление', description: 'Восстанови 3 HP при проигрыше.', apply: (): AbilityResult => ({ healModifier: 3 }) },
  { id: 'poison 3', name: 'Чума', description: '+3 доп. урона при проигрыше.', apply: (): AbilityResult => ({ poisonModifier: 3 }) },
  { id: 'life steal 2', name: 'Кража жизни', description: 'Восстанови 2 HP при победе.', apply: (): AbilityResult => ({ lifeStealModifier: 2 }) },
  { id: '+3 pillz', name: 'Арсенал', description: '+3 пиллз на этот раунд.', apply: (): AbilityResult => ({ pillzModifier: 3 }) },
  { id: 'stop opponent ability', name: 'Глушитель', description: 'Отменяет способность противника.', apply: (): AbilityResult => ({ cancelOpponentAbility: true }) },
  { id: '+4 power', name: 'Абсолютная сила', description: '+4 к своей силе.', apply: (): AbilityResult => ({ powerModifier: 4 }) },
  { id: 'double damage', name: 'Двойной удар', description: 'Урон удваивается при победе.', apply: (): AbilityResult => ({ doubleDamage: true }) },
  { id: 'life steal 3', name: 'Вампиризм', description: 'Восстанови 3 HP при победе.', apply: (): AbilityResult => ({ lifeStealModifier: 3 }) },
];

export function getAbility(id: string): Ability | undefined {
  return abilities.find((a) => a.id === id);
}
