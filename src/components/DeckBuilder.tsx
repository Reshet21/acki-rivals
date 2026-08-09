import { useState, useMemo } from 'react';
import type { Card, Rarity } from '../types';
import { useI18n } from '../i18n';
import CardComponent from './CardComponent';
import { RarityChips, SearchField } from './CardFilters';
import { useHaptic } from '../hooks/useHaptic';
import { comboAbilities, clanBonuses } from '../data/cards';
import { cardArt } from '../data/cardArt';
import CardArt from './CardArt';
import { getCardName } from '../i18n/cardTranslations';
import Icon from './Icon';

interface Props {
  collection: Card[];
  deck: Card[];
  onToggleDeck: (card: Card) => void;
  onBack: () => void;
}

function MiniArt({ id }: { id: number }) {
  const art = cardArt[id];
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 6, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.2)', background: '#080503',
      flexShrink: 0,
    }}>
      {art ? (
        <CardArt src={art} boxRatio={1} mode="fixed" minH={28} maxH={28} />
      ) : (
        <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, opacity: 0.3 }}>🃏</div>
      )}
    </div>
  );
}

export default function DeckBuilder({ collection, deck, onToggleDeck, onBack }: Props) {
  const { t, lang } = useI18n();
  // фолбэк, если ключ перевода отсутствует (t возвращает сам ключ)
  const tf = (k: string, fb: string) => { const v = t(k); return v === k ? fb : v; };
  const { selectionChanged, impactOccurred } = useHaptic();
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all');
  const deckUids = new Set(deck.map((c) => c.uid));

  const filtered = useMemo(() => {
    return collection.filter((card) => {
      if (rarityFilter !== 'all' && card.rarity !== rarityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          card.name.toLowerCase().includes(q) ||
          card.ability.toLowerCase().includes(q) ||
          card.clan.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [collection, rarityFilter, search]);

  // Активные комбо: обе карты комбо лежат в боевой колоде
  const activeCombos = useMemo(
    () =>
      comboAbilities.filter(
        (c) =>
          deck.some((x) => x.id === c.card1) && deck.some((x) => x.id === c.card2),
      ),
    [deck],
  );

  // Клановые бонусы: 2+ карт одного клана
  const clanCount = useMemo(() => {
    const map: Record<string, number> = {};
    deck.forEach((c) => {
      map[c.clan] = (map[c.clan] || 0) + 1;
    });
    return map;
  }, [deck]);
  const activeClans = Object.entries(clanCount).filter(([, n]) => n >= 2);

  return (
    <div className="flex flex-col h-full w-full max-w-lg mx-auto overflow-hidden" style={{ background: '#050508' }}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,215,0,0.1)', background: 'rgba(5,5,8,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div className="relative flex justify-between items-center mb-3">
          <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all active:scale-95" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            ←
          </button>
          <h1 className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 text-lg font-bold whitespace-nowrap text-white">
            <Icon name="cards" size={17} /> {t('deck.title').replace(/^[^\p{L}\p{N}]+/u, '').trim()}
          </h1>
          <div className="px-3 py-1 rounded-full text-xs font-bold text-white/60" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {collection.length}
          </div>
        </div>

        {/* Search */}
        <div className="mb-3">
          <SearchField value={search} onChange={setSearch} placeholder={t('deck.search')} />
        </div>

        {/* Rarity Filters */}
        <RarityChips value={rarityFilter} onChange={(v) => { selectionChanged(); setRarityFilter(v); }} />
      </div>

      {/* ⚔️ Боевая колода — выбранные карты, тап = убрать */}
      {deck.length > 0 && (
        <div className="shrink-0 px-4 py-3" style={{ background: 'rgba(251,191,36,0.04)', borderBottom: '1px solid rgba(255,215,0,0.12)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-white">
              <span className="inline-flex items-center gap-1"><Icon name="sword" size={12} /> {tf('deck.battleDeck', 'Боевая колода')}</span> <span style={{ color: 'rgba(255,255,255,0.4)' }}>· тап — убрать</span>
            </div>
            <div className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
              {deck.length}/8
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {deck.map((card) => {
              const art = cardArt[card.id];
              return (
                <button
                  key={card.uid || card.id}
                  onClick={() => { impactOccurred('medium'); onToggleDeck(card); }}
                  className="shrink-0 active:scale-90 transition-all"
                  style={{ width: 64, position: 'relative' }}
                  title={getCardName(lang, card.id)}
                >
                  <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(251,191,36,0.7)', boxShadow: '0 0 12px rgba(251,191,36,0.3)' }}>
                    {art ? <CardArt src={art} boxRatio={3 / 4} mode="fixed" minH={76} maxH={76} /> : <div style={{ width: 64, height: 76, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2, background: '#080503' }}><Icon name="cards" size={22} /></div>}
                  </div>
                  <div style={{ position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', border: '2px solid #7f1d1d', color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, boxShadow: '0 0 10px rgba(239,68,68,0.7)' }}>×</div>
                  <div style={{ fontSize: 8, lineHeight: 1.15, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                    {getCardName(lang, card.id)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ✨ Активные комбо + клановые бонусы */}
      {(activeCombos.length > 0 || activeClans.length > 0) && (
        <div className="shrink-0 px-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(168,85,247,0.03)' }}>
          {activeCombos.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-bold mb-1.5 text-center" style={{ color: '#e5d5b0' }}>
                <span className="inline-flex items-center gap-1"><Icon name="sparkle" size={12} /> {tf('deck.activeCombos', 'Активные комбо')}</span> <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>· {activeCombos.length}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {activeCombos.map((c) => (
                  <div key={`${c.card1}-${c.card2}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px' }}>
                    <div style={{ display: 'flex' }}>
                      <MiniArt id={c.card1} />
                      <div style={{ width: 2 }} />
                      <MiniArt id={c.card2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#e5d5b0' }}>{c.name}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.desc}</div>
                    </div>
                    <span style={{ flexShrink: 0, color: '#e5d5b0', display: 'flex' }}><Icon name="sparkle" size={13} /></span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeClans.length > 0 && (
            <div>
              <div className="text-xs font-bold mb-1.5 text-center" style={{ color: '#e5d5b0' }}>
                <span className="inline-flex items-center gap-1"><Icon name="castle" size={12} /> {tf('deck.clanBonuses', 'Клановые бонусы')}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {activeClans.map(([clan, n]) => {
                  const b = clanBonuses[clan];
                  if (!b) return null;
                  return (
                    <div key={clan} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px' }}>
                      <span style={{ color: '#e5d5b0', display: 'flex' }}><Icon name="castle" size={13} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#e5d5b0' }}>{b.name}</div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.desc}</div>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#e5d5b0', flexShrink: 0 }}>{n} карт</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cards Grid */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="grid grid-cols-3 gap-2">
          {filtered.map((card) => {
            const inDeck = card.uid ? deckUids.has(card.uid) : false;
            return (
              <CardComponent
                key={card.uid || card.id}
                card={card}
                compact
                isSelected={inDeck}
                onClick={() => { selectionChanged(); onToggleDeck(card); }}
              />
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <div className="flex justify-center mb-2 text-white/40"><Icon name="search" size={30} /></div>
            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('deck.noCards')}</div>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div className="shrink-0 px-4 py-3" style={{ background: 'rgba(5,5,8,0.8)', borderTop: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] hover:bg-white/[0.08]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
          {t('deck.back')}
        </button>
      </div>
    </div>
  );
}
