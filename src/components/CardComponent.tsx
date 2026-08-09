import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Card } from '../types';
import { useI18n } from '../i18n';
import { getCardName, getAbilityName, getStatLabel, getRarityLabel } from '../i18n/cardTranslations';
import CardDetailPopup from './CardDetailPopup';
import CardArt from './CardArt';
import { abilityInfo } from '../data/abilityVisuals';
import Icon from './Icon';
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
  const cardRef = useRef<HTMLButtonElement>(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = ((x - centerX) / centerX) * 8;
    const rotateX = ((centerY - y) / centerY) * 8;
    setTilt({ rotateX, rotateY });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ rotateX: 0, rotateY: 0 });
    setIsHovered(false);
  }, []);
  const s = card.stars ?? 0;
  const r = R[card.rarity || 'common'] || R.common;
  const img = cardArt[card.id];
  const ab = abilityInfo[card.ability] || { icon: 'sparkle' as const, color: '#9ca3af' };
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
      borderRadius: 9,
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
    gem: { position: 'absolute' as const, top: C ? 4 : 8, left: C ? 4 : 8, width: C ? 10 : 13, height: C ? 10 : 13, borderRadius: 3, background: r.gc, boxShadow: r.gg, border: '1px solid rgba(255,255,255,0.15)', zIndex: 2 } as React.CSSProperties,
    overlay: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, padding: C ? '6px 8px' : '10px 12px', zIndex: 2, display: 'flex' as const, flexDirection: 'column' as const, gap: C ? 2 : 3 } as React.CSSProperties,
    name: { fontWeight: 900, fontSize: C ? 9 : 11, color: '#e5d5b0', textAlign: 'center' as const, lineHeight: 1.2, textShadow: '0 2px 8px rgba(0,0,0,0.9)', display: '-webkit-box' as const, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' as const, wordBreak: 'break-word' as const } as React.CSSProperties,
    stars: { color: '#fbbf24', marginLeft: 4, fontSize: C ? 9 : 11 } as React.CSSProperties,
    abBox: { background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: C ? '2px 5px' : '3px 7px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex' as const, alignItems: 'center' as const, gap: C ? 3 : 4 } as React.CSSProperties,
    abIcon: { fontSize: C ? 9 : 11 } as React.CSSProperties,
    abName: { fontSize: C ? 8 : 9, color: ab.color, fontWeight: 700, flex: 1, overflow: 'hidden' as const, whiteSpace: 'nowrap' as const, textOverflow: 'ellipsis' as const } as React.CSSProperties,
    row: { display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'space-around' as const, gap: 4 } as React.CSSProperties,
    stat: { textAlign: 'center' as const, flex: 1 } as React.CSSProperties,
    label: { fontSize: C ? 6 : 7, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' as const, letterSpacing: '0.12em' } as React.CSSProperties,
    val: { fontSize: C ? 11 : 14, fontWeight: 900, color: '#e2e8f0', lineHeight: 1, textShadow: '0 0 12px rgba(255,255,255,0.4)' } as React.CSSProperties,
    dmg: { fontSize: C ? 11 : 14, fontWeight: 900, color: '#fca5a5', lineHeight: 1, textShadow: '0 0 12px rgba(252,165,165,0.5)' } as React.CSSProperties,
    div: { width: 1, height: C ? 16 : 20, background: 'rgba(255,255,255,0.15)' } as React.CSSProperties,
  };

  const inner = (
    <>
      <div style={S.imgBox}>
        {img ? <CardArt src={img} boxRatio={C ? 3 / 4 : 2 / 3} mode={C ? 'fixed' : 'auto'} minH={C ? 120 : 200} maxH={C ? 180 : 280} /> : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',opacity:0.15}}><Icon name="cards" size={C?28:44} /></div>}
        <div style={S.grad} />
        <div style={S.gem} />
        {r.sl && <div style={{position:'absolute',inset:0,background:r.sl,animation:'shimmer 2s infinite'}} />}
        {/* Stats overlaid on image — Urban Rivals style */}
        <div style={S.overlay}>
          <div style={S.name}>{nm || '???'}{s > 0 && <span style={S.stars}>{'★'.repeat(s)}</span>}</div>
          {!C && (
            <div style={S.abBox}>
              <span style={{ ...S.abIcon, color: ab.color, display: 'flex' }}><Icon name={ab.icon} size={C ? 10 : 12} /></span>
              <span style={S.abName}>{an}</span>
            </div>
          )}
          <div style={S.row}>
            <div style={S.stat}><div style={S.label}>{pl}</div><div style={S.val}>{pw}</div></div>
            <div style={S.div} />
            <div style={S.stat}><div style={S.label}>{dl}</div><div style={S.dmg}>{dm}</div></div>
          </div>
        </div>
      </div>
    </>
  );

  const tiltStyle: React.CSSProperties = isHovered ? {
    transform: `perspective(800px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
    transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
    willChange: 'transform',
    filter: 'brightness(1.1)',
    zIndex: 10,
  } : {
    transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    willChange: 'transform',
  };

  return (
    <>
      <button
        ref={cardRef}
        onClick={() => { selectionChanged(); onClick?.(); }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ ...S.btn, position: 'relative' as const, ...tiltStyle } as React.CSSProperties}>
        {inner}
        {/* Info button — top-right (плашка редкости убрана, цвет читается по гему слева) */}
        {!noPopup && (
          <div
            onClick={(e) => { e.stopPropagation(); setShowDetail(true); }}
            className="active:scale-90 transition-all"
            title={rl}
            aria-label={rl}
            style={{
              position: 'absolute', top: C ? 4 : 8, right: C ? 4 : 8,
              width: C ? 13 : 16, height: C ? 13 : 16, borderRadius: '50%',
              background: 'rgba(10,8,4,0.85)',
              border: '1px solid rgba(255,215,0,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: C ? 7 : 8, fontWeight: 700, color: '#FFD700', cursor: 'pointer', zIndex: 10, lineHeight: 1,
              boxShadow: '0 0 8px rgba(255,215,0,0.35), 0 2px 6px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(2px)',
            }}
          >ⓘ</div>
        )}
      </button>
      {showDetail && createPortal(
        <CardDetailPopup card={card} hand={hand} onClose={() => setShowDetail(false)} />,
        document.body
      )}
    </>
  );
}
