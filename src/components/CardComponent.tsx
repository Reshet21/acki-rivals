import type { Card } from '../types';

interface Props {
  card: Card;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

const cardIllustrations: Record<number, string> = {
  5: '/cards/cyber-wolf.svg',
  14: '/cards/star-master.svg',
  8: '/cards/block-keeper.avif',
  16: '/cards/an-characters.avif',
  17: '/cards/blocks-mobile.avif',
  18: '/cards/blocks-mobile.avif',
  28: '/cards/an-characters.avif',
  34: '/cards/an-characters.avif',
};

const clanBg: Record<string, string> = {
  'Неоновые Наемники': 'card-bg-neon',
  'Цифровые Монахи': 'card-bg-monk',
};

const clanGradients: Record<string, string> = {
  'Неоновые Наемники': 'from-purple-950 via-purple-800 to-purple-600',
  'Цифровые Монахи': 'from-emerald-950 via-emerald-800 to-emerald-600',
};

const clanEmojis: Record<string, string> = {
  'Неоновые Наемники': '⚔️',
  'Цифровые Монахи': '🧘',
};

const rarityConfig: Record<string, { badge: string; border: string; glow: string; shimmer: string }> = {
  common: { badge: 'bg-gray-600 text-gray-200', border: 'card-border-common', glow: '', shimmer: '' },
  uncommon: { badge: 'bg-green-600 text-green-100', border: 'card-border-uncommon', glow: 'card-glow-uncommon', shimmer: '' },
  rare: { badge: 'bg-blue-600 text-blue-100', border: 'card-border-rare', glow: 'card-glow-rare', shimmer: '' },
  epic: { badge: 'bg-purple-600 text-purple-100', border: 'card-border-epic', glow: 'card-glow-epic', shimmer: '' },
  legendary: { badge: 'bg-yellow-500 text-yellow-900', border: 'card-border-legendary', glow: 'card-glow-legendary', shimmer: 'animate-shimmer' },
};

const abilityNames: Record<string, string> = {
  '+1 power': 'Укрепление',
  '+2 power': 'Боевой дух',
  '+3 power': 'Трансценденция',
  '+4 power': 'Абсолютная сила',
  '+1 damage': 'Усиление удара',
  '+2 damage': 'Критический удар',
  '+1 pillz': 'Запас',
  '+3 pillz': 'Арсенал',
  '-1 opponent power': 'Ослабление',
  '-2 opponent power': 'Подавление',
  '-2 opponent damage': 'Броня',
  'heal 1': 'Первая помощь',
  'heal 2': 'Регенерация',
  'heal 3': 'Божественное исцеление',
  'poison 1': 'Токсин',
  'poison 2': 'Яд',
  'poison 3': 'Чума',
  'life steal 1': 'Вытягивание жизни',
  'life steal 2': 'Кража жизни',
  'life steal 3': 'Вампиризм',
  'stop opponent ability': 'Глушитель',
  'double damage': 'Двойной удар',
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

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`
          relative w-full rounded-xl overflow-hidden
          bg-gradient-to-br ${clanGradients[clan] || 'from-gray-800 to-gray-900'}
          ${bgClass}
          border ${config.border} ${config.glow}
          transition-all duration-200
          active:scale-95 flex flex-col
          ${isSelected ? 'scale-[1.03] border-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.5)]' : ''}
        `}
      >
        {/* Shimmer overlay */}
        {rarity === 'legendary' && <div className="absolute inset-0 animate-shimmer pointer-events-none rounded-xl" />}

        {/* Decorative corner accent */}
        <div className="absolute top-0 left-0 w-8 h-8 bg-gradient-to-br from-white/5 to-transparent rounded-tl-xl" />
        <div className="absolute bottom-0 right-0 w-6 h-6 bg-gradient-to-tl from-white/3 to-transparent rounded-br-xl" />

        {/* Rarity badge */}
        <div className="absolute top-1 right-1 z-10">
          <span className={`text-[6px] px-1.5 py-0.5 rounded-full font-bold ${config.badge}`}>
            {rarity === 'common' ? 'ОБЫЧ' : rarity === 'uncommon' ? 'НЕОБЫЧ' : rarity === 'rare' ? 'РЕДК' : rarity === 'epic' ? 'ЭПИЧ' : 'ЛЕГЕНД'}
          </span>
        </div>

        <div className="p-1.5 flex flex-col gap-0.5 flex-1 relative z-10">
          {/* Illustration or Emoji */}
          <div className="text-center">
            {cardIllustrations[card.id] ? (
              <img src={cardIllustrations[card.id]} alt={card.name} className="w-10 h-10 mx-auto object-contain animate-float drop-shadow-lg" />
            ) : (
              <div className="text-base mb-px animate-float">{clanEmojis[clan] || '🃏'}</div>
            )}
            <div className="font-bold text-[11px] leading-tight text-white drop-shadow-md truncate px-0.5">
              {card.name || '???'}
            </div>
            <StarDisplay stars={stars} />
          </div>

          {/* Ability */}
          <div className="bg-black/40 rounded-md px-1.5 py-0.5 text-center backdrop-blur-sm border border-white/5">
            <div className="text-[8px] text-white/50 font-medium leading-tight truncate">
              {getAbilityName(card.ability)}
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-between items-center px-0.5">
            <div className="text-center flex-1">
              <div className="text-[6px] text-white/40 uppercase tracking-wider">Сила</div>
              <div className="text-sm font-black text-white drop-shadow-md">{displayPower}</div>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="text-center flex-1">
              <div className="text-[6px] text-white/40 uppercase tracking-wider">Урон</div>
              <div className="text-sm font-black text-red-300 drop-shadow-md">{displayDamage}</div>
            </div>
          </div>
        </div>

        {/* Selection overlay */}
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
        bg-gradient-to-br ${clanGradients[clan] || 'from-gray-800 to-gray-900'}
        ${bgClass}
        border-2 ${config.border} ${config.glow}
        transition-all duration-200
        hover:scale-105 active:scale-95
        flex flex-col
        ${isSelected ? 'scale-105 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]' : ''}
      `}
    >
      {/* Shimmer overlay */}
      {rarity === 'legendary' && <div className="absolute inset-0 animate-shimmer pointer-events-none rounded-2xl" />}

      {/* Decorative accents */}
      <div className="absolute top-0 left-0 w-12 h-12 bg-gradient-to-br from-white/5 to-transparent rounded-tl-2xl" />
      <div className="absolute bottom-0 right-0 w-8 h-8 bg-gradient-to-tl from-white/3 to-transparent rounded-br-2xl" />

      {/* Rarity badge */}
      <div className="absolute top-2 right-2 z-10">
        <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${config.badge}`}>
          {rarity === 'common' ? 'ОБЫЧ' : rarity === 'uncommon' ? 'НЕОБЫЧ' : rarity === 'rare' ? 'РЕДК' : rarity === 'epic' ? 'ЭПИЧ' : 'ЛЕГЕНД'}
        </span>
      </div>

      <div className="p-3 flex flex-col gap-1.5 flex-1 relative z-10">
        {/* Illustration or Emoji */}
        <div className="text-center">
          {cardIllustrations[card.id] ? (
            <img src={cardIllustrations[card.id]} alt={card.name} className="w-16 h-16 mx-auto object-contain animate-float drop-shadow-lg" />
          ) : (
            <div className="text-2xl mb-0.5 animate-float">{clanEmojis[clan] || '🃏'}</div>
          )}
          <div className="font-bold text-sm leading-tight text-white drop-shadow-lg">
            {card.name || '???'}
          </div>
          <StarDisplay stars={stars} />
          <div className="text-[9px] text-white/50 mt-0.5">{clan}</div>
        </div>

        {/* Ability */}
        <div className="bg-black/30 rounded-lg p-1.5 text-center backdrop-blur-sm border border-white/5">
          <div className="text-[8px] text-white/40 uppercase tracking-wider mb-0.5">Способность</div>
          <div className="text-[10px] text-white font-semibold">{getAbilityName(card.ability)}</div>
        </div>

        {/* Stats */}
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

      {/* Selection overlay */}
      {isSelected && (
        <div className="absolute inset-0 border-2 border-yellow-400 rounded-2xl pointer-events-none animate-glow-pulse" />
      )}
    </button>
  );
}
