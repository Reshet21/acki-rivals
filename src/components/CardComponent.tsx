import type { Card } from '../types';
import { useI18n } from '../i18n';
import { getCardName, getAbilityName, getClanName, getStatLabel, getRarityLabel } from '../i18n/cardTranslations';

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

// AN-style character illustrations
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
    <div className="flex justify-center gap-0.5 mt-0.5">
      {Array.from({ length: stars }).map((_, i) => (
        <span key={i} className="text-[9px] text-yellow-400 drop-shadow-[0_0_3px_rgba(250,204,21,0.6)]">★</span>
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
  const clanName = getClanName(lang, clan);
  const powerLabel = getStatLabel(lang, 'power');
  const damageLabel = getStatLabel(lang, 'damage');
  const rarityLabel = getRarityLabel(lang, rarity);

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

        {/* Character art */}
        <div className="relative w-full h-16 overflow-hidden bg-black/30">
          {artSrc ? (
            <img src={artSrc} alt="" className="block w-full h-full" style={{ objectFit: 'cover', objectPosition: 'center top' }} loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">🃏</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />
          <div className="absolute top-1 right-1 z-10">
            <span className={`text-[6px] px-1.5 py-0.5 rounded-full font-bold ${config.badge}`}>
              {rarityLabel}
            </span>
          </div>
        </div>

        <div className="p-1.5 flex flex-col gap-0.5 flex-1 relative z-10">
          <div className="text-center">
            <div className="font-bold text-[11px] leading-tight text-white drop-shadow-md truncate px-0.5">
              {cardName}
            </div>
            <StarDisplay stars={stars} />
          </div>

          {/* Ability with icon + description */}
          <div className="bg-black/40 rounded-md px-1.5 py-0.5 flex items-center gap-1 backdrop-blur-sm border border-white/5">
            <span className="text-[9px]">{ability.icon}</span>
            <div className="flex-1 min-w-0">
              <div className={`text-[8px] font-bold leading-tight truncate ${ability.color}`}>
                {abilityName}
              </div>
              <div className="text-[7px] text-white/40 leading-tight truncate">{ability.desc}</div>
            </div>
          </div>

          <div className="flex justify-between items-center px-0.5">
            <div className="text-center flex-1">
              <div className="text-[6px] text-white/40 uppercase">{powerLabel}</div>
              <div className="text-sm font-black text-white drop-shadow-md">{displayPower}</div>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="text-center flex-1">
              <div className="text-[6px] text-white/40 uppercase">{damageLabel}</div>
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

      {/* Character art */}
      <div className="relative w-full h-24 overflow-hidden bg-black/30">
        {artSrc ? (
          <img src={artSrc} alt="" className="block w-full h-full" style={{ objectFit: 'cover', objectPosition: 'center top' }} loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🃏</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
        <div className="absolute top-2 right-2 z-10">
          <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${config.badge}`}>
            {rarityLabel}
          </span>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-1.5 flex-1 relative z-10">
        <div className="text-center">
          <div className="font-bold text-sm leading-tight text-white drop-shadow-lg">
            {cardName}
          </div>
          <StarDisplay stars={stars} />
          <div className="text-[9px] text-white/50 mt-0.5">{clanName}</div>
        </div>

        {/* Ability with icon + description */}
        <div className="bg-black/30 rounded-lg p-2 text-center backdrop-blur-sm border border-white/5">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <span className="text-sm">{ability.icon}</span>
            <span className={`text-[10px] font-bold ${ability.color}`}>
              {abilityName}
            </span>
          </div>
          <div className="text-[9px] text-white/50">{ability.desc}</div>
        </div>

        <div className="flex justify-between items-center mt-auto">
          <div className="text-center flex-1">
            <div className="text-[8px] text-white/40 uppercase">{powerLabel}</div>
            <div className="text-2xl font-black text-white drop-shadow-lg">{displayPower}</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center flex-1">
            <div className="text-[8px] text-white/40 uppercase">{damageLabel}</div>
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
