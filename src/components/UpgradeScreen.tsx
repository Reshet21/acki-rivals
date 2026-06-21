import { useState, useMemo } from 'react';
import type { Card } from '../types';

interface Props {
  collection: Card[];
  onUpgrade: (cardUid: string) => { success: boolean; message: string };
  onBack: () => void;
}

const MAX_STARS = 5;

const clanEmojis: Record<string, string> = {
  'Неоновые Наемники': '⚔️',
  'Цифровые Монахи': '🧘',
};

const rarityLabels: Record<string, string> = {
  common: 'Обыч.',
  rare: 'Редк.',
  legendary: 'Леген.',
};

export default function UpgradeScreen({ collection, onUpgrade, onBack }: Props) {
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Group cards by id, count duplicates
  const cardGroups = useMemo(() => {
    const groups = new Map<number, { base: Card; copies: Card[]; stars: number }>();

    for (const card of collection) {
      const existing = groups.get(card.id);
      if (existing) {
        existing.copies.push(card);
        if ((card.stars ?? 0) > existing.stars) {
          existing.stars = card.stars ?? 0;
          existing.base = card;
        }
      } else {
        groups.set(card.id, {
          base: card,
          copies: [card],
          stars: card.stars ?? 0,
        });
      }
    }

    return Array.from(groups.values()).sort((a, b) => b.stars - a.stars || b.base.id - a.base.id);
  }, [collection]);

  const selectedGroup = cardGroups.find((g) => g.base.uid === selectedUid);

  const handleUpgrade = () => {
    if (!selectedUid) return;
    const result = onUpgrade(selectedUid);
    setMessage({ text: result.message, type: result.success ? 'success' : 'error' });
    if (result.success) {
      setSelectedUid(null);
    }
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="flex justify-between items-center text-sm mb-1">
          <div className="text-neon-purple font-bold">⚒️ Улучшение карт</div>
          <div className="text-white/40 text-xs">{collection.length} карт</div>
        </div>
        <div className="text-[10px] text-white/30">
          Объединяйте дубликаты для улучшения. ★1 → 2 копии, ★2 → 3 копии...
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mx-3 mb-2 px-3 py-2 rounded-lg text-xs font-bold text-center ${
          message.type ? 'bg-neon-green/10 text-neon-green border border-neon-green/30' : 'bg-neon-red/10 text-neon-red border border-neon-red/30'
        }`}>
          {message.text}
        </div>
      )}

      {/* Selected card detail */}
      {selectedGroup && (
        <div className="shrink-0 mx-3 mb-2 bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-12 rounded-lg bg-gradient-to-b from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center text-sm shrink-0">
              {clanEmojis[selectedGroup.base.clan]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{selectedGroup.base.name}</div>
              <div className="flex items-center gap-2 text-[10px] text-white/50">
                <span>{selectedGroup.base.power}⚡ {selectedGroup.base.damage}💥</span>
                <span>★{selectedGroup.stars}</span>
                <span className="text-white/30">×{selectedGroup.copies.length} копий</span>
              </div>
            </div>
          </div>

          {selectedGroup.stars < MAX_STARS ? (
            <div className="mt-2 flex items-center justify-between">
              <div className="text-[10px] text-white/40">
                Доп. копий: <span className="text-white/70 font-bold">{selectedGroup.copies.length - 1}</span>
                <span className="text-white/30 ml-1">(нужно {selectedGroup.stars === 0 ? 1 : selectedGroup.stars})</span>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={(selectedGroup.copies.length - 1) < (selectedGroup.stars === 0 ? 1 : selectedGroup.stars)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedGroup.copies.length >= selectedGroup.stars + 1
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black active:scale-95'
                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                ★ Улучшить → ★{selectedGroup.stars + 1}
              </button>
            </div>
          ) : (
            <div className="mt-2 text-center text-xs text-yellow-400 font-bold">
              ★ Максимальный уровень
            </div>
          )}
        </div>
      )}

      {/* Card list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        <div className="flex flex-col gap-1.5">
          {cardGroups.map((group) => {
            const base = group.base;
            const stars = group.stars;
            const extras = group.copies.length - 1; // exclude the base card
            const copiesNeeded = stars === 0 ? 1 : stars;
            const canUpgrade = stars < MAX_STARS && extras >= copiesNeeded;

            return (
              <button
                key={base.id}
                onClick={() => setSelectedUid(base.uid!)}
                className={`
                  flex items-center gap-3 p-2.5 rounded-xl text-left transition-all
                  ${selectedUid === base.uid
                    ? 'bg-white/10 border border-yellow-400/40'
                    : 'bg-white/5 border border-white/5 active:bg-white/10'
                  }
                `}
              >
                <div className="w-10 h-12 rounded-lg bg-gradient-to-b from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center text-sm shrink-0">
                  {clanEmojis[base.clan]}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white truncate">{base.name}</span>
                    {stars > 0 && (
                      <span className="text-yellow-400 text-[10px]">
                        {'★'.repeat(stars)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <span>{base.power + stars}⚡ {base.damage + stars}💥</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                      base.rarity === 'legendary' ? 'bg-yellow-400/20 text-yellow-400' :
                      base.rarity === 'rare' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-white/10 text-white/40'
                    }`}>
                      {rarityLabels[base.rarity]}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <div className="text-[10px] text-white/50">
                    <span className="font-bold text-white/70">{extras}</span> доп.
                  </div>
                  {stars < MAX_STARS && (
                    <div className={`text-[9px] px-1.5 py-0.5 rounded ${
                      canUpgrade
                        ? 'bg-neon-green/20 text-neon-green'
                        : 'bg-white/5 text-white/30'
                    }`}>
                      →★{stars + 1} ({copiesNeeded} коп.)
                    </div>
                  )}
                  {stars >= MAX_STARS && (
                    <div className="text-[9px] text-yellow-400">★ MAX</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Back button */}
      <div className="shrink-0 px-3 pb-3">
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
  );
}
