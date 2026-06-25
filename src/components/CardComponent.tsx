import type { Card } from '../types';
import { useI18n } from '../i18n';
import { getCardName, getAbilityName, getStatLabel } from '../i18n/cardTranslations';

interface Props {
  card: Card;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

const abilityInfo: Record<string, { icon: string; color: string }> = {
  '+1 power':          { icon: '⚔️', color: '#60a5fa' },
  '+2 power':          { icon: '⚔️', color: '#93c5fd' },
  '+3 power':          { icon: '⚔️', color: '#bfdbfe' },
  '+4 power':          { icon: '⚔️', color: '#67e8f9' },
  '+1 damage':         { icon: '💥', color: '#f87171' },
  '+2 damage':         { icon: '💥', color: '#fca5a5' },
  '+1 pillz':          { icon: '💊', color: '#4ade80' },
  '+3 pillz':          { icon: '💊', color: '#86efac' },
  '-1 opponent power': { icon: '🛡️', color: '#fb923c' },
  '-2 opponent power': { icon: '🛡️', color: '#fdba74' },
  '-2 opponent damage':{ icon: '🛡️', color: '#fb923c' },
  'heal 1':           { icon: '💚', color: '#4ade80' },
  'heal 2':           { icon: '💚', color: '#86efac' },
  'heal 3':           { icon: '💚', color: '#bbf7d0' },
  'poison 1':         { icon: '☠️', color: '#facc15' },
  'poison 2':         { icon: '☠️', color: '#fde047' },
  'poison 3':         { icon: '☠️', color: '#fef08a' },
  'life steal 1':     { icon: '🩸', color: '#c084fc' },
  'life steal 2':     { icon: '🩸', color: '#d8b4fe' },
  'life steal 3':     { icon: '🩸', color: '#e9d5ff' },
  'stop opponent ability': { icon: '🚫', color: '#f87171' },
  'double damage':    { icon: '⚡', color: '#fde047' },
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

const rarityCfg: Record<string, {
  gemColor: string;
  gemGlow: string;
  borderGradient: string;
  frameGlow: string;
  badgeText: string;
  badgeColor: string;
  shineLine: string;
}> = {
  common:    { gemColor: 'radial-gradient(circle at 35% 30%, #c0c0c0, #6b7280 50%, #374151)', gemGlow: '0 0 6px #9ca3af', borderGradient: 'linear-gradient(135deg, #4b5563, #6b7280, #374151, #4b5563)', frameGlow: '', badgeText: 'ОБЫЧНАЯ', badgeColor: '#6b7280', shineLine: '' },
  uncommon:  { gemColor: 'radial-gradient(circle at 35% 30%, #6ee7b7, #10b981 50%, #065f46)', gemGlow: '0 0 10px #10b981', borderGradient: 'linear-gradient(135deg, #064e3b, #10b981, #065f46, #059669)', frameGlow: '0 0 12px rgba(16,185,129,0.4)', badgeText: 'НЕОБЫЧНАЯ', badgeColor: '#10b981', shineLine: '' },
  rare:      { gemColor: 'radial-gradient(circle at 35% 30%, #93c5fd, #3b82f6 50%, #1e3a8a)', gemGlow: '0 0 14px #3b82f6', borderGradient: 'linear-gradient(135deg, #1e3a8a, #3b82f6, #1d4ed8, #2563eb)', frameGlow: '0 0 18px rgba(59,130,246,0.5)', badgeText: 'РЕДКАЯ', badgeColor: '#3b82f6', shineLine: '' },
  epic:      { gemColor: 'radial-gradient(circle at 35% 30%, #e9d5ff, #a855f7 50%, #581c87)', gemGlow: '0 0 18px #a855f7', borderGradient: 'linear-gradient(135deg, #581c87, #a855f7, #7e22ce, #9333ea)', frameGlow: '0 0 24px rgba(168,85,247,0.6)', badgeText: 'ЭПИЧЕСКАЯ', badgeColor: '#a855f7', shineLine: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.3), transparent)' },
  legendary: { gemColor: 'radial-gradient(circle at 35% 30%, #fef08a, #f59e0b 50%, #78350f)', gemGlow: '0 0 22px #f59e0b, 0 0 40px rgba(245,158,11,0.4)', borderGradient: 'linear-gradient(135deg, #78350f, #f59e0b, #b45309, #fbbf24)', frameGlow: '0 0 30px rgba(245,158,11,0.5), 0 0 60px rgba(245,158,11,0.2)', badgeText: 'ЛЕГЕНДАРНАЯ', badgeColor: '#f59e0b', shineLine: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.3), transparent)' },
};

export default function CardComponent({ card, isSelected, onClick, compact }: Props) {
  const { lang } = useI18n();
  const stars = card.stars ?? 0;
  const rarity = card.rarity || 'common';
  const g = rarityCfg[rarity] || rarityCfg.common;
  const artSrc = cardArt[card.id];
  const ab = abilityInfo[card.ability] || { icon: '❓', color: '#9ca3af' };

  const cardName = getCardName(lang, card.id);
  const abilityName = getAbilityName(lang, card.ability);
  const powerLabel = getStatLabel(lang, 'power');
  const damageLabel = getStatLabel(lang, 'damage');
  const power = (card.power ?? 0) + stars;
  const damage = (card.damage ?? 0) + stars;

  // ═══ COMPACT ═══
  if (compact) {
    return (
      <button onClick={onClick} style={{
        width: '100%', borderRadius: 10, border: '2px solid', borderColor: 'transparent',
        background: 'linear-gradient(160deg, #0f0a05 0%, #1a120a 50%, #0f0a05 100%)',
        backgroundClip: 'padding-box',
        boxShadow: `inset 0 0 0 2px rgba(255,255,255,0.05), ${g.frameGlow}${isSelected ? ', 0 0 20px rgba(251,191,36,0.8)' : ''}`,
        outline: isSelected ? '2px solid #fbbf24' : 'none',
        cursor: 'pointer', transition: 'all 0.2s',
        transform: isSelected ? 'scale(1.04)' : 'scale(1)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ height: 2, background: g.borderGradient }} />
        <div style={{ position: 'relative', width: '100%', height: 64, overflow: 'hidden', background: '#080503' }}>
          {artSrc ? <img src={artSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, opacity: 0.15 }}>🃏</div>}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0f0a05 0%, transparent 60%)' }} />
          <div style={{ position: 'absolute', top: 4, left: 4 }}><div style={{ width: 14, height: 14, borderRadius: 3, background: g.gemColor, boxShadow: g.gemGlow, border: '1px solid rgba(255,255,255,0.1)' }} /></div>
          <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 6, fontWeight: 700, color: g.badgeColor, background: 'rgba(0,0,0,0.7)', padding: '1px 4px', borderRadius: 3, border: `1px solid ${g.badgeColor}40`, letterSpacing: '0.05em' }}>{g.badgeText}</div>
          {g.shineLine && <div style={{ position: 'absolute', inset: 0, background: g.shineLine, animation: 'shimmer 2s infinite' }} />}
        </div>
        <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontWeight: 800, fontSize: 11, color: '#e5d5b0', textAlign: 'center', lineHeight: 1.2, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            {cardName || '???'}{stars > 0 && <span style={{ color: '#fbbf24', marginLeft: 3, fontSize: 9 }}>{'★'.repeat(stars)}</span>}
          </div>
          <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 5, padding: '2px 5px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 9 }}>{ab.icon}</span>
            <span style={{ fontSize: 8, color: ab.color, fontWeight: 700, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{abilityName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{powerLabel}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#e2e8f0', lineHeight: 1, textShadow: '0 0 8px rgba(255,255,255,0.3)' }}>{power}</div>
            </div>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{damageLabel}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fca5a5', lineHeight: 1, textShadow: '0 0 8px rgba(252,165,165,0.4)' }}>{damage}</div>
            </div>
          </div>
        </div>
        <div style={{ height: 2, background: g.borderGradient }} />
      </button>
    );
  }

  // ═══ FULL ═══
  return (
    <button onClick={onClick} style={{
      width: 160, borderRadius: 12, border: '2px solid', borderColor: 'transparent',
      background: 'linear-gradient(160deg, #0f0a05 0%, #1a120a 50%, #0f0a05 100%)',
      backgroundClip: 'padding-box',
      boxShadow: `inset 0 0 0 2px rgba(255,255,255,0.05), ${g.frameGlow}${isSelected ? ', 0 0 20px rgba(251,191,36,0.8)' : ''}`,
      outline: isSelected ? '2px solid #fbbf24' : 'none',
      cursor: 'pointer', transition: 'all 0.2s',
      transform: isSelected ? 'scale(1.04)' : 'scale(1)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ height: 3, background: g.borderGradient }} />
      <div style={{ position: 'relative', width: '100%', height: 130, overflow: 'hidden', background: '#060402' }}>
        {artSrc ? <img src={artSrc} alt={cardName} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, opacity: 0.12 }}>🃏</div>}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: 'linear-gradient(to top, #110d06 0%, transparent 100%)' }} />
        <div style={{ position: 'absolute', top: 6, left: 6 }}><div style={{ width: 16, height: 16, borderRadius: 4, background: g.gemColor, boxShadow: g.gemGlow, border: '1px solid rgba(255,255,255,0.1)' }} /></div>
        <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 7, fontWeight: 700, color: g.badgeColor, background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 4, border: `1px solid ${g.badgeColor}40`, letterSpacing: '0.05em' }}>{g.badgeText}</div>
        {g.shineLine && <div style={{ position: 'absolute', inset: 0, background: g.shineLine, animation: 'shimmer 2s infinite' }} />}
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 12, color: '#e5d5b0', textAlign: 'center', lineHeight: 1.2, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
          {cardName || '???'}{stars > 0 && <span style={{ color: '#fbbf24', marginLeft: 3, fontSize: 10 }}>{'★'.repeat(stars)}</span>}
        </div>
        <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 5, padding: '3px 6px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10 }}>{ab.icon}</span>
          <span style={{ fontSize: 9, color: ab.color, fontWeight: 700, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{abilityName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{powerLabel}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#e2e8f0', lineHeight: 1, textShadow: '0 0 8px rgba(255,255,255,0.3)' }}>{power}</div>
          </div>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{damageLabel}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fca5a5', lineHeight: 1, textShadow: '0 0 8px rgba(252,165,165,0.4)' }}>{damage}</div>
          </div>
        </div>
      </div>
      <div style={{ height: 3, background: g.borderGradient }} />
    </button>
  );
}
