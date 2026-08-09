import type { IconName } from '../components/Icon';

// icon — имя штриховой иконки из компонента <Icon/> (эмодзи заменены)
export const abilityInfo: Record<string, { icon: IconName; color: string }> = {
  '+1 power': { icon: 'sword', color: '#60a5fa' }, '+2 power': { icon: 'sword', color: '#93c5fd' },
  '+3 power': { icon: 'sword', color: '#bfdbfe' }, '+4 power': { icon: 'sword', color: '#67e8f9' },
  '+1 damage': { icon: 'boom', color: '#f87171' }, '+2 damage': { icon: 'boom', color: '#fca5a5' },
  '+1 pillz': { icon: 'pill', color: '#4ade80' }, '+3 pillz': { icon: 'pill', color: '#86efac' },
  '-1 opponent power': { icon: 'shield', color: '#fb923c' }, '-2 opponent power': { icon: 'shield', color: '#fdba74' },
  '-2 opponent damage': { icon: 'shield', color: '#fb923c' },
  'heal 1': { icon: 'heart', color: '#4ade80' }, 'heal 2': { icon: 'heart', color: '#86efac' }, 'heal 3': { icon: 'heart', color: '#bbf7d0' },
  'poison 1': { icon: 'skull', color: '#facc15' }, 'poison 2': { icon: 'skull', color: '#fde047' }, 'poison 3': { icon: 'skull', color: '#fef08a' },
  'life steal 1': { icon: 'drop', color: '#c084fc' }, 'life steal 2': { icon: 'drop', color: '#d8b4fe' }, 'life steal 3': { icon: 'drop', color: '#e9d5ff' },
  'stop opponent ability': { icon: 'ban', color: '#f87171' }, 'double damage': { icon: 'bolt', color: '#fde047' },
};

export const abilityIcons: Record<string, IconName> = {
  '+1 pillz': 'pill', '+2 pillz': 'pill', '+3 pillz': 'pill',
  '+1 power': 'sword', '+2 power': 'sword', '+3 power': 'sword', '+4 power': 'sword',
  '+1 damage': 'boom', '+2 damage': 'boom', '+3 damage': 'boom',
  '-1 opponent power': 'shield', '-2 opponent power': 'shield', '-2 opponent damage': 'shield',
  'heal 1': 'heart', 'heal 2': 'heart', 'heal 3': 'heart',
  'poison 1': 'skull', 'poison 2': 'skull', 'poison 3': 'skull',
  'life steal 1': 'drop', 'life steal 2': 'drop', 'life steal 3': 'drop',
  'stop opponent ability': 'ban', 'double damage': 'bolt',
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

export const abilityDescriptions: Record<string, string> = {
  '+1 pillz': '+1 пиллз в этом раунде, можно потратить больше',
  '+2 pillz': '+2 пиллза, увеличь атаку сильнее',
  '+3 pillz': '+3 пиллза, серьёзное усиление атаки',
  '+1 power': '+1 к силе карты в этом раунде',
  '+2 power': '+2 к силе, карта становится мощнее',
  '+3 power': '+3 к силе, карта значительно усиливается',
  '+4 power': '+4 к силе, экстремальное усиление',
  '+1 damage': '+1 к урону при победе',
  '+2 damage': '+2 к урону при победе',
  '-1 opponent power': '-1 к силе карты противника',
  '-2 opponent power': '-2 к силе, ослабляет врага',
  '-2 opponent damage': '-2 к урону противника, броня',
  'heal 1': 'Восстанавливает 1 HP при проигрыше в раунде',
  'heal 2': 'Восстанавливает 2 HP при проигрыше',
  'heal 3': 'Восстанавливает 3 HP при проигрыше',
  'poison 1': 'Наносит +1 доп. урона проигравшему',
  'poison 2': 'Наносит +2 доп. урона проигравшему',
  'poison 3': 'Наносит +3 доп. урона проигравшему',
  'life steal 1': 'Крадёт 1 HP у противника при победе',
  'life steal 2': 'Крадёт 2 HP у противника при победе',
  'life steal 3': 'Крадёт 3 HP у противника при победе',
  'stop opponent ability': 'Отменяет способность карты противника',
  'double damage': 'Удваивает урон при победе в раунде',
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
