import type { Card } from '../types';

export const cards: Card[] = [
  // ═══════════════════════════════════════════
  //  НЕОНОВЫЕ НАЕМНИКИ — атакующий клан
  // ═══════════════════════════════════════════

  // Common (5)
  { id: 1, name: 'Ржавый Дрон', clan: 'Неоновые Наемники', power: 3, damage: 2, ability: '+1 pillz', rarity: 'common' },
  { id: 2, name: 'Патрульный', clan: 'Неоновые Наемники', power: 3, damage: 3, ability: '+1 power', rarity: 'common' },
  { id: 3, name: 'Взломщик', clan: 'Неоновые Наемники', power: 2, damage: 4, ability: '-1 opponent power', rarity: 'common' },
  { id: 4, name: 'Неоновый Снайпер', clan: 'Неоновые Наемники', power: 4, damage: 3, ability: '-2 opponent damage', rarity: 'common' },
  { id: 23, name: 'Курьер', clan: 'Неоновые Наемники', power: 2, damage: 2, ability: '+1 pillz', rarity: 'common' },

  // Uncommon (4)
  { id: 19, name: 'Фантом', clan: 'Неоновые Наемники', power: 4, damage: 4, ability: '+2 power', rarity: 'uncommon' },
  { id: 20, name: 'Кибер-Убийца', clan: 'Неоновые Наемники', power: 5, damage: 3, ability: '+1 damage', rarity: 'uncommon' },
  { id: 24, name: 'Рейдер', clan: 'Неоновые Наемники', power: 4, damage: 3, ability: 'life steal 1', rarity: 'uncommon' },
  { id: 25, name: 'Диверсант', clan: 'Неоновые Наемники', power: 3, damage: 5, ability: 'poison 1', rarity: 'uncommon' },

  // Rare (4)
  { id: 5, name: 'Кибер-Волк', clan: 'Неоновые Наемники', power: 6, damage: 3, ability: '+2 power', rarity: 'rare' },
  { id: 6, name: 'Неоновый Рыцарь', clan: 'Неоновые Наемники', power: 5, damage: 4, ability: '+1 damage', rarity: 'rare' },
  { id: 7, name: 'Тень', clan: 'Неоновые Наемники', power: 4, damage: 5, ability: 'life steal 1', rarity: 'rare' },
  { id: 26, name: 'Неоновый Убийца', clan: 'Неоновые Наемники', power: 5, damage: 5, ability: '+2 power', rarity: 'rare' },

  // Epic (2)
  { id: 17, name: 'Неоновый Император', clan: 'Неоновые Наемники', power: 7, damage: 5, ability: '+3 power', rarity: 'epic' },
  { id: 27, name: 'Кибер-Паладин', clan: 'Неоновые Наемники', power: 6, damage: 6, ability: 'life steal 2', rarity: 'epic' },

  // Legendary (2)
  { id: 8, name: 'Стальной Берсерк', clan: 'Неоновые Наемники', power: 8, damage: 5, ability: 'stop opponent ability', rarity: 'legendary' },
  { id: 28, name: 'Неоновый Бог', clan: 'Неоновые Наемники', power: 9, damage: 6, ability: '+4 power', rarity: 'legendary' },

  // ═══════════════════════════════════════════
  //  ЦИФРОВЫЕ МОНАХИ — supportive клан
  // ═══════════════════════════════════════════

  // Common (5)
  { id: 9, name: 'Светлячок', clan: 'Цифровые Монахи', power: 2, damage: 3, ability: '+1 power', rarity: 'common' },
  { id: 10, name: 'Медитативный', clan: 'Цифровые Монахи', power: 3, damage: 2, ability: 'heal 1', rarity: 'common' },
  { id: 11, name: 'Послушник', clan: 'Цифровые Монахи', power: 4, damage: 2, ability: '-1 opponent power', rarity: 'common' },
  { id: 12, name: 'Тотем', clan: 'Цифровые Монахи', power: 2, damage: 4, ability: 'poison 1', rarity: 'common' },
  { id: 29, name: 'Монах-Страж', clan: 'Цифровые Монахи', power: 3, damage: 3, ability: 'heal 1', rarity: 'common' },

  // Uncommon (4)
  { id: 21, name: 'Дзен-Воин', clan: 'Цифровые Монахи', power: 3, damage: 4, ability: 'heal 2', rarity: 'uncommon' },
  { id: 22, name: 'Страж Храма', clan: 'Цифровые Монахи', power: 4, damage: 3, ability: 'poison 1', rarity: 'uncommon' },
  { id: 30, name: 'Целитель', clan: 'Цифровые Монахи', power: 3, damage: 3, ability: 'heal 2', rarity: 'uncommon' },
  { id: 31, name: 'Отравитель', clan: 'Цифровые Монахи', power: 3, damage: 4, ability: 'poison 2', rarity: 'uncommon' },

  // Rare (4)
  { id: 13, name: 'Теневой Шептун', clan: 'Цифровые Монахи', power: 5, damage: 4, ability: 'heal 2', rarity: 'rare' },
  { id: 14, name: 'Звёздный Мастер', clan: 'Цифровые Монахи', power: 7, damage: 2, ability: 'poison 2', rarity: 'rare' },
  { id: 15, name: 'Страж', clan: 'Цифровые Монахи', power: 4, damage: 5, ability: '-2 opponent power', rarity: 'rare' },
  { id: 32, name: 'Дух Предков', clan: 'Цифровые Монахи', power: 5, damage: 3, ability: 'heal 2', rarity: 'rare' },

  // Epic (2)
  { id: 18, name: 'Космический Страж', clan: 'Цифровые Монахи', power: 6, damage: 6, ability: 'heal 3', rarity: 'epic' },
  { id: 33, name: 'Архонт', clan: 'Цифровые Монахи', power: 5, damage: 7, ability: 'poison 3', rarity: 'epic' },

  // Legendary (2)
  { id: 16, name: 'Император Кода', clan: 'Цифровые Монахи', power: 7, damage: 6, ability: '+3 power', rarity: 'legendary' },
  { id: 34, name: 'Будда Машин', clan: 'Цифровые Монахи', power: 8, damage: 5, ability: 'life steal 3', rarity: 'legendary' },
];
