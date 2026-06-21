import type { Card } from '../types';

/*
  Balance framework:
  ┌───────────┬───────────┬───────────┬──────────────────────────┐
  │  Rarity   │  Power    │  Damage   │  Ability tier            │
  ├───────────┼───────────┼───────────┼──────────────────────────┤
  │  Common   │  2–4      │  2–3      │  Basic (+1, -1, heal 1)  │
  │  Rare     │  4–6      │  3–5      │  Moderate (+2, -2, ls)   │
  │  Legendary│  6–9      │  4–7      │  Strong (stop, +3, x2)   │
  └───────────┴───────────┴───────────┴──────────────────────────┘

  Clans:
  - Неоновые Наемники: агрессивные, выше power/damage, атакующие способности
  - Цифровые Монахи: defensive/support, heal, poison, debuff
*/

export const cards: Card[] = [
  // ═══════════════════════════════════════════
  //  НЕОНОВЫЕ НАЕМНИКИ — атакующий клан
  // ═══════════════════════════════════════════

  // Common (4)
  {
    id: 1,
    name: 'Ржавый Дрон',
    clan: 'Неоновые Наемники',
    power: 3,
    damage: 2,
    ability: '+1 pillz',
    rarity: 'common',
  },
  {
    id: 2,
    name: 'Патрульный',
    clan: 'Неоновые Наемники',
    power: 3,
    damage: 3,
    ability: '+1 power',
    rarity: 'common',
  },
  {
    id: 3,
    name: 'Взломщик',
    clan: 'Неоновые Наемники',
    power: 2,
    damage: 4,
    ability: '-1 opponent power',
    rarity: 'common',
  },
  {
    id: 4,
    name: 'Неоновый Снайпер',
    clan: 'Неоновые Наемники',
    power: 4,
    damage: 3,
    ability: '-2 opponent damage',
    rarity: 'common',
  },

  // Rare (3)
  {
    id: 5,
    name: 'Кибер-Волк',
    clan: 'Неоновые Наемники',
    power: 6,
    damage: 3,
    ability: '+2 power',
    rarity: 'rare',
  },
  {
    id: 6,
    name: 'Неоновый Рыцарь',
    clan: 'Неоновые Наемники',
    power: 5,
    damage: 4,
    ability: '+1 damage',
    rarity: 'rare',
  },
  {
    id: 7,
    name: 'Тень',
    clan: 'Неоновые Наемники',
    power: 4,
    damage: 5,
    ability: 'life steal 1',
    rarity: 'rare',
  },

  // Legendary (1)
  {
    id: 8,
    name: 'Стальной Берсерк',
    clan: 'Неоновые Наемники',
    power: 8,
    damage: 5,
    ability: 'stop opponent ability',
    rarity: 'legendary',
  },

  // ═══════════════════════════════════════════
  //  ЦИФРОВЫЕ МОНАХИ — supportive клан
  // ═══════════════════════════════════════════

  // Common (4)
  {
    id: 9,
    name: 'Светлячок',
    clan: 'Цифровые Монахи',
    power: 2,
    damage: 3,
    ability: '+1 power',
    rarity: 'common',
  },
  {
    id: 10,
    name: 'Медитативный',
    clan: 'Цифровые Монахи',
    power: 3,
    damage: 2,
    ability: 'heal 1',
    rarity: 'common',
  },
  {
    id: 11,
    name: 'Послушник',
    clan: 'Цифровые Монахи',
    power: 4,
    damage: 2,
    ability: '-1 opponent power',
    rarity: 'common',
  },
  {
    id: 12,
    name: 'Тотем',
    clan: 'Цифровые Монахи',
    power: 2,
    damage: 4,
    ability: 'poison 1',
    rarity: 'common',
  },

  // Rare (3)
  {
    id: 13,
    name: 'Теневой Шептун',
    clan: 'Цифровые Монахи',
    power: 5,
    damage: 4,
    ability: 'heal 2',
    rarity: 'rare',
  },
  {
    id: 14,
    name: 'Звёздный Мастер',
    clan: 'Цифровые Монахи',
    power: 7,
    damage: 2,
    ability: 'poison 2',
    rarity: 'rare',
  },
  {
    id: 15,
    name: 'Страж',
    clan: 'Цифровые Монахи',
    power: 4,
    damage: 5,
    ability: '-2 opponent power',
    rarity: 'rare',
  },

  // Legendary (1)
  {
    id: 16,
    name: 'Император Кода',
    clan: 'Цифровые Монахи',
    power: 7,
    damage: 6,
    ability: '+3 power',
    rarity: 'legendary',
  },
];
