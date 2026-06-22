import type { Card } from '../types';

interface Props {
  card: Card;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

const clanGradients: Record<string, string> = {
  'Неоновые Наемники': 'from-purple-900 via-purple-700 to-purple-500',
  'Цифровые Монахи': 'from-emerald-900 via-emerald-700 to-emerald-500',
};

const clanEmojis: Record<string, string> = {
  'Неоновые Наемники': '⚔️',
  'Цифровые Монахи': '🧘',
};

const rarityColors: Record<string, string> = {
  common: 'bg-gray-500',
  uncommon: 'bg-green-500',
  rare: 'bg-blue-500',
  epic: 'bg-purple-500',
  legendary: 'bg-yellow-400 text-yellow-900',
};

const rarityLabels: Record<string, string> = {
  common: 'Обыч.',
  uncommon: 'Необыч.',
  rare: 'Редк.',
  epic: 'Эпич.',
  legendary: 'Леген.',
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

function StarDisplay({ stars, size = 'sm' }: { stars: number; size?: 'sm' | 'xs' }) {
  if (stars <= 0) return null;
  const cls = size === 'sm' ? 'text-[9px]' : 'text-[7px]';
  return (
    <div className="flex gap-px">
      {Array.from({ length: stars }).map((_, i) => (
        <span key={i} className={`${cls} text-yellow-400`}>★</span>
      ))}
    </div>
  );
}

export default function CardComponent({ card, isSelected, onClick, compact }: Props) {
  const stars = card.stars ?? 0;
  const bonus = stars;
  const displayPower = (card.power ?? 0) + bonus;
  const displayDamage = (card.damage ?? 0) + bonus;
  const clan = card.clan || 'Неоновые Наемники';
  const rarity = card.rarity || 'common';

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`
          relative w-full rounded-lg overflow-hidden
          bg-gradient-to-b ${clanGradients[clan] || 'from-gray-800 to-gray-900'}
          border ${isSelected ? 'border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.5)]' : 'border-white/10'}
          transition-transform duration-150
          active:scale-95
          flex flex-col
          ${isSelected ? 'scale-[1.03]' : ''}
        `}
      >
        <div className="absolute top-1 right-1">
          <span className={`text-[7px] px-1 py-px rounded-full font-bold ${rarityColors[rarity] || 'bg-gray-500'}`}>
            {rarityLabels[rarity] || 'Обыч.'}
          </span>
        </div>

        <div className="p-1.5 flex flex-col gap-1 flex-1">
          <div className="text-center">
            <div className="text-sm mb-px">{clanEmojis[clan] || '🃏'}</div>
            <div className="font-bold text-[11px] leading-tight text-white drop-shadow-lg truncate">
              {card.name || '???'}
            </div>
            <StarDisplay stars={stars} size="xs" />
          </div>

          <div className="bg-black/30 rounded p-1 text-center">
            <div className="text-[7px] text-white/40 uppercase tracking-wider">Спос.</div>
            <div className="text-[9px] text-white font-medium leading-tight truncate">{getAbilityName(card.ability)}</div>
          </div>

          <div className="flex justify-between items-center px-1">
            <div className="text-center">
              <div className="text-[7px] text-white/40 uppercase">Сила</div>
              <div className="text-sm font-black text-white">{displayPower}</div>
            </div>
            <div className="text-center">
              <div className="text-[7px] text-white/40 uppercase">Урон</div>
              <div className="text-sm font-black text-red-300">{displayDamage}</div>
            </div>
          </div>
        </div>

        {isSelected && (
          <div className="absolute inset-0 border border-yellow-400 rounded-lg pointer-events-none" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`
        relative w-40 rounded-xl overflow-hidden
        bg-gradient-to-b ${clanGradients[clan] || 'from-gray-800 to-gray-900'}
        border-2 ${isSelected ? 'border-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.5)]' : 'border-white/10'}
        transition-transform duration-150
        hover:scale-105 active:scale-95
        flex flex-col
        ${isSelected ? 'scale-105' : ''}
      `}
    >
      <div className="absolute top-1.5 right-1.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${rarityColors[rarity] || 'bg-gray-500'}`}>
          {rarityLabels[rarity] || 'Обыч.'}
        </span>
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="text-center">
          <div className="text-lg mb-0.5">{clanEmojis[clan] || '🃏'}</div>
          <div className="font-bold text-sm leading-tight text-white drop-shadow-lg">
            {card.name || '???'}
          </div>
          <StarDisplay stars={stars} />
          <div className="text-[10px] text-white/60 mt-0.5">{clan}</div>
        </div>

        <div className="bg-black/30 rounded-lg p-2 text-center">
          <div className="text-[10px] text-white/50 uppercase tracking-wider">Способность</div>
          <div className="text-xs text-white font-medium mt-0.5">{getAbilityName(card.ability)}</div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-center">
            <div className="text-[10px] text-white/50 uppercase">Сила</div>
            <div className="text-xl font-black text-white drop-shadow-lg">{displayPower}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-white/50 uppercase">Урон</div>
            <div className="text-xl font-black text-red-300 drop-shadow-lg">{displayDamage}</div>
          </div>
        </div>
      </div>

      {isSelected && (
        <div className="absolute inset-0 border-2 border-yellow-400 rounded-xl pointer-events-none animate-pulse" />
      )}
    </button>
  );
}
