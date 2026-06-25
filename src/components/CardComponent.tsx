import type { Card } from '../types';
import { useI18n } from '../i18n';
import { getCardName, getAbilityName, getStatLabel, getRarityLabel } from '../i18n/cardTranslations';

interface Props {
  card: Card;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

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

const cardArt: Record<number, string> = {
  1: '/cards/card-rusty-drone.png', 2: '/cards/card-patrol.png', 3: '/cards/card-hacker.png',
  4: '/cards/card-neon-sniper.png', 5: '/cards/card-cyber-wolf.png', 6: '/cards/card-circuit-guardian.jpeg',
  7: '/cards/card-phantom.png', 8: '/cards/card-acki-nacki.jpeg', 9: '/cards/card-mamabord.jpeg',
  10: '/cards/card-mamabord.jpeg', 11: '/cards/card-block-keeper.jpeg', 12: '/cards/card-block-keeper.jpeg',
  13: '/cards/card-block-keeper.jpeg', 14: '/cards/card-block-manager.jpeg', 15: '/cards/card-block-manager.jpeg',
  16: '/cards/card-block-manager.jpeg', 17: '/cards/card-malicious-block.jpeg', 18: '/cards/card-circuit-guardian.jpeg',
  19: '/cards/card-phantom.png', 20: '/cards/card-cyber-killer.png', 21: '/cards/card-mamabord.jpeg',
  22: '/cards/card-block-keeper.jpeg', 23: '/cards/card-courier.png', 24: '/cards/card-raider.png',
  25: '/cards/card-saboteur.png', 26: '/cards/card-cyber-killer.png', 27: '/cards/card-circuit-guardian.jpeg',
  28: '/cards/card-malicious-block.jpeg', 29: '/cards/card-block-keeper.jpeg', 30: '/cards/card-mamabord.jpeg',
  31: '/cards/card-saboteur.png', 32: '/cards/card-block-keeper.jpeg', 33: '/cards/card-circuit-guardian.jpeg',
  34: '/cards/card-malicious-block.jpeg',
};

// Replit-accurate rarity config with border gradients and frame glows
const rarityStyle: Record<string, {
  borderGradient: string;
  frameGlow: string;
  badgeText: string;
  badgeColor: string;
  shineLine: string;
}> = {
  common: {
    borderGradient: 'linear-gradient(135deg, #4b5563, #6b7280, #374151, #4b5563)',
    frameGlow: '',
    badgeText: 'ОБЫЧНАЯ',
    badgeColor: '#6b7280',
    shineLine: '',
  },
  uncommon: {
    borderGradient: 'linear-gradient(135deg, #064e3b, #10b981, #065f46, #059669)',
    frameGlow: '0 0 12px rgba(16,185,129,0.4)',
    badgeText: 'НЕОБЫЧНАЯ',
    badgeColor: '#10b981',
    shineLine: '',
  },
  rare: {
    borderGradient: 'linear-gradient(135deg, #1e3a8a, #3b82f6, #1d4ed8, #2563eb)',
    frameGlow: '0 0 18px rgba(59,130,246,0.5)',
    badgeText: 'РЕДКАЯ',
    badgeColor: '#3b82f6',
    shineLine: '',
  },
  epic: {
    borderGradient: 'linear-gradient(135deg, #581c87, #a855f7, #7e22ce, #9333ea)',
    frameGlow: '0 0 24px rgba(168,85,247,0.6)',
    badgeText: 'ЭПИЧЕСКАЯ',
    badgeColor: '#a855f7',
    shineLine: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.3), transparent)',
  },
  legendary: {
    borderGradient: 'linear-gradient(135deg, #78350f, #f59e0b, #b45309, #fbbf24)',
    frameGlow: '0 0 30px rgba(245,158,11,0.5), 0 0 60px rgba(245,158,11,0.2)',
    badgeText: 'ЛЕГЕНДАРНАЯ',
    badgeColor: '#f59e0b',
    shineLine: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.3), transparent)',
  },
};

function StarDisplay({ stars }: { stars: number }) {
  if (stars <= 0) return null;
  return (
    <div className="flex justify-center gap-0.5">
      {Array.from({ length: stars }).map((_, i) => (
        <span key={i} style={{ fontSize: 8, color: '#fbbf24', textShadow: '0 0 4px rgba(251,191,36,0.6)' }}>★</span>
      ))}
    </div>
  );
}

export default function CardComponent({ card, isSelected, onClick, compact }: Props) {
  const { lang } = useI18n();
  const stars = card.stars ?? 0;
  const displayPower = (card.power ?? 0) + stars;
  const displayDamage = (card.damage ?? 0) + stars;
  const rarity = card.rarity || 'common';
  const style = rarityStyle[rarity] || rarityStyle.common;
  const artSrc = cardArt[card.id];
  const ability = abilityInfo[card.ability] || { icon: '❓', desc: card.ability || '—', color: 'text-white/50' };

  const cardName = getCardName(lang, card.id);
  const abilityName = getAbilityName(lang, card.ability);
  const powerLabel = getStatLabel(lang, 'power');
  const damageLabel = getStatLabel(lang, 'damage');
  const rarityLabel = getRarityLabel(lang, rarity);

  // ═══ COMPACT MODE (Replit style) ═══
  if (compact) {
    return (
      <button
        onClick={onClick}
        style={{
          width: '100%',
          borderRadius: 10,
          border: '2px solid transparent',
          background: `linear-gradient(160deg, #0f0a05 0%, #1a120a 50%, #0f0a05 100%)`,
          boxShadow: `inset 0 0 0 2px rgba(255,255,255,0.05), ${style.frameGlow}${isSelected ? ', 0 0 20px rgba(251,191,36,0.8)' : ''}`,
          outline: isSelected ? '2px solid #fbbf24' : 'none',
          cursor: 'pointer',
          transition: 'all 0.2s',
          transform: isSelected ? 'scale(1.04)' : 'scale(1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Border gradient bar — top */}
        <div style={{ height: 2, background: style.borderGradient }} />

        {/* Image — Replit height 64px */}
        <div style={{ position: 'relative', width: '100%', height: 64, overflow: 'hidden', background: '#080503' }}>
          {artSrc ? (
            <img src={artSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} loading="lazy" />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, opacity: 0.15 }}>🃏</div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0f0a05 0%, transparent 60%)' }} />

          {/* Badge — rarity gem */}
          <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 2 }}>
            <div style={{
              fontSize: 7,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 4,
              background: style.badgeColor,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}>
              {rarityLabel}
            </div>
          </div>

          {/* Card name */}
          <div style={{
            position: 'absolute',
            bottom: 4,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: '#eee8d5',
            textShadow: '0 1px 6px rgba(0,0,0,0.8)',
            lineHeight: 1.2,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            padding: '0 8px',
            zIndex: 2,
          }}>
            {cardName}
          </div>
        </div>

        {/* Shine line for epic/legendary */}
        {style.shineLine && (
          <div style={{ height: 1, background: style.shineLine }} />
        )}

        {/* Stats area */}
        <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Ability */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <span style={{ fontSize: 10 }}>{ability.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: style.badgeColor }}>{abilityName}</span>
          </div>

          {/* Power / Damage row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const }}>{powerLabel}</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{displayPower}</span>
            </div>
            <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#fca5a5', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{displayDamage}</span>
              <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const }}>{damageLabel}</span>
            </div>
          </div>

          {/* Stars */}
          <StarDisplay stars={stars} />
        </div>
      </button>
    );
  }

  // ═══ FULL-SIZE MODE (Replit style) ═══
  return (
    <button
      onClick={onClick}
      style={{
        width: 160,
        borderRadius: 12,
        border: '2px solid transparent',
        background: `linear-gradient(160deg, #0f0a05 0%, #1a120a 50%, #0f0a05 100%)`,
        boxShadow: `inset 0 0 0 2px rgba(255,255,255,0.05), ${style.frameGlow}${isSelected ? ', 0 0 20px rgba(251,191,36,0.8)' : ''}`,
        outline: isSelected ? '2px solid #fbbf24' : 'none',
        cursor: 'pointer',
        transition: 'all 0.2s',
        transform: isSelected ? 'scale(1.04)' : 'scale(1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Border gradient bar — top */}
      <div style={{ height: 3, background: style.borderGradient }} />

      {/* Image — Replit height 130px */}
      <div style={{ position: 'relative', width: '100%', height: 130, overflow: 'hidden', background: '#060402' }}>
        {artSrc ? (
          <img src={artSrc} alt={cardName} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, opacity: 0.12 }}>🃏</div>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: 'linear-gradient(to top, #110d06 0%, transparent 100%)' }} />

        {/* Badge */}
        <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }}>
          <div style={{
            fontSize: 8,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 5,
            background: style.badgeColor,
            color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}>
            {rarityLabel}
          </div>
        </div>

        {/* Card name */}
        <div style={{
          position: 'absolute',
          bottom: 6,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 700,
          color: '#eee8d5',
          textShadow: '0 1px 8px rgba(0,0,0,0.9)',
          lineHeight: 1.2,
          padding: '0 8px',
          zIndex: 2,
        }}>
          {cardName}
          <div style={{ marginTop: 2 }}>
            <StarDisplay stars={stars} />
          </div>
        </div>
      </div>

      {/* Shine line */}
      {style.shineLine && (
        <div style={{ height: 1, background: style.shineLine }} />
      )}

      {/* Stats area */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {/* Ability */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <span style={{ fontSize: 12 }}>{ability.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: style.badgeColor }}>{abilityName}</span>
        </div>

        {/* Power / Damage */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const }}>{powerLabel}</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>{displayPower}</span>
          </div>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#fca5a5', textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>{displayDamage}</span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const }}>{damageLabel}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
