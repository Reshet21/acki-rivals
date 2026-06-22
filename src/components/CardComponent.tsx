import type { Card } from '../types';

interface Props {
  card: Card;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

// Character illustrations mapped by card ID
const cardArt: Record<number, string> = {
  1: '/cards/block-keeper.avif',  // Ржавый Дрон
  2: '/cards/an-characters.avif', // Патрульный
  3: '/cards/blocks-mobile.avif', // Взломщик
  4: '/cards/block-keeper.avif',  // Снайпер
  5: '/cards/cyber-wolf.svg',     // Кибер-Волк
  6: '/cards/an-characters.avif', // Рыцарь
  7: '/cards/blocks-mobile.avif', // Тень
  8: '/cards/block-keeper.avif',  // Берсерк
  9: '/cards/an-characters.avif', // Светлячок
  10: '/cards/an-characters.avif', // Медитативный
  11: '/cards/blocks-mobile.avif', // Послушник
  12: '/cards/blocks-mobile.avif', // Тотем
  13: '/cards/an-characters.avif', // Дзен-Воин
  14: '/cards/star-master.svg',   // Мастер
  15: '/cards/blocks-mobile.avif', // Страж
  16: '/cards/an-characters.avif', // Император
  17: '/cards/block-keeper.avif',  // Неоновый Император
  18: '/cards/blocks-mobile.avif', // Космический Страж
  19: '/cards/an-characters.avif', // Фантом
  20: '/cards/blocks-mobile.avif', // Убийца
  21: '/cards/an-characters.avif', // Дзен-Воин 2
  22: '/cards/blocks-mobile.avif', // Страж Храма
  23: '/cards/block-keeper.avif',  // Курьер
  24: '/cards/an-characters.avif', // Рейдер
  25: '/cards/blocks-mobile.avif', // Диверсант
  26: '/cards/an-characters.avif', // Убийца 2
  27: '/cards/block-keeper.avif',  // Паладин
  28: '/cards/an-characters.avif', // Неоновый Бог
  29: '/cards/an-characters.avif', // Монах-Страж
  30: '/cards/blocks-mobile.avif', // Целитель
  31: '/cards/an-characters.avif', // Отравитель
  32: '/cards/blocks-mobile.avif', // Дух Предков
  33: '/cards/block-keeper.avif',  // Архонт
  34: '/cards/an-characters.avif', // Будда Машин
};

const clanBg: Record<string, string> = {
  'Неоновые Наемники': 'card-bg-neon',
  'Цифровые Монахи': 'card-bg-monk',
};

const rarityConfig: Record<string, { badge: string; border: string; glow: string; shimmer: string; accent: string }> = {
  common: { badge: 'bg-gray-600/80 text-gray-200', border: 'border-gray-500/30', glow: '', shimmer: '', accent: 'from-gray-600/20 to-transparent' },
  uncommon: { badge: 'bg-green-600/80 text-green-100', border: 'border-green-500/40', glow: 'card-glow-uncommon', shimmer: '', accent: 'from-green-500/20 to-transparent' },
  rare: { badge: 'bg-blue-600/80 text-blue-100', border: 'border-blue-500/50', glow: 'card-glow-rare', shimmer: '', accent: 'from-blue-500/20 to-transparent' },
  epic: { badge: 'bg-purple-600/80 text-purple-100', border: 'border-purple-500/50', glow: 'card-glow-epic', shimmer: '', accent: 'from-purple-500/25 to-transparent' },
  legendary: { badge: 'bg-yellow-500/90 text-yellow-900', border: 'border-yellow-400/60', glow: 'card-glow-legendary', shimmer: 'animate-shimmer', accent: 'from-yellow-500/20 to-transparent' },
};

const abilityNames: Record<string, string> = {
  '+1 power': 'Укрепление', '+2 power': 'Боевой дух', '+3 power': 'Трансценденция', '+4 power': 'Абсолютная сила',
  '+1 damage': 'Усиление удара', '+2 damage': 'Критический удар',
  '+1 pillz': 'Запас', '+3 pillz': 'Арсенал',
  '-1 opponent power': 'Ослабление', '-2 opponent power': 'Подавление', '-2 opponent damage': 'Броня',
  'heal 1': 'Первая помощь', 'heal 2': 'Регенерация', 'heal 3': 'Божественное исцеление',
  'poison 1': 'Токсин', 'poison 2': 'Яд', 'poison 3': 'Чума',
  'life steal 1': 'Вытягивание жизни', 'life steal 2': 'Кража жизни', 'life steal 3': 'Вампиризм',
  'stop opponent ability': 'Глушитель', 'double damage': 'Двойной удар',
};

function getAbilityName(ability: string | undefined): string {
  if (!ability) return '—';
  return abilityNames[ability] || ability;
}

function StarDisplay({ stars }: { stars: number }) {
  if (stars <= 0) return null;
  return (
    <div className="flex justify-center gap-0.5 mt-0.5">
      {Array.from({ length: stars }).map((_, i) => (
        <span key={i} className="text-[9px] text-yellow-400 drop-shadow-[0_0_3px_rgba(250,204,21,0.6)]">★</span>
      ))}
    </div>
  );
}

export default function CardComponent({ card, isSelected, onClick, compact }: Props) {
  const stars = card.stars ?? 0;
  const displayPower = (card.power ?? 0) + stars;
  const displayDamage = (card.damage ?? 0) + stars;
  const clan = card.clan || 'Неоновые Наемники';
  const rarity = card.rarity || 'common';
  const config = rarityConfig[rarity] || rarityConfig.common;
  const bgClass = clanBg[clan] || '';
  const artSrc = cardArt[card.id];

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`
          relative w-full rounded-xl overflow-hidden
          bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
          ${bgClass}
          border ${config.border} ${config.glow}
          transition-all duration-200 active:scale-95 flex flex-col
          ${isSelected ? 'scale-[1.03] border-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.5)]' : ''}
        `}
      >
        {rarity === 'legendary' && <div className="absolute inset-0 animate-shimmer pointer-events-none rounded-xl" />}

        {/* Character art area */}
        <div className="relative w-full h-16 overflow-hidden bg-black/30">
          {artSrc ? (
            <img src={artSrc} alt="" className="w-full h-full object-cover opacity-80" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">🃏</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />
          {/* Rarity badge */}
          <div className="absolute top-1 right-1 z-10">
            <span className={`text-[6px] px-1.5 py-0.5 rounded-full font-bold ${config.badge}`}>
              {rarity === 'common' ? 'ОБЫЧ' : rarity === 'uncommon' ? 'НЕОБЫЧ' : rarity === 'rare' ? 'РЕДК' : rarity === 'epic' ? 'ЭПИЧ' : 'ЛЕГЕНДА'}
            </span>
          </div>
        </div>

        <div className="p-1.5 flex flex-col gap-0.5 flex-1 relative z-10">
          <div className="text-center">
            <div className="font-bold text-[11px] leading-tight text-white drop-shadow-md truncate px-0.5">
              {card.name || '???'}
            </div>
            <StarDisplay stars={stars} />
          </div>

          <div className="bg-black/40 rounded-md px-1.5 py-0.5 text-center backdrop-blur-sm border border-white/5">
            <div className="text-[8px] text-white/50 font-medium leading-tight truncate">
              {getAbilityName(card.ability)}
            </div>
          </div>

          <div className="flex justify-between items-center px-0.5">
            <div className="text-center flex-1">
              <div className="text-[6px] text-white/40 uppercase">СИЛА</div>
              <div className="text-sm font-black text-white drop-shadow-md">{displayPower}</div>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="text-center flex-1">
              <div className="text-[6px] text-white/40 uppercase">УРОН</div>
              <div className="text-sm font-black text-red-300 drop-shadow-md">{displayDamage}</div>
            </div>
          </div>
        </div>

        {isSelected && (
          <div className="absolute inset-0 border-2 border-yellow-400 rounded-xl pointer-events-none animate-glow-pulse" />
        )}
      </button>
    );
  }

  // Full-size card
  return (
    <button
      onClick={onClick}
      className={`
        relative w-40 rounded-2xl overflow-hidden
        bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
        ${bgClass}
        border-2 ${config.border} ${config.glow}
        transition-all duration-200 hover:scale-105 active:scale-95 flex flex-col
        ${isSelected ? 'scale-105 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]' : ''}
      `}
    >
      {rarity === 'legendary' && <div className="absolute inset-0 animate-shimmer pointer-events-none rounded-2xl" />}

      {/* Character art area */}
      <div className="relative w-full h-24 overflow-hidden bg-black/30">
        {artSrc ? (
          <img src={artSrc} alt="" className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🃏</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
        {/* Rarity badge */}
        <div className="absolute top-2 right-2 z-10">
          <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${config.badge}`}>
            {rarity === 'common' ? 'ОБЫЧ' : rarity === 'uncommon' ? 'НЕОБЫЧ' : rarity === 'rare' ? 'РЕДК' : rarity === 'epic' ? 'ЭПИЧ' : 'ЛЕГЕНДА'}
          </span>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-1.5 flex-1 relative z-10">
        <div className="text-center">
          <div className="font-bold text-sm leading-tight text-white drop-shadow-lg">
            {card.name || '???'}
          </div>
          <StarDisplay stars={stars} />
          <div className="text-[9px] text-white/50 mt-0.5">{clan}</div>
        </div>

        <div className="bg-black/30 rounded-lg p-1.5 text-center backdrop-blur-sm border border-white/5">
          <div className="text-[8px] text-white/40 uppercase tracking-wider mb-0.5">Способность</div>
          <div className="text-[10px] text-white font-semibold">{getAbilityName(card.ability)}</div>
        </div>

        <div className="flex justify-between items-center mt-auto">
          <div className="text-center flex-1">
            <div className="text-[8px] text-white/40 uppercase">Сила</div>
            <div className="text-2xl font-black text-white drop-shadow-lg">{displayPower}</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center flex-1">
            <div className="text-[8px] text-white/40 uppercase">Урон</div>
            <div className="text-2xl font-black text-red-300 drop-shadow-lg">{displayDamage}</div>
          </div>
        </div>
      </div>

      {isSelected && (
        <div className="absolute inset-0 border-2 border-yellow-400 rounded-2xl pointer-events-none animate-glow-pulse" />
      )}
    </button>
  );
}
