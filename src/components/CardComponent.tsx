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

const RARITY: Record<string, { grad: string; glow: string; badge: string; color: string }> = {
  common:    { grad: '#6b7280', glow: '', badge: 'ОБЫЧ', color: '#6b7280' },
  uncommon:  { grad: '#10b981', glow: '0 0 12px rgba(16,185,129,0.4)', badge: 'НЕОБЫЧ', color: '#10b981' },
  rare:      { grad: '#3b82f6', glow: '0 0 18px rgba(59,130,246,0.5)', badge: 'РЕДК', color: '#3b82f6' },
  epic:      { grad: '#a855f7', glow: '0 0 24px rgba(168,85,247,0.6)', badge: 'ЭПИЧ', color: '#a855f7' },
  legendary: { grad: '#f59e0b', glow: '0 0 30px rgba(245,158,11,0.5)', badge: 'ЛЕГЕНД', color: '#f59e0b' },
};

export default function CardComponent({ card, isSelected, onClick, compact }: Props) {
  const { lang } = useI18n();
  const stars = card.stars ?? 0;
  const r = RARITY[card.rarity || 'common'] || RARITY.common;
  const art = cardArt[card.id];
  const ab = abilityInfo[card.ability] || { icon: '❓', color: '#9ca3af' };
  const name = getCardName(lang, card.id);
  const abName = getAbilityName(lang, card.ability);
  const pLabel = getStatLabel(lang, 'power');
  const dLabel = getStatLabel(lang, 'damage');
  const pwr = (card.power ?? 0) + stars;
  const dmg = (card.damage ?? 0) + stars;

  const frameClass = `card-frame card-rarity-${card.rarity || 'common'}${isSelected ? ' card-selected' : ''}`;

  if (compact) {
    return (
      <button onClick={onClick} className={frameClass}>
        <div className="card-border-top" style={{ background: `linear-gradient(90deg, ${r.grad}40, ${r.grad}, ${r.grad}40)` }} />
        <div className="card-image" style={{ height: 64 }}>
          {art ? <img src={art} alt="" className="card-img" /> : <div className="card-placeholder">🃏</div>}
          <div className="card-image-overlay" />
          <div className="card-gem" style={{ background: `radial-gradient(circle at 35% 30%, ${r.color}cc, ${r.color} 50%, ${r.color}80)`, boxShadow: r.glow }} />
          <div className="card-badge" style={{ color: r.color, borderColor: `${r.color}40` }}>{r.badge}</div>
        </div>
        <div className="card-stats">
          <div className="card-name">{name}{stars > 0 && <span className="card-stars">{'★'.repeat(stars)}</span>}</div>
          <div className="card-ability">
            <span>{ab.icon}</span>
            <span style={{ color: ab.color }}>{abName}</span>
          </div>
          <div className="card-row">
            <div className="card-stat"><span className="card-label">{pLabel}</span><span className="card-val">{pwr}</span></div>
            <div className="card-divider" />
            <div className="card-stat"><span className="card-val card-dmg">{dmg}</span><span className="card-label">{dLabel}</span></div>
          </div>
        </div>
        <div className="card-border-bottom" style={{ background: `linear-gradient(90deg, ${r.grad}40, ${r.grad}, ${r.grad}40)` }} />
      </button>
    );
  }

  return (
    <button onClick={onClick} className={frameClass} style={{ width: 160 }}>
      <div className="card-border-top" style={{ height: 3, background: `linear-gradient(90deg, ${r.grad}40, ${r.grad}, ${r.grad}40)` }} />
      <div className="card-image" style={{ height: 130 }}>
        {art ? <img src={art} alt={name} className="card-img" style={{ objectPosition: 'center top' }} /> : <div className="card-placeholder" style={{ fontSize: 44 }}>🃏</div>}
        <div className="card-image-overlay" style={{ background: 'linear-gradient(to top, #110d06 0%, transparent 100%)' }} />
        <div className="card-gem" style={{ width: 16, height: 16, top: 6, left: 6, background: `radial-gradient(circle at 35% 30%, ${r.color}cc, ${r.color} 50%, ${r.color}80)`, boxShadow: r.glow }} />
        <div className="card-badge" style={{ top: 6, right: 6, fontSize: 7, padding: '2px 6px', color: r.color, borderColor: `${r.color}40` }}>{r.badge}</div>
      </div>
      <div className="card-stats" style={{ padding: '8px 10px', gap: 5 }}>
        <div className="card-name" style={{ fontSize: 12 }}>{name}{stars > 0 && <span className="card-stars" style={{ fontSize: 10 }}>{'★'.repeat(stars)}</span>}</div>
        <div className="card-ability" style={{ padding: '3px 6px', gap: 4 }}>
          <span style={{ fontSize: 10 }}>{ab.icon}</span>
          <span style={{ fontSize: 9, color: ab.color }}>{abName}</span>
        </div>
        <div className="card-row">
          <div className="card-stat"><span className="card-label" style={{ fontSize: 7 }}>{pLabel}</span><span className="card-val" style={{ fontSize: 18 }}>{pwr}</span></div>
          <div className="card-divider" style={{ height: 24 }} />
          <div className="card-stat"><span className="card-val card-dmg" style={{ fontSize: 18 }}>{dmg}</span><span className="card-label" style={{ fontSize: 7 }}>{dLabel}</span></div>
        </div>
      </div>
      <div className="card-border-bottom" style={{ height: 3, background: `linear-gradient(90deg, ${r.grad}40, ${r.grad}, ${r.grad}40)` }} />
    </button>
  );
}
