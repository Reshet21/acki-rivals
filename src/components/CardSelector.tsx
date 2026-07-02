import { useState, useMemo } from 'react';
import type { Card } from '../types';

interface Props {
  cards: Card[];
  onSelect: (card: Card, pillz: number) => void;
  maxPillz: number;
}

const cardArt: Record<number, string> = {
  1:'/cards/card-01-block.svg',2:'/cards/card-02-node.svg',3:'/cards/card-03-hacker.svg',
  4:'/cards/card-04-transaction.svg',5:'/cards/card-05-hash-wolf.svg',6:'/cards/card-06-chain-knight.svg',
  7:'/cards/card-07-block-shadow.svg',8:'/cards/card-08-hyperblock.svg',9:'/cards/card-09-small-hash.svg',
  10:'/cards/card-10-meditative-node.svg',11:'/cards/card-11-chain-acolyte.svg',12:'/cards/card-12-block-totem.svg',
  13:'/cards/card-13-shard-whisperer.svg',14:'/cards/card-14-epoch-master.svg',15:'/cards/card-15-consensus-guardian.svg',
  16:'/cards/card-16-code-emperor.svg',17:'/cards/card-17-block-emperor.svg',18:'/cards/card-18-cosmic-validator.svg',
  19:'/cards/card-19-phantom-node.svg',20:'/cards/card-20-validator.svg',21:'/cards/card-21-zen-validator.svg',
  22:'/cards/card-22-chain-temple-guard.svg',23:'/cards/card-23-hash-courier.svg',24:'/cards/card-24-mempool-raider.svg',
  25:'/cards/card-25-chain-saboteur.svg',26:'/cards/card-26-node-killer.svg',27:'/cards/card-27-validation-paladin.svg',
  28:'/cards/card-28-blockchain-god.svg',29:'/cards/card-29-epoch-guardian.svg',30:'/cards/card-30-node-healer.svg',
  31:'/cards/card-31-mempool-poisoner.svg',32:'/cards/card-32-genesis-spirit.svg',33:'/cards/card-33-block-archon.svg',
  34:'/cards/card-34-buddha.svg',35:'/cards/card-35-mempool-scout.svg',36:'/cards/card-36-fork-saboteur.svg',
  37:'/cards/card-37-consensus-storm.svg',38:'/cards/card-38-chain-admiral.svg',39:'/cards/card-39-consensus-dragon.svg',
  40:'/cards/card-40-block-pilgrim.svg',41:'/cards/card-41-hash-alchemist.svg',42:'/cards/card-42-chain-keeper.svg',
  43:'/cards/card-43-consensus-priest.svg',44:'/cards/card-44-epoch-dragon.svg',
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
