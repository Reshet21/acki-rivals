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

// Unique visual treatment per card ID (hue, brightness, contrast, saturate, overlay color)
const cardVisuals: Record<number, { hue: number; bright: number; contrast: number; saturate: number; overlay: string }> = {
  1:  { hue: 0, bright: 0.9, contrast: 1.1, saturate: 1.2, overlay: 'rgba(100,80,60,0.15)' },
  2:  { hue: 15, bright: 1.0, contrast: 1.0, saturate: 1.0, overlay: 'rgba(60,120,180,0.1)' },
  3:  { hue: -10, bright: 0.85, contrast: 1.15, saturate: 1.3, overlay: 'rgba(0,200,100,0.1)' },
  4:  { hue: 20, bright: 1.05, contrast: 1.1, saturate: 0.9, overlay: 'rgba(0,150,255,0.12)' },
  5:  { hue: -20, bright: 0.95, contrast: 1.2, saturate: 1.4, overlay: 'rgba(200,50,50,0.1)' },
  6:  { hue: 30, bright: 1.0, contrast: 1.05, saturate: 1.1, overlay: 'rgba(150,100,200,0.12)' },
  7:  { hue: -30, bright: 0.8, contrast: 1.3, saturate: 0.8, overlay: 'rgba(50,0,100,0.2)' },
  8:  { hue: 0, bright: 1.1, contrast: 1.15, saturate: 1.5, overlay: 'rgba(255,200,0,0.1)' },
  9:  { hue: 45, bright: 1.0, contrast: 1.0, saturate: 1.2, overlay: 'rgba(0,200,150,0.12)' },
  10: { hue: -45, bright: 0.9, contrast: 1.1, saturate: 0.9, overlay: 'rgba(100,200,100,0.1)' },
  11: { hue: 60, bright: 0.95, contrast: 1.2, saturate: 1.3, overlay: 'rgba(200,150,50,0.1)' },
  12: { hue: -60, bright: 1.05, contrast: 1.1, saturate: 1.0, overlay: 'rgba(150,50,200,0.12)' },
  13: { hue: 90, bright: 0.85, contrast: 1.25, saturate: 1.4, overlay: 'rgba(50,150,200,0.1)' },
  14: { hue: -90, bright: 1.0, contrast: 1.15, saturate: 1.1, overlay: 'rgba(200,100,100,0.1)' },
  15: { hue: 120, bright: 0.9, contrast: 1.2, saturate: 1.2, overlay: 'rgba(100,200,50,0.1)' },
  16: { hue: -120, bright: 1.05, contrast: 1.1, saturate: 1.3, overlay: 'rgba(50,100,200,0.12)' },
  17: { hue: 150, bright: 0.85, contrast: 1.3, saturate: 1.5, overlay: 'rgba(200,50,100,0.12)' },
  18: { hue: -150, bright: 0.95, contrast: 1.15, saturate: 1.0, overlay: 'rgba(100,50,200,0.1)' },
  19: { hue: 180, bright: 0.9, contrast: 1.2, saturate: 0.8, overlay: 'rgba(0,100,150,0.15)' },
  20: { hue: -180, bright: 1.0, contrast: 1.1, saturate: 1.4, overlay: 'rgba(200,100,50,0.1)' },
  21: { hue: 200, bright: 0.85, contrast: 1.25, saturate: 1.2, overlay: 'rgba(50,200,100,0.1)' },
  22: { hue: -200, bright: 1.05, contrast: 1.15, saturate: 1.1, overlay: 'rgba(150,150,50,0.12)' },
  23: { hue: 220, bright: 0.95, contrast: 1.2, saturate: 1.3, overlay: 'rgba(100,50,150,0.1)' },
  24: { hue: -220, bright: 0.9, contrast: 1.1, saturate: 1.0, overlay: 'rgba(200,150,100,0.1)' },
  25: { hue: 240, bright: 1.0, contrast: 1.3, saturate: 1.5, overlay: 'rgba(50,100,200,0.12)' },
  26: { hue: -240, bright: 0.85, contrast: 1.15, saturate: 0.9, overlay: 'rgba(150,50,100,0.1)' },
  27: { hue: 270, bright: 0.95, contrast: 1.2, saturate: 1.2, overlay: 'rgba(100,150,200,0.1)' },
  28: { hue: -270, bright: 1.05, contrast: 1.1, saturate: 1.4, overlay: 'rgba(200,50,150,0.12)' },
  29: { hue: 300, bright: 0.9, contrast: 1.25, saturate: 1.1, overlay: 'rgba(50,200,200,0.1)' },
  30: { hue: -300, bright: 1.0, contrast: 1.15, saturate: 1.3, overlay: 'rgba(150,100,50,0.1)' },
  31: { hue: 330, bright: 0.85, contrast: 1.3, saturate: 1.5, overlay: 'rgba(200,100,200,0.12)' },
  32: { hue: -330, bright: 0.95, contrast: 1.2, saturate: 1.0, overlay: 'rgba(100,200,150,0.1)' },
  33: { hue: 360, bright: 1.05, contrast: 1.1, saturate: 1.2, overlay: 'rgba(50,150,250,0.1)' },
  34: { hue: -360, bright: 0.9, contrast: 1.25, saturate: 1.4, overlay: 'rgba(250,150,50,0.12)' },
};

// Rarity-specific overlay colors
const rarityOverlay: Record<string, string> = {
  common: 'rgba(150,150,150,0.05)',
  uncommon: 'rgba(74,222,128,0.08)',
  rare: 'rgba(96,165,250,0.1)',
  epic: 'rgba(168,85,247,0.12)',
  legendary: 'rgba(250,204,21,0.15)',
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
  const visual = cardVisuals[card.id] || cardVisuals[1];
  const rOverlay = rarityOverlay[rarity] || '';
  const imgFilter = `hue-rotate(${visual.hue}deg) brightness(${visual.bright}) contrast(${visual.contrast}) saturate(${visual.saturate})`;

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
            <img src={artSrc} alt="" className="w-full h-full object-cover" style={{ filter: imgFilter }} loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">🃏</div>
          )}
          <div className="absolute inset-0" style={{ background: visual.overlay }} />
          <div className="absolute inset-0" style={{ background: rOverlay }} />
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
          <img src={artSrc} alt="" className="w-full h-full object-cover" style={{ filter: imgFilter }} loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🃏</div>
        )}
        <div className="absolute inset-0" style={{ background: visual.overlay }} />
        <div className="absolute inset-0" style={{ background: rOverlay }} />
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
