import { useState, useMemo } from 'react';
import type { Card, Rarity } from '../types';
import CardComponent from './CardComponent';
import { useI18n } from '../i18n';

interface Props {
  collection: Card[];
  deck: Card[];
  onToggleDeck: (card: Card) => void;
  onBack: () => void;
}

const RARITY_FILTERS: { value: Rarity | 'all'; labelKey: string; color: string }[] = [
  { value: 'all', labelKey: 'deck.all', color: 'text-white' },
  { value: 'common', labelKey: 'deck.common', color: 'text-gray-400' },
  { value: 'uncommon', labelKey: 'deck.uncommon', color: 'text-green-400' },
  { value: 'rare', labelKey: 'deck.rare', color: 'text-blue-400' },
  { value: 'epic', labelKey: 'deck.epic', color: 'text-purple-400' },
  { value: 'legendary', labelKey: 'deck.legendary', color: 'text-yellow-400' },
];

const clanEmojis: Record<string, string> = {
  'Неоновые Наемники': '⚔️',
  'Цифровые Монахи': '🧘',
};

export default function DeckBuilder({ collection, deck, onToggleDeck, onBack }: Props) {
  const { t } = useI18n();
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
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="flex justify-between items-center text-sm mb-2">
          <div className="text-neon-purple font-bold">
            📚 {t('deck.title')} ({collection.length})
          </div>
          <div className={`font-bold ${deck.length >= 4 ? 'text-neon-green' : 'text-white/60'}`}>
            ⚔️ {deck.length}/4
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('deck.search')}
            className="w-full px-3 py-2 pl-8 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-neon-blue/50"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Rarity filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {RARITY_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setRarityFilter(f.value)}
              className={`shrink-0 text-[9px] px-2 py-1 rounded-full font-bold transition-all
                ${rarityFilter === f.value
                  ? 'bg-white/15 text-white border border-white/20'
                  : `${f.color} border border-transparent`
                }`}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        {deck.length < 4 && (
          <div className="text-[10px] text-white/30 text-center mt-1">
            {t('deck.select')} {4 - deck.length} {t('deck.cards')}
          </div>
        )}
      </div>

      {/* Card grid */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {filtered.length === 0 ? (
          <div className="text-center text-xs text-white/30 py-8">{t('deck.search')}</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 justify-items-center">
            {filtered.map((card) => {
              const inDeck = card.uid ? deckUids.has(card.uid) : false;
              return (
                <CardComponent
                  key={card.uid}
                  card={card}
                  isSelected={inDeck}
                  onClick={() => onToggleDeck(card)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom panel — deck + back */}
      <div className="shrink-0 bg-dark-card border-t border-dark-border"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {deck.length > 0 && (
          <div className="flex gap-1.5 px-3 pt-2 pb-1 overflow-x-auto">
            {deck.map((card) => (
              <button
                key={card.uid}
                onClick={() => onToggleDeck(card)}
                className="shrink-0 flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg bg-gradient-to-b from-purple-900/40 to-purple-800/30 border border-purple-500/20 active:scale-95 group"
              >
                <div className="w-5 h-6 rounded bg-black/30 flex items-center justify-center text-[8px] shrink-0">
                  {clanEmojis[card.clan] || '🃏'}
                </div>
                <div className="text-[10px] font-bold text-white truncate max-w-[60px]">
                  {card.name}
                </div>
                <div className="text-[8px] text-white/30 group-hover:text-red-400 transition-colors">✕</div>
              </button>
            ))}
            {Array.from({ length: 4 - deck.length }).map((_, i) => (
              <div key={`empty-${i}`} className="shrink-0 w-16 h-8 rounded-lg border border-dashed border-white/10 flex items-center justify-center">
                <span className="text-[8px] text-white/15">+</span>
              </div>
            ))}
          </div>
        )}
        <div className="px-3 pt-1.5 pb-1">
          <button onClick={onBack} className="w-full py-2.5 rounded-lg font-bold text-sm bg-white/5 border border-white/10 text-white/60 active:bg-white/10 active:scale-[0.98] transition-all">
            {t('deck.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
