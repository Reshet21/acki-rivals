import { useState } from 'react';
import type { Card } from '../types';
import { useI18n } from '../i18n';
import { getCardName, getAbilityName, getClanName, getRarityLabel, getAbilityDescription } from '../i18n/cardTranslations';
import { clanBonuses, comboAbilities } from '../data/cards';
import { abilityInfo } from '../data/abilityVisuals';
import Icon from './Icon';
import { cardArt } from '../data/cardArt';
import CardArt from './CardArt';
import { useHaptic } from '../hooks/useHaptic';

const rarityColor: Record<string, string> = {
  common: '#6b7280', uncommon: '#10b981', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b',
};
const rarityBg: Record<string, string> = {
  common: 'rgba(107,114,128,0.1)', uncommon: 'rgba(16,185,129,0.1)', rare: 'rgba(59,130,246,0.1)',
  epic: 'rgba(168,85,247,0.1)', legendary: 'rgba(245,158,11,0.1)',
};

interface Props {
  card: Card;
  hand?: Card[];
  onClose: () => void;
}

export default function CardDetailPopup({ card, hand, onClose }: Props) {
  const { lang, t } = useI18n();
  const { selectionChanged, impactOccurred } = useHaptic();
  const [tab, setTab] = useState<'info' | 'combo'>('info');
  const name = getCardName(lang, card.id);
  const abilityName = getAbilityName(lang, card.ability);
  const clanName = getClanName(lang, card.clan);
  const rarityLabel = getRarityLabel(lang, card.rarity);
  const rc = rarityColor[card.rarity || 'common'];
  const rbg = rarityBg[card.rarity || 'common'];
  const ab = getAbilityDescription(lang, card.ability);

  const combos = comboAbilities.filter((c) => c.card1 === card.id || c.card2 === card.id);
  const myHand = hand || [card];
  const activeCombos = combos.filter((c) => myHand.some((h) => h.id === c.card1) && myHand.some((h) => h.id === c.card2));

  const clanCount = myHand.filter((h) => h.clan === card.clan).length;
  const clanBonus = clanCount >= 2 ? clanBonuses[card.clan] : null;

  return (
    <div
      className="flex items-center justify-center animate-page-enter-fast"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding: '24px 16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in"
        style={{
          width: '100%', maxWidth: 320,
          background: 'linear-gradient(160deg, #0f0a05, #1a120a, #0f0a05)',
          borderRadius: 16, border: `1px solid ${rc}30`,
          overflow: 'hidden', boxShadow: `0 0 40px ${rc}20, 0 20px 60px rgba(0,0,0,0.5)`,
          position: 'relative', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* ✕ Close button — always visible top-right */}
        <button
          onClick={() => { impactOccurred('soft'); onClose(); }}
          className="flex items-center justify-center active:scale-90 transition-all"
          style={{
            position: 'absolute', top: 8, right: 8, zIndex: 20,
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <Icon name="close" size={15} />
        </button>

        {/* Card image — full art, natural proportions, never cropped */}
        <div style={{
          position: 'relative', width: '100%', minHeight: 160,
          maxHeight: '44vh', overflow: 'hidden', background: '#080503',
          flexShrink: 0,
        }}>
          {cardArt[card.id] ? (
            <CardArt src={cardArt[card.id]} mode="auto" fallbackRatio={2 / 3} minH={160} maxH="44vh" />
          ) : (
            <div style={{ width: '100%', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, opacity: 0.2 }}>🃏</div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,10,5,0.95) 0%, rgba(15,10,5,0.3) 40%, transparent 65%)' }} />

          {/* Rarity gem */}
          <div style={{ position: 'absolute', top: 8, left: 8, width: 16, height: 16, borderRadius: 3, background: `radial-gradient(circle at 35% 30%, ${rc}cc, ${rc} 50%, ${rc}80)`, boxShadow: `0 0 8px ${rc}60`, border: '1px solid rgba(255,255,255,0.15)', zIndex: 2 }} />

          {/* Name + Clan overlaid */}
          <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10, textAlign: 'center', zIndex: 2 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#e5d5b0', textShadow: '0 2px 12px rgba(0,0,0,0.95)' }}>{name}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>{clanName}</div>
          </div>
        </div>

        {/* Rarity badge + Stats row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: rc, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{rarityLabel}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>РЕДКОСТЬ</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('card.power')}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#e2e8f0', lineHeight: 1.2 }}>{card.power + (card.stars ?? 0)}</div>
          </div>
          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('card.damage')}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fca5a5', lineHeight: 1.2 }}>{card.damage + (card.stars ?? 0)}</div>
          </div>
          {(card.stars ?? 0) > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('card.stars') || '★'}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fbbf24', lineHeight: 1.2 }}>{'★'.repeat(card.stars ?? 0)}</div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          {(['info', 'combo'] as const).map((tabKey) => (
            <button key={tabKey}
              onClick={() => { selectionChanged(); setTab(tabKey); }}
              style={{
                flex: 1, padding: '8px 0', fontSize: 10, fontWeight: 700,
                color: tab === tabKey ? rc : 'rgba(255,255,255,0.35)',
                borderBottom: tab === tabKey ? `2px solid ${rc}` : '2px solid transparent',
                background: tab === tabKey ? rbg : 'none',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              }}>
              {tabKey === 'info' ? t('card.ability') : `${t('card.combo')}${combos.length > 0 ? ` (${combos.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Content — scrollable */}
        <div style={{ padding: '10px 14px', minHeight: 60, maxHeight: 180, overflowY: 'auto', flex: 1 }}>
          {tab === 'info' ? (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ display: 'flex', color: abilityInfo[card.ability]?.color || '#fff' }}><Icon name={abilityInfo[card.ability]?.icon || 'sparkle'} size={18} /></span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: abilityInfo[card.ability]?.color || '#fff' }}>{abilityName}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{ab}</div>
                </div>
              </div>
              {clanBonus && (
                <div style={{ padding: '6px 10px', borderRadius: 8, background: `${rc}15`, border: `1px solid ${rc}30`, marginTop: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: rc, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="castle" size={11} /> {clanBonus.name}</div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>{clanBonus.desc}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {combos.length === 0 && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 12 }}>{t('card.noCombo')}</div>}
              {combos.map((c, i) => {
                const isActive = activeCombos.includes(c);
                return (
                  <div key={i} style={{ padding: '6px 10px', borderRadius: 8, background: isActive ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)', border: isActive ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ display: 'flex', color: isActive ? '#fb923c' : 'rgba(255,255,255,0.3)' }}><Icon name={isActive ? 'fire' : 'clock'} size={12} /></span>
                      <div style={{ fontSize: 10, fontWeight: 700, color: isActive ? '#fbbf24' : 'rgba(255,255,255,0.45)' }}>{c.name}</div>
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{c.desc}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Close button at bottom */}
        <div style={{ padding: '6px 14px 12px', flexShrink: 0 }}>
          <button
            onClick={() => { impactOccurred('soft'); onClose(); }}
            className="active:scale-95 transition-all"
            style={{
              width: '100%', padding: '8px 0', borderRadius: 10,
              background: `${rc}15`, border: `1px solid ${rc}25`,
              color: rc, fontSize: 11, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t('card.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
