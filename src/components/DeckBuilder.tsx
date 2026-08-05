import { useState, useMemo } from 'react';
import type { Card, Rarity } from '../types';
import { useI18n } from '../i18n';
import CardComponent from './CardComponent';
import { RarityChips, SearchField } from './CardFilters';
import { useHaptic } from '../hooks/useHaptic';

interface Props {
  collection: Card[];
  deck: Card[];
  onToggleDeck: (card: Card) => void;
  onBack: () => void;
}

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
    <div className="flex flex-col h-full w-full max-w-lg mx-auto overflow-hidden" style={{ background: '#050508' }}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,215,0,0.1)', background: 'rgba(5,5,8,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all active:scale-95" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              ←
            </button>
            <h1 className="text-lg font-bold" style={{ color: '#FFD700' }}>{t('deck.title')} ({collection.length})</h1>
          </div>
          <div className="px-3 py-1 rounded-full text-xs font-bold transition-all" style={{ background: deck.length >= 8 ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${deck.length >= 8 ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.08)'}`, color: deck.length >= 8 ? '#4ADE80' : 'rgba(255,255,255,0.5)', boxShadow: deck.length >= 8 ? '0 0 12px rgba(74,222,128,0.2)' : 'none' }}>
            ⚔️ {deck.length}/8
          </div>
        </div>

        {/* Search */}
        <div className="mb-3">
          <SearchField value={search} onChange={setSearch} placeholder={t('deck.search')} />
        </div>

        {/* Rarity Filters */}
        <RarityChips value={rarityFilter} onChange={(v) => { selectionChanged(); setRarityFilter(v); }} />
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
      <div className="shrink-0 px-4 py-3" style={{ background: 'rgba(5,5,8,0.8)', borderTop: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] hover:bg-white/[0.08]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
          {t('deck.back')}
        </button>
      </div>
    </div>
  );
}
