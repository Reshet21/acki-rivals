import type { Card } from '../types';

export const cards: Card[] = [
  // ═══════════════════════════════════════════
  //  НЕОНОВЫЕ НАЕМНИКИ — атакующий клан
  //  Бонус клана: +1 к силе всех карт
  // ═══════════════════════════════════════════

  // Common (6)
  { id: 1, name: 'Малый Блок', clan: 'Неоновые Наемники', power: 3, damage: 2, ability: '+1 pillz', rarity: 'common' },
  { id: 2, name: 'Нода-Разведчик', clan: 'Неоновые Наемники', power: 3, damage: 3, ability: '+1 power', rarity: 'common' },
  { id: 3, name: 'Хакер Блока', clan: 'Неоновые Наемники', power: 2, damage: 4, ability: '-1 opponent power', rarity: 'common' },
  { id: 4, name: 'Транзакция', clan: 'Неоновые Наемники', power: 4, damage: 3, ability: '-2 opponent damage', rarity: 'common' },
  { id: 23, name: 'Курьер Хешей', clan: 'Неоновые Наемники', power: 2, damage: 2, ability: '+1 pillz', rarity: 'common' },
  { id: 35, name: 'Мемпул Разведчик', clan: 'Неоновые Наемники', power: 3, damage: 2, ability: '+1 power', rarity: 'common' },

  // Uncommon (5)
  { id: 19, name: 'Фантомная Нода', clan: 'Неоновые Наемники', power: 4, damage: 4, ability: '+2 power', rarity: 'uncommon' },
  { id: 20, name: 'Валидатор', clan: 'Неоновые Наемники', power: 5, damage: 3, ability: '+1 damage', rarity: 'uncommon' },
  { id: 24, name: 'Рейдер Мемпула', clan: 'Неоновые Наемники', power: 4, damage: 3, ability: 'life steal 1', rarity: 'uncommon' },
  { id: 25, name: 'Диверсант Цепи', clan: 'Неоновые Наемники', power: 3, damage: 5, ability: 'poison 1', rarity: 'uncommon' },
  { id: 36, name: 'Саботажник Форков', clan: 'Неоновые Наемники', power: 4, damage: 4, ability: '-1 opponent power', rarity: 'uncommon' },

  // Rare (5)
  { id: 5, name: 'Хеш-Волк', clan: 'Неоновые Наемники', power: 6, damage: 3, ability: '+2 power', rarity: 'rare' },
  { id: 6, name: 'Рыцарь Цепи', clan: 'Неоновые Наемники', power: 5, damage: 4, ability: '+1 damage', rarity: 'rare' },
  { id: 7, name: 'Тень Блока', clan: 'Неоновые Наемники', power: 4, damage: 5, ability: 'life steal 1', rarity: 'rare' },
  { id: 26, name: 'Убийца Нод', clan: 'Неоновые Наемники', power: 5, damage: 5, ability: '+2 power', rarity: 'rare' },
  { id: 37, name: 'Шторм Консенсуса', clan: 'Неоновые Наемники', power: 6, damage: 4, ability: '+2 damage', rarity: 'rare' },

  // Epic (3)
  { id: 17, name: 'Император Блоков', clan: 'Неоновые Наемники', power: 7, damage: 5, ability: '+3 power', rarity: 'epic' },
  { id: 27, name: 'Паладин Валидации', clan: 'Неоновые Наемники', power: 6, damage: 6, ability: 'life steal 2', rarity: 'epic' },
  { id: 38, name: 'Адмирал Цепи', clan: 'Неоновые Наемники', power: 7, damage: 6, ability: '+2 damage', rarity: 'epic' },

  // Legendary (3)
  { id: 8, name: 'Гиперблок', clan: 'Неоновые Наемники', power: 8, damage: 5, ability: 'stop opponent ability', rarity: 'legendary' },
  { id: 28, name: 'Бог Блокчейна', clan: 'Неоновые Наемники', power: 9, damage: 6, ability: '+4 power', rarity: 'legendary' },
  { id: 39, name: 'Дракон Консенсуса', clan: 'Неоновые Наемники', power: 8, damage: 7, ability: 'double damage', rarity: 'legendary' },

  // ═══════════════════════════════════════════
  //  ЦИФРОВЫЕ МОНАХИ — supportive клан
  //  Бонус клана: +1 к урону всех карт
  // ═══════════════════════════════════════════

  // Common (6)
  { id: 9, name: 'Малый Хеш', clan: 'Цифровые Монахи', power: 2, damage: 3, ability: '+1 power', rarity: 'common' },
  { id: 10, name: 'Медитативная Нода', clan: 'Цифровые Монахи', power: 3, damage: 2, ability: 'heal 1', rarity: 'common' },
  { id: 11, name: 'Послушник Цепи', clan: 'Цифровые Монахи', power: 4, damage: 2, ability: '-1 opponent power', rarity: 'common' },
  { id: 12, name: 'Тотем Блока', clan: 'Цифровые Монахи', power: 2, damage: 4, ability: 'poison 1', rarity: 'common' },
  { id: 29, name: 'Страж Эпохи', clan: 'Цифровые Монахи', power: 3, damage: 3, ability: 'heal 1', rarity: 'common' },
  { id: 40, name: 'Паломник к Блоку', clan: 'Цифровые Монахи', power: 3, damage: 3, ability: '+1 damage', rarity: 'common' },

  // Uncommon (5)
  { id: 21, name: 'Дзен-Валидатор', clan: 'Цифровые Монахи', power: 3, damage: 4, ability: 'heal 2', rarity: 'uncommon' },
  { id: 22, name: 'Страж Храма Цепи', clan: 'Цифровые Монахи', power: 4, damage: 3, ability: 'poison 1', rarity: 'uncommon' },
  { id: 30, name: 'Целитель Нод', clan: 'Цифровые Монахи', power: 3, damage: 3, ability: 'heal 2', rarity: 'uncommon' },
  { id: 31, name: 'Отравитель Мемпула', clan: 'Цифровые Монахи', power: 3, damage: 4, ability: 'poison 2', rarity: 'uncommon' },
  { id: 41, name: 'Алхимик Хешей', clan: 'Цифровые Монахи', power: 4, damage: 3, ability: 'heal 1', rarity: 'uncommon' },

  // Rare (5)
  { id: 13, name: 'Шептун Шардов', clan: 'Цифровые Монахи', power: 5, damage: 4, ability: 'heal 2', rarity: 'rare' },
  { id: 14, name: 'Мастер Эпох', clan: 'Цифровые Монахи', power: 7, damage: 2, ability: 'poison 2', rarity: 'rare' },
  { id: 15, name: 'Страж Консенсуса', clan: 'Цифровые Монахи', power: 4, damage: 5, ability: '-2 opponent power', rarity: 'rare' },
  { id: 32, name: 'Дух Генезиса', clan: 'Цифровые Монахи', power: 5, damage: 3, ability: 'heal 2', rarity: 'rare' },
  { id: 42, name: 'Хранитель Цепи', clan: 'Цифровые Монахи', power: 4, damage: 5, ability: 'life steal 1', rarity: 'rare' },

  // Epic (3)
  { id: 18, name: 'Космический Валидатор', clan: 'Цифровые Монахи', power: 6, damage: 6, ability: 'heal 3', rarity: 'epic' },
  { id: 33, name: 'Архонт Блоков', clan: 'Цифровые Монахи', power: 5, damage: 7, ability: 'poison 3', rarity: 'epic' },
  { id: 43, name: 'Верховный Жрец Консенсуса', clan: 'Цифровые Монахи', power: 6, damage: 5, ability: 'heal 3', rarity: 'epic' },

  // Legendary (3)
  { id: 16, name: 'Император Кода', clan: 'Цифровые Монахи', power: 7, damage: 6, ability: '+3 power', rarity: 'legendary' },
  { id: 34, name: 'Будда Блокчейна', clan: 'Цифровые Монахи', power: 8, damage: 5, ability: 'life steal 3', rarity: 'legendary' },
  { id: 44, name: 'Дракон Эпох', clan: 'Цифровые Монахи', power: 7, damage: 7, ability: 'stop opponent ability', rarity: 'legendary' },
];

// Clan bonuses: activated when 2+ cards from same clan in hand
export const clanBonuses: Record<string, { name: string; desc: string; effect: string; value: number }> = {
  'Неоновые Наемники': {
    name: 'Неоновая Энергия',
    desc: '+1 к силе всех карт клана',
    effect: 'clan_power',
    value: 1,
  },
  'Цифровые Монахи': {
    name: 'Монастырская Мудрость',
    desc: '+1 к урону всех карт клана',
    effect: 'clan_damage',
    value: 1,
  },
};

// Combo abilities: activated when specific cards are in hand together
export const comboAbilities: { card1: number; card2: number; name: string; desc: string; effect: string; value: number }[] = [
  // Neon Mercs combos
  { card1: 1, card2: 23, name: 'Блок+Курьер', desc: 'Оба получают +2 к силе', effect: 'combo_power_both', value: 2 },
  { card1: 5, card2: 20, name: 'Волк+Валидатор', desc: 'Валидатор получает +2 к урону', effect: 'combo_damage_1', value: 2 },
  { card1: 8, card2: 17, name: 'Гиперблок+Император', desc: 'Гиперблок получает +3 к урону', effect: 'combo_damage_1', value: 3 },
  { card1: 7, card2: 19, name: 'Тень+Фантом', desc: 'Кража жизни x2 у обоих', effect: 'combo_lifesteal_both', value: 1 },
  // Digital Monks combos
  { card1: 10, card2: 29, name: 'Нода+Страж', desc: 'Оба исцеляют +2 HP', effect: 'combo_heal_both', value: 2 },
  { card1: 14, card2: 33, name: 'Мастер+Архонт', desc: 'Яд x2 у обоих', effect: 'combo_poison_both', value: 1 },
  { card1: 16, card2: 18, name: 'Император+Валидатор', desc: '+3 к силе Императора', effect: 'combo_power_1', value: 3 },
  { card1: 34, card2: 32, name: 'Будда+Дух', desc: 'Исцеление x3 у Будды', effect: 'combo_heal_1', value: 2 },
  // Cross-clan combos
  { card1: 8, card2: 16, name: 'Гиперблок+Император Кода', desc: 'Оба получают +2 к урону', effect: 'combo_damage_both', value: 2 },
  { card1: 28, card2: 34, name: 'Бог+Будда', desc: 'Оба получают +3 к силе', effect: 'combo_power_both', value: 3 },
];
