import { useState, useMemo } from 'react';
import type { Card } from '../types';
import { abilityIcons, abilityColors, abilityNames } from '../data/abilityVisuals';
import type { IconName } from './Icon';
import { cardArt } from '../data/cardArt';
import CardArt from './CardArt';
import { useHaptic } from '../hooks/useHaptic';
import { useI18n } from '../i18n';
import Icon from './Icon';

interface Props {
  cards: Card[];
  onSelect: (card: Card, pillz: number) => void;
  maxPillz: number;
}

const rarityColor: Record<string, string> = {
  common: '#6b7280', uncommon: '#10b981', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b',
};

function getAbilityIcon(ability: string): IconName { return abilityIcons[ability] || 'sparkle'; }
function getAbilityColor(ability: string): string { return abilityColors[ability] || '#9ca3af'; }
function getAbilityName(ability: string): string { return abilityNames[ability] || ability; }

function estimateAttack(power: number, pillz: number) {
  const base = power * (1 + pillz);
  return { min: Math.round(base * 0.9), max: Math.round(base * 1.1), avg: Math.round(base) };
}

export default function CardSelector({ cards, onSelect, maxPillz }: Props) {
  const { selectionChanged, impactOccurred } = useHaptic();
  const { t } = useI18n();
  const [sel, setSel] = useState<Card | null>(null);
  const [pillz, setPillz] = useState(0);
  const preview = useMemo(() => sel ? estimateAttack(sel.power, pillz) : null, [sel, pillz]);

  const go = () => {
    if (!sel) return;
    impactOccurred('heavy');
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
            border: `1px solid ${rarityColor[sel.rarity || 'common']}66`,
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
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}><Icon name="cards" size={20} /></div>
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0f0a05 0%, transparent 50%)' }} />
              {/* X button */}
              <div style={{
                position: 'absolute', top: 2, right: 2, width: 14, height: 14,
                borderRadius: 7, background: 'rgba(0,0,0,0.7)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}><Icon name="close" size={9} stroke={2.4} /></div>
            </div>

            {/* Card info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#e5d5b0', textShadow: '0 1px 4px rgba(0,0,0,0.8)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {sel.name}
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><Icon name="sword" size={10} />{sel.power}</span>
                <span style={{ color: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: 2 }}><Icon name="boom" size={10} />{sel.damage}</span>
              </div>
              {/* Ability display */}
              {sel.ability && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, padding: '2px 6px', background: 'rgba(0,0,0,0.3)', borderRadius: 4, border: '1px solid rgba(255,215,0,0.2)' }}>
                  <span style={{ display: 'flex', color: getAbilityColor(sel.ability) }}><Icon name={getAbilityIcon(sel.ability)} size={10} /></span>
                  <span style={{ fontSize: 9, color: getAbilityColor(sel.ability), fontWeight: 700 }}>{getAbilityName(sel.ability)}</span>
                </div>
              )}
              {preview && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{t('battle.attack')}:</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{preview.min}</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#00d4ff' }}>{preview.avg}</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{preview.max}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: '4px 0' }}>
            {t('battle.selectCard')}
          </div>
        )}
      </div>

      {/* Рука веером — как «стол» в макете 3a */}
      <div className="flex-1 min-h-0 flex items-end justify-center overflow-visible px-1 pb-12">
        <div className="flex items-end justify-center" style={{ paddingTop: 48 }}>
          {(() => {
            const n = cards.length;
            const mid = (n - 1) / 2;
            const step = n > 1 ? Math.min(15, 44 / (n - 1)) : 0; // градус между картами
            return cards.map((card, i) => {
              const isSel = sel?.uid === card.uid;
              const angle = (i - mid) * step;
              const arc = Math.abs(i - mid) * 9;           // дуга: крайние ниже
              const lift = isSel ? -40 : arc;
              const rc = rarityColor[card.rarity || 'common'];
              const overlap = n > 5 ? -18 : n > 3 ? -12 : -8;
              return (
                <button
                  key={card.uid || card.id}
                  onClick={() => { selectionChanged(); setSel(isSel ? null : card); }}
                  style={{
                    width: 92, height: 136, margin: `0 ${overlap}px`, flexShrink: 0,
                    position: 'relative', borderRadius: 13, overflow: 'hidden',
                    transformOrigin: '50% 100%',
                    transform: `rotate(${isSel ? 0 : angle}deg) translateY(${lift}px)${isSel ? ' scale(1.22)' : ''}`,
                    transition: 'transform .22s cubic-bezier(0.16,1,0.3,1), box-shadow .22s',
                    zIndex: isSel ? 40 : 10 + i,
                    border: `${isSel ? '1.5px' : '2px'} solid ${isSel ? rc : rc + '66'}`,
                    boxShadow: isSel ? `0 12px 34px ${rc}88` : '0 6px 14px rgba(0,0,0,0.5)',
                    background: 'linear-gradient(160deg, #0f0a05, #1a120a)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#080503', position: 'relative' }}>
                    {cardArt[card.id] ? (
                      <CardArt src={cardArt[card.id]} mode="fixed" boxRatio={92 / 136} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}><Icon name="cards" size={26} /></div>
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 48%)' }} />
                    <div style={{ position: 'absolute', top: 5, left: 5, width: 10, height: 10, borderRadius: 3, background: rc, boxShadow: `0 0 6px ${rc}80` }} />
                    <div style={{ position: 'absolute', bottom: 3, left: 0, right: 0, padding: '0 5px' }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: '#e5d5b0', lineHeight: 1.1, textAlign: 'center', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                        {card.name}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 2 }}>
                        <span style={{ fontSize: 9, fontWeight: 900, color: '#e2e8f0', display: 'inline-flex', alignItems: 'center', gap: 1 }}><Icon name="sword" size={9} />{card.power}</span>
                        <span style={{ fontSize: 9, fontWeight: 900, color: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: 1 }}><Icon name="boom" size={9} />{card.damage}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            });
          })()}
        </div>
      </div>

      {/* Attack panel */}
      <div className="shrink-0 px-3 py-2 flex items-center gap-2"
        style={{
          background: 'rgba(15,10,5,0.9)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
          <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span className="font-bold" style={{ color: '#00d4ff' }}>{maxPillz}</span> {t('battle.pillz')}
          </div>
          <input
            type="range" min={0} max={maxPillz} value={pillz}
            onChange={(e) => setPillz(Number(e.target.value))}
            style={{
              width: '100%', height: 4, borderRadius: 999, cursor: 'pointer',
              background: `linear-gradient(to right, #00d4ff ${(pillz/Math.max(1,maxPillz))*100}%, rgba(255,255,255,0.1) ${(pillz/Math.max(1,maxPillz))*100}%)`,
              accentColor: '#00d4ff',
              WebkitAppearance: 'none',
            }}
          />
          <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('battle.spend')}: {pillz}</div>
        </div>
        <button
          onClick={go}
          disabled={!sel}
          className={`flex-1 py-2.5 rounded-[14px] font-bold text-sm transition-all ${sel ? 'snake-border' : ''}`}
          style={{
            background: 'transparent',
            border: sel ? 'none' : '2px solid rgba(255,255,255,0.06)',
            color: sel ? '#e6ebef' : 'rgba(255,255,255,0.25)',
            boxShadow: 'none',
            cursor: sel ? 'pointer' : 'not-allowed',
          }}
        >
          <span className="inline-flex items-center justify-center gap-1.5"><Icon name="sword" size={15} /> {t('battle.attackButton').replace(/^[^\p{L}\p{N}]+/u, '').trim()}</span>
        </button>
      </div>
    </div>
  );
}
