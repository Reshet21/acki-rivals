import { useState, useMemo } from 'react';
import type { Card } from '../types';

interface Props {
  cards: Card[];
  onSelect: (card: Card, pillz: number) => void;
  maxPillz: number;
}

const cardArt: Record<number, string> = {
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
  35:'/cards/card-35-scout.svg',36:'/cards/card-36-saboteur.svg',37:'/cards/card-37-storm.svg',
  38:'/cards/card-38-admiral.svg',39:'/cards/card-39-cyber-dragon.svg',
  40:'/cards/card-40-pilgrim.svg',41:'/cards/card-41-alchemist.svg',42:'/cards/card-42-keeper.svg',
  43:'/cards/card-43-high-priest.svg',44:'/cards/card-44-zen-dragon.svg',
};

const rarityColor: Record<string, string> = {
  common: '#6b7280', uncommon: '#10b981', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b',
};

function estimateAttack(power: number, pillz: number) {
  const base = power * (1 + pillz);
  return { min: Math.round(base * 0.9), max: Math.round(base * 1.1), avg: Math.round(base) };
}

export default function CardSelector({ cards, onSelect, maxPillz }: Props) {
  const [sel, setSel] = useState<Card | null>(null);
  const [pillz, setPillz] = useState(0);
  const preview = useMemo(() => sel ? estimateAttack(sel.power, pillz) : null, [sel, pillz]);

  const go = () => {
    if (!sel) return;
    onSelect(sel, pillz);
    setSel(null);
    setPillz(0);
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* Selected card preview — mini version with image */}
      <div className="shrink-0 px-2 pt-1.5 pb-1">
        {sel ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
            background: 'rgba(255,255,255,0.05)', borderRadius: 10,
            border: '1px solid rgba(251,191,36,0.4)',
          }}>
            {/* Mini card with actual image */}
            <div style={{
              width: 48, height: 64, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
              border: `2px solid ${rarityColor[sel.rarity || 'common']}40`,
              background: 'linear-gradient(160deg, #0f0a05, #1a120a)',
              position: 'relative', cursor: 'pointer',
            }} onClick={() => { setSel(null); setPillz(0); }}>
              {cardArt[sel.id] ? (
                <img src={cardArt[sel.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, opacity: 0.3 }}>🃏</div>
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0f0a05 0%, transparent 50%)' }} />
              {/* X button */}
              <div style={{
                position: 'absolute', top: 2, right: 2, width: 14, height: 14,
                borderRadius: 7, background: 'rgba(0,0,0,0.7)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff',
              }}>✕</div>
            </div>

            {/* Card info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#e5d5b0', textShadow: '0 1px 4px rgba(0,0,0,0.8)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {sel.name}
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                <span>⚡{sel.power}</span>
                <span style={{ color: '#fca5a5' }}>💥{sel.damage}</span>
              </div>
              {preview && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Атака:</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{preview.min}</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#00d4ff' }}>{preview.avg}</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{preview.max}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: '4px 0' }}>
            Выберите карту
          </div>
        )}
      </div>

      {/* Card grid */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-1">
        <div className="grid grid-cols-4 gap-1.5">
          {cards.map((card) => {
            const isSel = sel?.uid === card.uid;
            const rc = rarityColor[card.rarity || 'common'];
            return (
              <button
                key={card.uid || card.id}
                onClick={() => setSel(card)}
                style={{
                  position: 'relative', borderRadius: 8, overflow: 'hidden',
                  border: `2px solid ${isSel ? '#fbbf24' : rc + '40'}`,
                  boxShadow: isSel ? '0 0 12px rgba(251,191,36,0.4)' : 'none',
                  cursor: 'pointer', transition: 'all 0.15s',
                  transform: isSel ? 'scale(1.05)' : 'scale(1)',
                  background: 'linear-gradient(160deg, #0f0a05, #1a120a)',
                }}
              >
                {/* Image */}
                <div style={{ width: '100%', aspectRatio: '3/4', overflow: 'hidden', background: '#080503', position: 'relative' }}>
                  {cardArt[card.id] ? (
                    <img src={cardArt[card.id]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, opacity: 0.2 }}>🃏</div>
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0f0a05 0%, transparent 40%)' }} />
                  {/* Rarity dot */}
                  <div style={{ position: 'absolute', top: 3, right: 3, width: 6, height: 6, borderRadius: 3, background: rc }} />
                </div>
                {/* Stats */}
                <div style={{ padding: '3px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 900, color: '#e2e8f0' }}>⚡{card.power}</span>
                  <span style={{ fontSize: 9, fontWeight: 900, color: '#fca5a5' }}>💥{card.damage}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Attack panel */}
      <div className="shrink-0 bg-dark-card border-t border-dark-border px-3 py-2 flex items-center gap-2"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
          <div className="text-[9px] text-white/50">
            <span className="text-neon-blue font-bold">{maxPillz}</span> пиллз
          </div>
          <input
            type="range" min={0} max={maxPillz} value={pillz}
            onChange={(e) => setPillz(Number(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink accent-neon-blue"
          />
          <div className="text-[9px] text-white/40">тратишь: {pillz}</div>
        </div>
        <button
          onClick={go}
          disabled={!sel}
          className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all duration-150 ${
            sel
              ? 'bg-gradient-to-r from-neon-blue to-neon-purple active:scale-95 shadow-[0_0_12px_rgba(0,212,255,0.3)] text-white'
              : 'bg-white/5 text-white/20 cursor-not-allowed'
          }`}
        >
          ⚔️ Атаковать
        </button>
      </div>
    </div>
  );
}
