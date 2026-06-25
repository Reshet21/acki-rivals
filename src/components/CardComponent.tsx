import type { Card } from '../types';
import { useI18n } from '../i18n';
import { getCardName, getAbilityName, getStatLabel, getRarityLabel } from '../i18n/cardTranslations';

interface Props {
  card: Card;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

// Ability visual info: icon + short description
const abilityInfo: Record<string, { icon: string; desc: string; color: string }> = {
  '+1 power':          { icon: '⚔️', desc: '+1 power', color: 'text-blue-400' },
  '+2 power':          { icon: '⚔️', desc: '+2 power', color: 'text-blue-300' },
  '+3 power':          { icon: '⚔️', desc: '+3 power', color: 'text-blue-200' },
  '+4 power':          { icon: '⚔️', desc: '+4 power', color: 'text-cyan-300' },
  '+1 damage':         { icon: '💥', desc: '+1 damage', color: 'text-red-400' },
  '+2 damage':         { icon: '💥', desc: '+2 damage', color: 'text-red-300' },
  '+1 pillz':          { icon: '💊', desc: '+1 pillz', color: 'text-green-400' },
  '+3 pillz':          { icon: '💊', desc: '+3 pillz', color: 'text-green-300' },
  '-1 opponent power': { icon: '🛡️', desc: '-1 enemy power', color: 'text-orange-400' },
  '-2 opponent power': { icon: '🛡️', desc: '-2 enemy power', color: 'text-orange-300' },
  '-2 opponent damage':{ icon: '🛡️', desc: '-2 enemy damage', color: 'text-orange-400' },
  'heal 1':           { icon: '💚', desc: '+1 HP on loss', color: 'text-green-400' },
  'heal 2':           { icon: '💚', desc: '+2 HP on loss', color: 'text-green-300' },
  'heal 3':           { icon: '💚', desc: '+3 HP on loss', color: 'text-green-200' },
  'poison 1':         { icon: '☠️', desc: '+1 poison', color: 'text-yellow-400' },
  'poison 2':         { icon: '☠️', desc: '+2 poison', color: 'text-yellow-300' },
  'poison 3':         { icon: '☠️', desc: '+3 poison', color: 'text-yellow-200' },
  'life steal 1':     { icon: '🩸', desc: '+1 HP on win', color: 'text-purple-400' },
  'life steal 2':     { icon: '🩸', desc: '+2 HP on win', color: 'text-purple-300' },
  'life steal 3':     { icon: '🩸', desc: '+3 HP on win', color: 'text-purple-200' },
  'stop opponent ability': { icon: '🚫', desc: 'Cancels ability', color: 'text-red-400' },
  'double damage':    { icon: '⚡', desc: 'Double damage', color: 'text-yellow-300' },
};

// Card illustrations
const cardArt: Record<number, string> = {
  1: '/cards/card-rusty-drone.png',
  2: '/cards/card-patrol.png',
  3: '/cards/card-hacker.png',
  4: '/cards/card-neon-sniper.png',
  5: '/cards/card-cyber-wolf.png',
  6: '/cards/card-circuit-guardian.jpeg',
  7: '/cards/card-phantom.png',
  8: '/cards/card-acki-nacki.jpeg',
  9: '/cards/card-mamabord.jpeg',
  10: '/cards/card-mamabord.jpeg',
  11: '/cards/card-block-keeper.jpeg',
  12: '/cards/card-block-keeper.jpeg',
  13: '/cards/card-block-keeper.jpeg',
  14: '/cards/card-block-manager.jpeg',
  15: '/cards/card-block-manager.jpeg',
  16: '/cards/card-block-manager.jpeg',
  17: '/cards/card-malicious-block.jpeg',
  18: '/cards/card-circuit-guardian.jpeg',
  19: '/cards/card-phantom.png',
  20: '/cards/card-cyber-killer.png',
  21: '/cards/card-mamabord.jpeg',
  22: '/cards/card-block-keeper.jpeg',
  23: '/cards/card-courier.png',
  24: '/cards/card-raider.png',
  25: '/cards/card-saboteur.png',
  26: '/cards/card-cyber-killer.png',
  27: '/cards/card-circuit-guardian.jpeg',
  28: '/cards/card-malicious-block.jpeg',
  29: '/cards/card-block-keeper.jpeg',
  30: '/cards/card-mamabord.jpeg',
  31: '/cards/card-saboteur.png',
  32: '/cards/card-block-keeper.jpeg',
  33: '/cards/card-circuit-guardian.jpeg',
  34: '/cards/card-malicious-block.jpeg',
};

const clanBg: Record<string, string> = {
  'Неоновые Наемники': 'card-bg-neon',
  'Цифровые Монахи': 'card-bg-monk',
};

const rarityConfig: Record<string, { badge: string; border: string; glow: string; shimmer: string }> = {
  common: { badge: 'bg-gray-600/80 text-gray-200', border: 'border-gray-500/30', glow: '', shimmer: '' },
  uncommon: { badge: 'bg-green-600/80 text-green-100', border: 'border-green-500/40', glow: 'card-glow-uncommon', shimmer: '' },
  rare: { badge: 'bg-blue-600/80 text-blue-100', border: 'border-blue-500/50', glow: 'card-glow-rare', shimmer: '' },
  epic: { badge: 'bg-purple-600/80 text-purple-100', border: 'border-purple-500/50', glow: 'card-glow-epic', shimmer: '' },
  legendary: { badge: 'bg-yellow-500/90 text-yellow-900', border: 'border-yellow-400/60', glow: 'card-glow-legendary', shimmer: 'animate-shimmer' },
};

function StarDisplay({ stars }: { stars: number }) {
  if (stars <= 0) return null;
  return (
    <div className="flex justify-center gap-0.5">
      {Array.from({ length: stars }).map((_, i) => (
        <span key={i} className="text-[8px] text-yellow-400 drop-shadow-[0_0_3px_rgba(250,204,21,0.6)]">★</span>
      ))}
    </div>
  );
}

export default function CardComponent({ card, isSelected, onClick, compact }: Props) {
  const { lang } = useI18n();
  const stars = card.stars ?? 0;
  const displayPower = (card.power ?? 0) + stars;
  const displayDamage = (card.damage ?? 0) + stars;
  const clan = card.clan || 'Неоновые Наемники';
  const rarity = card.rarity || 'common';
  const config = rarityConfig[rarity] || rarityConfig.common;
  const bgClass = clanBg[clan] || '';
  const artSrc = cardArt[card.id];
  const ability = abilityInfo[card.ability] || { icon: '❓', desc: card.ability || '—', color: 'text-white/50' };

  const cardName = getCardName(lang, card.id);
  const abilityName = getAbilityName(lang, card.ability);
  const powerLabel = getStatLabel(lang, 'power');
  const damageLabel = getStatLabel(lang, 'damage');
  const rarityLabel = getRarityLabel(lang, rarity);

  // ═══ COMPACT MODE ═══
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`
          relative w-full rounded-xl overflow-hidden
          bg-gradient-to-b from-gray-900 to-gray-950
          ${bgClass}
          border ${config.border} ${config.glow}
          transition-all duration-200 active:scale-95 flex flex-col
          ${isSelected ? 'scale-[1.03] border-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.5)]' : ''}
        `}
      >
        {rarity === 'legendary' && <div className="absolute inset-0 animate-shimmer pointer-events-none rounded-xl" />}

        {/* Image — takes most of the card */}
        <div className="relative w-full aspect-[3/4] overflow-hidden bg-black">
          {artSrc ? (
            <img src={artSrc} alt="" className="block w-full h-full" style={{ objectFit: 'cover', objectPosition: 'center top' }} loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">🃏</div>
          )}
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

          {/* Rarity badge — top right */}
          <div className="absolute top-1.5 right-1.5 z-10">
            <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-bold ${config.badge}`}>
              {rarityLabel}
            </span>
          </div>

          {/* Card name — bottom of image */}
          <div className="absolute bottom-0 left-0 right-0 px-2 pb-1 z-10">
            <div className="font-bold text-[11px] leading-tight text-white drop-shadow-lg text-center truncate">
              {cardName}
            </div>
            <StarDisplay stars={stars} />
          </div>
        </div>

        {/* Stats bar — compact at bottom */}
        <div className="flex items-center justify-between px-2 py-1.5 bg-black/60 backdrop-blur-sm">
          {/* Power */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-white/50">{powerLabel}</span>
            <span className="text-sm font-black text-white">{displayPower}</span>
          </div>

          {/* Ability icon */}
          <div className="flex items-center gap-0.5">
            <span className="text-[10px]">{ability.icon}</span>
            <span className={`text-[8px] font-bold ${ability.color} max-w-[60px] truncate`}>{abilityName}</span>
          </div>

          {/* Damage */}
          <div className="flex items-center gap-1">
            <span className="text-sm font-black text-red-300">{displayDamage}</span>
            <span className="text-[8px] text-white/50">{damageLabel}</span>
          </div>
        </div>

        {isSelected && (
          <div className="absolute inset-0 border-2 border-yellow-400 rounded-xl pointer-events-none animate-glow-pulse" />
        )}
      </button>
    );
  }

  // ═══ FULL-SIZE MODE ═══
  return (
    <button
      onClick={onClick}
      className={`
        relative w-44 rounded-2xl overflow-hidden
        bg-gradient-to-b from-gray-900 to-gray-950
        ${bgClass}
        border-2 ${config.border} ${config.glow}
        transition-all duration-200 hover:scale-105 active:scale-95 flex flex-col
        ${isSelected ? 'scale-105 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]' : ''}
      `}
    >
      {rarity === 'legendary' && <div className="absolute inset-0 animate-shimmer pointer-events-none rounded-2xl" />}

      {/* Image — takes most of the card */}
      <div className="relative w-full aspect-[3/4] overflow-hidden bg-black">
        {artSrc ? (
          <img src={artSrc} alt="" className="block w-full h-full" style={{ objectFit: 'cover', objectPosition: 'center top' }} loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">🃏</div>
        )}
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

        {/* Rarity badge — top right */}
        <div className="absolute top-2 right-2 z-10">
          <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${config.badge}`}>
            {rarityLabel}
          </span>
        </div>

        {/* Card name — bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2 z-10">
          <div className="font-bold text-sm leading-tight text-white drop-shadow-lg text-center">
            {cardName}
          </div>
          <div className="flex justify-center mt-0.5">
            <StarDisplay stars={stars} />
          </div>
        </div>
      </div>

      {/* Info bar — at bottom */}
      <div className="px-2.5 py-2 bg-black/70 backdrop-blur-sm">
        {/* Ability */}
        <div className="flex items-center justify-center gap-1 mb-1.5">
          <span className="text-xs">{ability.icon}</span>
          <span className={`text-[10px] font-bold ${ability.color}`}>{abilityName}</span>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-white/50">{powerLabel}</span>
            <span className="text-lg font-black text-white">{displayPower}</span>
          </div>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-1">
            <span className="text-lg font-black text-red-300">{displayDamage}</span>
            <span className="text-[9px] text-white/50">{damageLabel}</span>
          </div>
        </div>
      </div>

      {isSelected && (
        <div className="absolute inset-0 border-2 border-yellow-400 rounded-2xl pointer-events-none animate-glow-pulse" />
      )}
    </button>
  );
}
