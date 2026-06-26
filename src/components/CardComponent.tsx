import { useState } from 'react';
import type { Card } from '../types';
import { useI18n } from '../i18n';
import { getCardName, getAbilityName, getStatLabel } from '../i18n/cardTranslations';
import CardDetailPopup from './CardDetailPopup';

interface Props {
  card: Card;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
  hand?: Card[];
  noPopup?: boolean;
}

const abInfo: Record<string, { icon: string; color: string }> = {
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

const art: Record<number, string> = {
  1:'/cards/card-rusty-drone.png',2:'/cards/card-patrol.png',3:'/cards/card-hacker.png',
  4:'/cards/card-neon-sniper.png',5:'/cards/card-cyber-wolf.png',6:'/cards/card-circuit-guardian.jpeg',
  7:'/cards/card-phantom.png',8:'/cards/card-acki-nacki.jpeg',9:'/cards/card-mamabord.jpeg',
  10:'/cards/card-mamabord.jpeg',11:'/cards/card-block-keeper.jpeg',12:'/cards/card-block-keeper.jpeg',
  13:'/cards/card-block-keeper.jpeg',14:'/cards/card-block-manager.jpeg',15:'/cards/card-block-manager.jpeg',
  16:'/cards/card-block-manager.jpeg',17:'/cards/card-malicious-block.jpeg',18:'/cards/card-circuit-guardian.jpeg',
  19:'/cards/card-phantom.png',20:'/cards/card-cyber-killer.png',21:'/cards/card-mamabord.jpeg',
  22:'/cards/card-block-keeper.jpeg',23:'/cards/card-courier.png',24:'/cards/card-raider.png',
  25:'/cards/card-saboteur.png',26:'/cards/card-cyber-killer.png',27:'/cards/card-circuit-guardian.jpeg',
  28:'/cards/card-malicious-block.jpeg',29:'/cards/card-block-keeper.jpeg',30:'/cards/card-mamabord.jpeg',
  31:'/cards/card-saboteur.png',32:'/cards/card-block-keeper.jpeg',33:'/cards/card-circuit-guardian.jpeg',
  34:'/cards/card-malicious-block.jpeg',
};

const R: Record<string, { gc:string; gg:string; bg:string; fg:string; bt:string; bc:string; sl:string }> = {
  common:    { gc:'radial-gradient(circle at 35% 30%,#c0c0c0,#6b7280 50%,#374151)', gg:'0 0 6px #9ca3af', bg:'linear-gradient(135deg,#4b5563,#6b7280,#374151,#4b5563)', fg:'', bt:'ОБЫЧНАЯ', bc:'#6b7280', sl:'' },
  uncommon:  { gc:'radial-gradient(circle at 35% 30%,#6ee7b7,#10b981 50%,#065f46)', gg:'0 0 10px #10b981', bg:'linear-gradient(135deg,#064e3b,#10b981,#065f46,#059669)', fg:'0 0 12px rgba(16,185,129,0.4)', bt:'НЕОБЫЧНАЯ', bc:'#10b981', sl:'' },
  rare:      { gc:'radial-gradient(circle at 35% 30%,#93c5fd,#3b82f6 50%,#1e3a8a)', gg:'0 0 14px #3b82f6', bg:'linear-gradient(135deg,#1e3a8a,#3b82f6,#1d4ed8,#2563eb)', fg:'0 0 18px rgba(59,130,246,0.5)', bt:'РЕДКАЯ', bc:'#3b82f6', sl:'' },
  epic:      { gc:'radial-gradient(circle at 35% 30%,#e9d5ff,#a855f7 50%,#581c87)', gg:'0 0 18px #a855f7', bg:'linear-gradient(135deg,#581c87,#a855f7,#7e22ce,#9333ea)', fg:'0 0 24px rgba(168,85,247,0.6)', bt:'ЭПИЧЕСКАЯ', bc:'#a855f7', sl:'linear-gradient(90deg,transparent,rgba(168,85,247,0.3),transparent)' },
  legendary: { gc:'radial-gradient(circle at 35% 30%,#fef08a,#f59e0b 50%,#78350f)', gg:'0 0 22px #f59e0b,0 0 40px rgba(245,158,11,0.4)', bg:'linear-gradient(135deg,#78350f,#f59e0b,#b45309,#fbbf24)', fg:'0 0 30px rgba(245,158,11,0.5),0 0 60px rgba(245,158,11,0.2)', bt:'ЛЕГЕНДАРНАЯ', bc:'#f59e0b', sl:'linear-gradient(90deg,transparent,rgba(245,158,11,0.3),transparent)' },
};

export default function CardComponent({ card, isSelected, onClick, compact, hand, noPopup }: Props) {
  const { lang } = useI18n();
  const [showDetail, setShowDetail] = useState(false);
  const s = card.stars ?? 0;
  const r = R[card.rarity || 'common'] || R.common;
  const img = art[card.id];
  const ab = abInfo[card.ability] || { icon: '❓', color: '#9ca3af' };
  const nm = getCardName(lang, card.id);
  const an = getAbilityName(lang, card.ability);
  const pl = getStatLabel(lang, 'power');
  const dl = getStatLabel(lang, 'damage');
  const pw = (card.power ?? 0) + s;
  const dm = (card.damage ?? 0) + s;
  const sel = isSelected;

  const S = {
    btn: {
      width: '100%',
      borderRadius: 10,
      border: '2px solid',
      borderColor: 'transparent' as const,
      backgroundClip: 'padding-box' as const,
      background: 'linear-gradient(160deg, #0f0a05 0%, #1a120a 50%, #0f0a05 100%)',
      boxShadow: `inset 0 0 0 2px rgba(255,255,255,0.05), ${r.fg}${sel ? ', 0 0 20px rgba(251,191,36,0.8)' : ''}`,
      outline: sel ? '2px solid #fbbf24' : 'none',
      cursor: 'pointer' as const,
      transition: 'all 0.2s',
      transform: sel ? 'scale(1.04)' : 'scale(1)',
      overflow: 'hidden' as const,
      display: 'flex' as const,
      flexDirection: 'column' as const,
    } as React.CSSProperties,
    borderTop: { height: 2, background: r.bg } as React.CSSProperties,
    borderBottom: { height: 2, background: r.bg } as React.CSSProperties,
    imgBox: { position: 'relative' as const, width: '100%', height: compact ? 64 : 130, overflow: 'hidden' as const, background: '#080503' } as React.CSSProperties,
    img: { width: '100%', height: '100%', objectFit: 'cover' as const, opacity: 0.9 } as React.CSSProperties,
    grad: { position: 'absolute' as const, inset: 0, background: 'linear-gradient(to top, #0f0a05 0%, transparent 60%)' } as React.CSSProperties,
    gem: { position: 'absolute' as const, top: compact ? 4 : 6, left: compact ? 4 : 6, width: compact ? 14 : 16, height: compact ? 14 : 16, borderRadius: 3, background: r.gc, boxShadow: r.gg, border: '1px solid rgba(255,255,255,0.1)', zIndex: 2 } as React.CSSProperties,
    badge: { position: 'absolute' as const, top: compact ? 4 : 6, right: compact ? 4 : 6, fontSize: compact ? 6 : 7, fontWeight: 700, color: r.bc, background: 'rgba(0,0,0,0.7)', padding: compact ? '1px 4px' : '2px 6px', borderRadius: 3, border: `1px solid ${r.bc}40`, letterSpacing: '0.05em', zIndex: 2 } as React.CSSProperties,
    stats: { padding: compact ? '6px 8px' : '8px 10px', display: 'flex' as const, flexDirection: 'column' as const, gap: compact ? 3 : 5 } as React.CSSProperties,
    name: { fontWeight: 800, fontSize: compact ? 11 : 12, color: '#e5d5b0', textAlign: 'center' as const, lineHeight: 1.2, textShadow: '0 1px 4px rgba(0,0,0,0.8)' } as React.CSSProperties,
    stars: { color: '#fbbf24', marginLeft: 3, fontSize: compact ? 9 : 10 } as React.CSSProperties,
    abBox: { background: 'rgba(0,0,0,0.5)', borderRadius: 5, padding: compact ? '2px 5px' : '3px 6px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex' as const, alignItems: 'center' as const, gap: compact ? 3 : 4 } as React.CSSProperties,
    abIcon: { fontSize: compact ? 9 : 10 } as React.CSSProperties,
    abName: { fontSize: compact ? 8 : 9, color: ab.color, fontWeight: 700, flex: 1, overflow: 'hidden' as const, whiteSpace: 'nowrap' as const, textOverflow: 'ellipsis' as const } as React.CSSProperties,
    row: { display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'space-around' as const } as React.CSSProperties,
    stat: { textAlign: 'center' as const } as React.CSSProperties,
    label: { fontSize: compact ? 6 : 7, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const, letterSpacing: '0.08em' } as React.CSSProperties,
    val: { fontSize: compact ? 16 : 18, fontWeight: 900, color: '#e2e8f0', lineHeight: 1, textShadow: '0 0 8px rgba(255,255,255,0.3)' } as React.CSSProperties,
    dmg: { fontSize: compact ? 16 : 18, fontWeight: 900, color: '#fca5a5', lineHeight: 1, textShadow: '0 0 8px rgba(252,165,165,0.4)' } as React.CSSProperties,
    div: { width: 1, height: compact ? 20 : 24, background: 'rgba(255,255,255,0.1)' } as React.CSSProperties,
  };

  const inner = (
    <>
      <div style={S.borderTop} />
      <div style={S.imgBox}>
        {img ? <img src={img} alt="" style={S.img} /> : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:compact?28:44,opacity:0.15}}>🃏</div>}
        <div style={S.grad} />
        <div style={S.gem} />
        <div style={S.badge}>{r.bt}</div>
        {r.sl && <div style={{position:'absolute',inset:0,background:r.sl,animation:'shimmer 2s infinite'}} />}
      </div>
      <div style={S.stats}>
        <div style={S.name}>{nm || '???'}{s > 0 && <span style={S.stars}>{'★'.repeat(s)}</span>}</div>
        <div style={S.abBox}>
          <span style={S.abIcon}>{ab.icon}</span>
          <span style={S.abName}>{an}</span>
        </div>
        <div style={S.row}>
          <div style={S.stat}><div style={S.label}>{pl}</div><div style={S.val}>{pw}</div></div>
          <div style={S.div} />
          <div style={S.stat}><div style={S.dmg}>{dm}</div><div style={S.label}>{dl}</div></div>
        </div>
      </div>
      <div style={S.borderBottom} />
    </>
  );

  return (
    <>
      <button onClick={(e) => { if (noPopup) { onClick?.(); } else { e.preventDefault(); setShowDetail(true); } }} style={S.btn}>{inner}</button>
      {showDetail && <CardDetailPopup card={card} hand={hand} onClose={() => setShowDetail(false)} />}
    </>
  );
}
