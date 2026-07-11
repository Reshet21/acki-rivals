export const abilityInfo: Record<string, { icon: string; color: string }> = {
  '+1 power': { icon: '⚔️', color: '#60a5fa' }, '+2 power': { icon: '⚔️', color: '#93c5fd' },
  '+3 power': { icon: '⚔️', color: '#bfdbfe' }, '+4 power': { icon: '⚔️', color: '#67e8f9' },
  '+1 damage': { icon: '💥', color: '#f87171' }, '+2 damage': { icon: '💥', color: '#fca5a5' },
  '+1 pillz': { icon: '💊', color: '#4ade80' }, '+3 pillz': { icon: '💊', color: '#86efac' },
  '-1 opponent power': { icon: '🛡️', color: '#fb923c' }, '-2 opponent power': { icon: '🛡️', color: '#fdba74' },
  '-2 opponent damage': { icon: '🛡️', color: '#fb923c' },
  'heal 1': { icon: '💚', color: '#4ade80' }, 'heal 2': { icon: '💚', color: '#86efac' }, 'heal 3': { icon: '💚', color: '#bbf7d0' },
  'poison 1': { icon: '☠️', color: '#facc15' }, 'poison 2': { icon: '☠️', color: '#fde047' }, 'poison 3': { icon: '☠️', color: '#fef08a' },
  'life steal 1': { icon: '🩸', color: '#c084fc' }, 'life steal 2': { icon: '🩸', color: '#d8b4fe' }, 'life steal 3': { icon: '🩸', color: '#e9d5ff' },
  'stop opponent ability': { icon: '🚫', color: '#f87171' }, 'double damage': { icon: '⚡', color: '#fde047' },
};

export const abilityIcons: Record<string, string> = {
  '+1 pillz': '💊', '+2 pillz': '💊', '+3 pillz': '💊',
  '+1 power': '⚔️', '+2 power': '⚔️', '+3 power': '⚔️', '+4 power': '⚔️',
  '+1 damage': '💥', '+2 damage': '💥', '+3 damage': '💥',
  '-1 opponent power': '🛡️', '-2 opponent power': '🛡️', '-2 opponent damage': '🛡️',
  'heal 1': '💚', 'heal 2': '💚', 'heal 3': '💚',
  'poison 1': '☠️', 'poison 2': '☠️', 'poison 3': '☠️',
  'life steal 1': '🩸', 'life steal 2': '🩸', 'life steal 3': '🩸',
  'stop opponent ability': '🚫', 'double damage': '⚡',
};

export const abilityColors: Record<string, string> = {
  '+1 pillz': '#4ade80', '+2 pillz': '#4ade80', '+3 pillz': '#4ade80',
  '+1 power': '#60a5fa', '+2 power': '#93c5fd', '+3 power': '#bfdbfe', '+4 power': '#67e8f9',
  '+1 damage': '#f87171', '+2 damage': '#fca5a5', '+3 damage': '#fca5a5',
  '-1 opponent power': '#fb923c', '-2 opponent power': '#fdba74', '-2 opponent damage': '#fb923c',
  'heal 1': '#4ade80', 'heal 2': '#86efac', 'heal 3': '#bbf7d0',
  'poison 1': '#facc15', 'poison 2': '#fde047', 'poison 3': '#fef08a',
  'life steal 1': '#c084fc', 'life steal 2': '#d8b4fe', 'life steal 3': '#e9d5ff',
  'stop opponent ability': '#f87171', 'double damage': '#fde047',
};

export const abilityNames: Record<string, string> = {
  '+1 pillz': 'Запас', '+2 pillz': 'Запас', '+3 pillz': 'Арсенал',
  '+1 power': 'Укрепление', '+2 power': 'Боевой дух', '+3 power': 'Трансценденция', '+4 power': 'Абсолютная сила',
  '+1 damage': 'Усиление удара', '+2 damage': 'Критический удар',
  '-1 opponent power': 'Ослабление', '-2 opponent power': 'Подавление', '-2 opponent damage': 'Броня',
  'heal 1': 'Первая помощь', 'heal 2': 'Регенерация', 'heal 3': 'Божественное исцеление',
  'poison 1': 'Токсин', 'poison 2': 'Яд', 'poison 3': 'Чума',
  'life steal 1': 'Вытягивание жизни', 'life steal 2': 'Кража жизни', 'life steal 3': 'Вампиризм',
  'stop opponent ability': 'Глушитель', 'double damage': 'Двойной удар',
};
