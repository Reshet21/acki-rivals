import { useState, useMemo } from 'react';
import type { Card, Rarity } from '../types';
import { useI18n } from '../i18n';
import CardComponent from './CardComponent';
import { useHaptic } from '../hooks/useHaptic';

interface Props {
  collection: Card[];
  deck: Card[];
  onToggleDeck: (card: Card) => void;
  onBack: () => void;
}

const RARITY_FILTERS: { value: Rarity | 'all'; labelKey: string; color: string }[] = [
  { value: 'all', labelKey: 'deck.filterAll', color: 'text-white' },
  { value: 'common', labelKey: 'deck.filterCommon', color: 'text-gray-400' },
  { value: 'uncommon', labelKey: 'deck.filterUncommon', color: 'text-green-400' },
  { value: 'rare', labelKey: 'deck.filterRare', color: 'text-blue-400' },
  { value: 'epic', labelKey: 'deck.filterEpic', color: 'text-purple-400' },
  { value: 'legendary', labelKey: 'deck.filterLegendary', color: 'text-yellow-400' },
];

export default function DeckBuilder({ collection, deck, onToggleDeck, onBack }: Props) {
  const { t } = useI18n();
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

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden" style={{ background: '#050508' }}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,215,0,0.1)' }}>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(255,255,255,0.05)' }}>
              ←
            </button>
            <h1 className="text-lg font-bold" style={{ color: '#FFD700' }}>{t('deck.title')} ({collection.length})</h1>
          </div>
          <div className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: deck.length >= 8 ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${deck.length >= 8 ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.08)'}`, color: deck.length >= 8 ? '#4ADE80' : 'rgba(255,255,255,0.5)' }}>
            ⚔️ {deck.length}/8
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('deck.search')}
            className="w-full px-4 py-2.5 pl-10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Rarity Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {RARITY_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { selectionChanged(); setRarityFilter(f.value); }}
              className="px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all active:scale-95"
              style={{
                background: rarityFilter === f.value ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${rarityFilter === f.value ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.06)'}`,
                color: rarityFilter === f.value ? '#FFD700' : 'rgba(255,255,255,0.4)',
              }}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
      </div>

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
            <div className="text-3xl mb-2">🔍</div>
            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('deck.noCards')}</div>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div className="shrink-0 px-4 py-3" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
          {t('deck.back')}
        </button>
      </div>
    </div>
  );
}
