import type { Card } from '../types';

export const cards: Card[] = [
  // ═══════════════════════════════════════════
  //  НЕОНОВЫЕ НАЕМНИКИ — атакующий клан
  // ═══════════════════════════════════════════

  // Common (4)
  { id: 1, name: 'Ржавый Дрон', clan: 'Неоновые Наемники', power: 3, damage: 2, ability: '+1 pillz', rarity: 'common' },
  { id: 2, name: 'Патрульный', clan: 'Неоновые Наемники', power: 3, damage: 3, ability: '+1 power', rarity: 'common' },
  { id: 3, name: 'Взломщик', clan: 'Неоновые Наемники', power: 2, damage: 4, ability: '-1 opponent power', rarity: 'common' },
  { id: 4, name: 'Неоновый Снайпер', clan: 'Неоновые Наемники', power: 4, damage: 3, ability: '-2 opponent damage', rarity: 'common' },

  // Uncommon (2)
  { id: 19, name: 'Фантом', clan: 'Неоновые Наемники', power: 4, damage: 4, ability: '+2 power', rarity: 'uncommon' },
  { id: 20, name: 'Кибер-Убийца', clan: 'Неоновые Наемники', power: 5, damage: 3, ability: '+1 damage', rarity: 'uncommon' },

  // Rare (3)
  { id: 5, name: 'Кибер-Волк', clan: 'Неоновые Наемники', power: 6, damage: 3, ability: '+2 power', rarity: 'rare' },
  { id: 6, name: 'Неоновый Рыцарь', clan: 'Неоновые Наемники', power: 5, damage: 4, ability: '+1 damage', rarity: 'rare' },
  { id: 7, name: 'Тень', clan: 'Неоновые Наемники', power: 4, damage: 5, ability: 'life steal 1', rarity: 'rare' },

  // Epic (1)
  { id: 17, name: 'Неоновый Император', clan: 'Неоновые Наемники', power: 7, damage: 5, ability: '+3 power', rarity: 'epic' },

  // Legendary (1)
  { id: 8, name: 'Стальной Берсерк', clan: 'Неоновые Наемники', power: 8, damage: 5, ability: 'stop opponent ability', rarity: 'legendary' },

  // ═══════════════════════════════════════════
  //  ЦИФРОВЫЕ МОНАХИ — supportive клан
  // ═══════════════════════════════════════════

  // Common (4)
  { id: 9, name: 'Светлячок', clan: 'Цифровые Монахи', power: 2, damage: 3, ability: '+1 power', rarity: 'common' },
  { id: 10, name: 'Медитативный', clan: 'Цифровые Монахи', power: 3, damage: 2, ability: 'heal 1', rarity: 'common' },
  { id: 11, name: 'Послушник', clan: 'Цифровые Монахи', power: 4, damage: 2, ability: '-1 opponent power', rarity: 'common' },
  { id: 12, name: 'Тотем', clan: 'Цифровые Монахи', power: 2, damage: 4, ability: 'poison 1', rarity: 'common' },

  // Uncommon (2)
  { id: 21, name: 'Дзен-Воин', clan: 'Цифровые Монахи', power: 3, damage: 4, ability: 'heal 2', rarity: 'uncommon' },
  { id: 22, name: 'Страж Храма', clan: 'Цифровые Монахи', power: 4, damage: 3, ability: 'poison 1', rarity: 'uncommon' },

  // Rare (3)
  { id: 13, name: 'Теневой Шептун', clan: 'Цифровые Монахи', power: 5, damage: 4, ability: 'heal 2', rarity: 'rare' },
  { id: 14, name: 'Звёздный Мастер', clan: 'Цифровые Монахи', power: 7, damage: 2, ability: 'poison 2', rarity: 'rare' },
  { id: 15, name: 'Страж', clan: 'Цифровые Монахи', power: 4, damage: 5, ability: '-2 opponent power', rarity: 'rare' },

  // Epic (1)
  { id: 18, name: 'Космический Страж', clan: 'Цифровые Монахи', power: 6, damage: 6, ability: 'heal 3', rarity: 'epic' },

  // Legendary (1)
  { id: 16, name: 'Император Кода', clan: 'Цифровые Монахи', power: 7, damage: 6, ability: '+3 power', rarity: 'legendary' },
];
