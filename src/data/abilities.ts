import type { Ability, AbilityResult } from '../types';

export const abilities: Ability[] = [
  // ═══════════════════════════════════════
  //  POWER MODIFIERS
  // ═══════════════════════════════════════
  {
    id: '+1 power',
    name: 'Укрепление',
    description: '+1 к своей силе.',
    apply: (): AbilityResult => ({ powerModifier: 1 }),
  },
  {
    id: '+2 power',
    name: 'Боевой дух',
    description: '+2 к своей силе.',
    apply: (): AbilityResult => ({ powerModifier: 2 }),
  },
  {
    id: '+3 power',
    name: 'Трансценденция',
    description: '+3 к своей силе.',
    apply: (): AbilityResult => ({ powerModifier: 3 }),
  },

  // ═══════════════════════════════════════
  //  OPPONENT POWER DEBUFFS
  // ═══════════════════════════════════════
  {
    id: '-1 opponent power',
    name: 'Ослабление',
    description: '-1 к силе противника.',
    apply: (): AbilityResult => ({ opponentPowerModifier: -1 }),
  },
  {
    id: '-2 opponent power',
    name: 'Подавление',
    description: '-2 к силе противника.',
    apply: (): AbilityResult => ({ opponentPowerModifier: -2 }),
  },

  // ═══════════════════════════════════════
  //  DAMAGE MODIFIERS
  // ═══════════════════════════════════════
  {
    id: '+1 damage',
    name: 'Усиление удара',
    description: '+1 к своему урону при победе.',
    apply: (): AbilityResult => ({ damageModifier: 1 }),
  },
  {
    id: '-2 opponent damage',
    name: 'Броня',
    description: '-2 к урону противника.',
    apply: (): AbilityResult => ({ opponentDamageModifier: -2 }),
  },

  // ═══════════════════════════════════════
  //  RESOURCE
  // ═══════════════════════════════════════
  {
    id: '+1 pillz',
    name: 'Запас',
    description: '+1 пиллз на этот раунд.',
    apply: (): AbilityResult => ({ pillzModifier: 1 }),
  },

  // ═══════════════════════════════════════
  //  SUSTAIN / HEAL
  // ═══════════════════════════════════════
  {
    id: 'heal 1',
    name: 'Первая помощь',
    description: 'Восстанови 1 HP при проигрыше.',
    apply: (): AbilityResult => ({ healModifier: 1 }),
  },
  {
    id: 'heal 2',
    name: 'Регенерация',
    description: 'Восстанови 2 HP при проигрыше.',
    apply: (): AbilityResult => ({ healModifier: 2 }),
  },

  // ═══════════════════════════════════════
  //  DAMAGE OVER TIME
  // ═══════════════════════════════════════
  {
    id: 'poison 1',
    name: 'Токсин',
    description: '+1 доп. урона при проигрыше.',
    apply: (): AbilityResult => ({ poisonModifier: 1 }),
  },
  {
    id: 'poison 2',
    description: '+2 доп. урона при проигрыше.',
    name: 'Яд',
    apply: (): AbilityResult => ({ poisonModifier: 2 }),
  },

  // ═══════════════════════════════════════
  //  LIFE STEAL
  // ═══════════════════════════════════════
  {
    id: 'life steal 1',
    name: 'Вытягивание жизни',
    description: 'Восстанови 1 HP при победе.',
    apply: (): AbilityResult => ({ lifeStealModifier: 1 }),
  },

  // ═══════════════════════════════════════
  //  SPECIAL
  // ═══════════════════════════════════════
  {
    id: 'stop opponent ability',
    name: 'Глушитель',
    description: 'Отменяет способность противника.',
    apply: (): AbilityResult => ({ cancelOpponentAbility: true }),
  },
];

export function getAbility(id: string): Ability | undefined {
  return abilities.find((a) => a.id === id);
}
