import { useState } from 'react';
import type { Card } from '../types';
import { useI18n } from '../i18n';
import { getCardName, getAbilityName, getStatLabel, getRarityLabel } from '../i18n/cardTranslations';
import CardDetailPopup from './CardDetailPopup';
import { abilityInfo } from '../data/abilityVisuals';
import { cardArt } from '../data/cardArt';
import { useHaptic } from '../hooks/useHaptic';

interface Props {
  card: Card;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
  hand?: Card[];
  noPopup?: boolean;
}

const R: Record<string, { gc:string; gg:string; bg:string; fg:string; bc:string; sl:string }> = {
  common:    { gc:'radial-gradient(circle at 35% 30%,#c0c0c0,#6b7280 50%,#374151)', gg:'0 0 6px #9ca3af', bg:'linear-gradient(135deg,#4b5563,#6b7280,#374151,#4b5563)', fg:'', bc:'#6b7280', sl:'' },
  uncommon:  { gc:'radial-gradient(circle at 35% 30%,#6ee7b7,#10b981 50%,#065f46)', gg:'0 0 10px #10b981', bg:'linear-gradient(135deg,#064e3b,#10b981,#065f46,#059669)', fg:'0 0 12px rgba(16,185,129,0.4)', bc:'#10b981', sl:'' },
  rare:      { gc:'radial-gradient(circle at 35% 30%,#93c5fd,#3b82f6 50%,#1e3a8a)', gg:'0 0 14px #3b82f6', bg:'linear-gradient(135deg,#1e3a8a,#3b82f6,#1d4ed8,#2563eb)', fg:'0 0 18px rgba(59,130,246,0.5)', bc:'#3b82f6', sl:'' },
  epic:      { gc:'radial-gradient(circle at 35% 30%,#e9d5ff,#a855f7 50%,#581c87)', gg:'0 0 18px #a855f7', bg:'linear-gradient(135deg,#581c87,#a855f7,#7e22ce,#9333ea)', fg:'0 0 24px rgba(168,85,247,0.6)', bc:'#a855f7', sl:'linear-gradient(90deg,transparent,rgba(168,85,247,0.3),transparent)' },
  legendary: { gc:'radial-gradient(circle at 35% 30%,#fef08a,#f59e0b 50%,#78350f)', gg:'0 0 22px #f59e0b,0 0 40px rgba(245,158,11,0.4)', bg:'linear-gradient(135deg,#78350f,#f59e0b,#b45309,#fbbf24)', fg:'0 0 30px rgba(245,158,11,0.5),0 0 60px rgba(245,158,11,0.2)', bc:'#f59e0b', sl:'linear-gradient(90deg,transparent,rgba(245,158,11,0.3),transparent)' },
};

export default function CardComponent({ card, isSelected, onClick, compact, hand, noPopup }: Props) {
  const { lang } = useI18n();
  const { selectionChanged } = useHaptic();
  const [showDetail, setShowDetail] = useState(false);
  const s = card.stars ?? 0;
  const r = R[card.rarity || 'common'] || R.common;
  const img = cardArt[card.id];
  const ab = abilityInfo[card.ability] || { icon: '❓', color: '#9ca3af' };
  const nm = getCardName(lang, card.id);
  const an = getAbilityName(lang, card.ability);
  const pl = getStatLabel(lang, 'power');
  const dl = getStatLabel(lang, 'damage');
  const rl = getRarityLabel(lang, card.rarity);
  const pw = (card.power ?? 0) + s;
  const dm = (card.damage ?? 0) + s;
  const sel = isSelected;

  const C = compact;
  const maxH = C ? 220 : 320;

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
      maxHeight: maxH,
      aspectRatio: C ? '3/4' : '2/3',
    } as React.CSSProperties,
    imgBox: { position: 'relative' as const, width: '100%', flex: 1, minHeight: C ? 120 : 200, maxHeight: C ? 180 : 280, overflow: 'hidden' as const, background: '#080503' } as React.CSSProperties,
    img: { width: '100%', height: '100%', objectFit: 'cover' as const, objectPosition: 'center center', opacity: 1 } as React.CSSProperties,
    grad: { position: 'absolute' as const, inset: 0, background: 'linear-gradient(to top, rgba(15,10,5,0.95) 0%, rgba(15,10,5,0.4) 40%, transparent 70%)' } as React.CSSProperties,
    gem: { position: 'absolute' as const, top: C ? 4 : 8, left: C ? 4 : 8, width: C ? 16 : 20, height: C ? 16 : 20, borderRadius: 4, background: r.gc, boxShadow: r.gg, border: '1px solid rgba(255,255,255,0.15)', zIndex: 2 } as React.CSSProperties,
    badge: { position: 'absolute' as const, top: C ? 4 : 8, right: C ? 4 : 8, fontSize: C ? 7 : 8, fontWeight: 700, color: r.bc, background: 'rgba(0,0,0,0.8)', padding: C ? '2px 5px' : '3px 8px', borderRadius: 4, border: `1px solid ${r.bc}50`, letterSpacing: '0.08em', zIndex: 2 } as React.CSSProperties,
    overlay: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, padding: C ? '6px 8px' : '10px 12px', zIndex: 2, display: 'flex' as const, flexDirection: 'column' as const, gap: C ? 2 : 3 } as React.CSSProperties,
    name: { fontWeight: 900, fontSize: C ? 11 : 14, color: '#e5d5b0', textAlign: 'center' as const, lineHeight: 1.2, textShadow: '0 2px 8px rgba(0,0,0,0.9)' } as React.CSSProperties,
    stars: { color: '#fbbf24', marginLeft: 4, fontSize: C ? 9 : 11 } as React.CSSProperties,
    abBox: { background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: C ? '2px 5px' : '3px 7px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex' as const, alignItems: 'center' as const, gap: C ? 3 : 4 } as React.CSSProperties,
    abIcon: { fontSize: C ? 9 : 11 } as React.CSSProperties,
    abName: { fontSize: C ? 8 : 9, color: ab.color, fontWeight: 700, flex: 1, overflow: 'hidden' as const, whiteSpace: 'nowrap' as const, textOverflow: 'ellipsis' as const } as React.CSSProperties,
    row: { display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'space-around' as const, gap: 4 } as React.CSSProperties,
    stat: { textAlign: 'center' as const, flex: 1 } as React.CSSProperties,
    label: { fontSize: C ? 6 : 7, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' as const, letterSpacing: '0.12em' } as React.CSSProperties,
    val: { fontSize: C ? 16 : 20, fontWeight: 900, color: '#e2e8f0', lineHeight: 1, textShadow: '0 0 12px rgba(255,255,255,0.4)' } as React.CSSProperties,
    dmg: { fontSize: C ? 16 : 20, fontWeight: 900, color: '#fca5a5', lineHeight: 1, textShadow: '0 0 12px rgba(252,165,165,0.5)' } as React.CSSProperties,
    div: { width: 1, height: C ? 20 : 26, background: 'rgba(255,255,255,0.15)' } as React.CSSProperties,
  };

  const inner = (
    <>
      <div style={S.imgBox}>
        {img ? <img src={img} alt="" style={S.img} /> : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:C?28:44,opacity:0.15}}>🃏</div>}
        <div style={S.grad} />
        <div style={S.gem} />
        <div style={S.badge}>{rl}</div>
        {r.sl && <div style={{position:'absolute',inset:0,background:r.sl,animation:'shimmer 2s infinite'}} />}
        {/* Stats overlaid on image — Urban Rivals style */}
        <div style={S.overlay}>
          <div style={S.name}>{nm || '???'}{s > 0 && <span style={S.stars}>{'★'.repeat(s)}</span>}</div>
          {!C && (
            <div style={S.abBox}>
              <span style={S.abIcon}>{ab.icon}</span>
              <span style={S.abName}>{an}</span>
            </div>
          )}
          <div style={S.row}>
            <div style={S.stat}><div style={S.label}>{pl}</div><div style={S.val}>{pw}</div></div>
            <div style={S.div} />
            <div style={S.stat}><div style={S.dmg}>{dm}</div><div style={S.label}>{dl}</div></div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button onClick={() => { selectionChanged(); onClick?.(); }} style={{ ...S.btn, position: 'relative' } as React.CSSProperties}>
        {inner}
        {/* Info button — top right */}
        {!noPopup && (
          <div
            onClick={(e) => { e.stopPropagation(); setShowDetail(true); }}
            style={{
              position: 'absolute', top: compact ? 2 : 4, right: compact ? 2 : 4,
              width: compact ? 14 : 16, height: compact ? 14 : 16, borderRadius: '50%',
              background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: compact ? 7 : 8, color: '#fff', cursor: 'pointer', zIndex: 10,
            }}
          >i</div>
        )}
      </button>
      {showDetail && <CardDetailPopup card={card} hand={hand} onClose={() => setShowDetail(false)} />}
    </>
  );
}
