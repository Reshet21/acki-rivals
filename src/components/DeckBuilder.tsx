import type { Card } from '../types';
import CardComponent from './CardComponent';

interface Props {
  collection: Card[];
  deck: Card[];
  onToggleDeck: (card: Card) => void;
  onBack: () => void;
}

const clanEmojis: Record<string, string> = {
  'Неоновые Наемники': '⚔️',
  'Цифровые Монахи': '🧘',
};

export default function DeckBuilder({ collection, deck, onToggleDeck, onBack }: Props) {
  const isDeckFull = deck.length >= 4;
  const deckUids = new Set(deck.map((c) => c.uid));

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="flex justify-between items-center text-sm mb-2">
          <div className="text-neon-purple font-bold">
            📚 Коллекция ({collection.length})
          </div>
          <div className={`font-bold ${isDeckFull ? 'text-neon-green' : 'text-white/60'}`}>
            ⚔️ {deck.length}/4
          </div>
        </div>

        {deck.length < 4 && (
          <div className="text-[10px] text-white/30 text-center">
            Выберите {4 - deck.length} карт{deck.length === 3 ? 'у' : deck.length < 3 ? 'ы' : ''}
          </div>
        )}
      </div>

      {/* Card grid */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        <div className="grid grid-cols-2 gap-2.5 justify-items-center">
          {collection.map((card) => {
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
      </div>

      {/* Bottom sticky panel — deck cards + back */}
      <div className="shrink-0 bg-dark-card border-t border-dark-border"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {/* Deck cards strip */}
        {deck.length > 0 && (
          <div className="flex gap-1.5 px-3 pt-2 pb-1 overflow-x-auto">
            {deck.map((card) => (
              <button
                key={card.uid}
                onClick={() => onToggleDeck(card)}
                className={`
                  shrink-0 flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg
                  bg-gradient-to-b ${
                    card.clan === 'Неоновые Наемники'
                      ? 'from-purple-900/60 to-purple-800/40 border-purple-500/30'
                      : 'from-emerald-900/60 to-emerald-800/40 border-emerald-500/30'
                  }
                  border transition-all duration-150
                  active:scale-95 group
                `}
              >
                <div className="w-5 h-6 rounded bg-black/30 flex items-center justify-center text-[8px] shrink-0">
                  {clanEmojis[card.clan]}
                </div>
                <div className="text-[10px] font-bold text-white truncate max-w-[60px]">
                  {card.name}
                </div>
                <div className="text-[8px] text-white/30 group-hover:text-red-400 transition-colors ml-0.5">
                  ✕
                </div>
              </button>
            ))}
            {/* Empty slots */}
            {Array.from({ length: 4 - deck.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="shrink-0 w-16 h-8 rounded-lg border border-dashed border-white/10 flex items-center justify-center"
              >
                <span className="text-[8px] text-white/15">+</span>
              </div>
            ))}
          </div>
        )}

        {/* Back button */}
        <div className="px-3 pt-1.5 pb-1">
          <button
            onClick={onBack}
            className="w-full py-2.5 rounded-lg font-bold text-sm
              bg-white/5 border border-white/10 text-white/60
              active:bg-white/10 active:scale-[0.98]
              transition-all duration-150"
          >
            Назад
          </button>
        </div>
      </div>
    </div>
  );
}
