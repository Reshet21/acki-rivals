import { useState, useMemo } from 'react';
import type { Card } from '../types';

interface Props {
  cards: Card[];
  onSelect: (card: Card, pillz: number) => void;
  maxPillz: number;
}

const clanEmojis: Record<string, string> = {
  'Неоновые Наемники': '⚔️',
  'Цифровые Монахи': '🧘',
};

const rarityColors: Record<string, string> = {
  common: 'border-gray-500',
  rare: 'border-blue-500',
  legendary: 'border-yellow-400',
};

function estimateAttack(power: number, pillz: number) {
  const base = power * (1 + pillz);
  return {
    min: Math.round(base * 0.9),
    max: Math.round(base * 1.1),
    avg: Math.round(base),
  };
}

export default function CardSelector({ cards, onSelect, maxPillz }: Props) {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [pillz, setPillz] = useState(0);

  const attackPreview = useMemo(() => {
    if (!selectedCard) return null;
    return estimateAttack(selectedCard.power, pillz);
  }, [selectedCard, pillz]);

  const handleAttack = () => {
    if (!selectedCard) return;
    onSelect(selectedCard, pillz);
    setSelectedCard(null);
    setPillz(0);
  };

  const handleDeselect = () => {
    setSelectedCard(null);
    setPillz(0);
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* Hand strip — selected card + attack preview */}
      <div className="shrink-0 px-2 pt-1.5 pb-1">
        {selectedCard ? (
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1.5 border border-yellow-400/40">
            <div
              className="w-8 h-10 rounded bg-gradient-to-b from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center text-xs shrink-0 cursor-pointer"
              onClick={handleDeselect}
            >
              {clanEmojis[selectedCard.clan]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-white truncate">{selectedCard.name}</div>
              <div className="flex gap-2 text-[9px] text-white/50">
                <span>⚡{selectedCard.power}</span>
                <span className="text-red-300">💥{selectedCard.damage}</span>
              </div>
            </div>

            {/* Attack preview */}
            {attackPreview && (
              <div className="flex flex-col items-end shrink-0">
                <div className="text-[9px] text-white/40">Атака</div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-[10px] text-white/30">{attackPreview.min}</span>
                  <span className="text-sm font-black text-neon-blue">{attackPreview.avg}</span>
                  <span className="text-[10px] text-white/30">{attackPreview.max}</span>
                </div>
                {/* Attack bar */}
                <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden mt-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${Math.min(100, (attackPreview.avg / 50) * 100)}%`,
                      background: attackPreview.avg > 30
                        ? 'linear-gradient(90deg, #00d4ff, #ff3366)'
                        : attackPreview.avg > 15
                          ? 'linear-gradient(90deg, #00d4ff, #b742ff)'
                          : '#00d4ff',
                    }}
                  />
                </div>
              </div>
            )}

            <div className="text-[10px] text-white/40 shrink-0 cursor-pointer" onClick={handleDeselect}>✕</div>
          </div>
        ) : (
          <div className="text-center text-[10px] text-white/30 py-1">
            Выберите карту
          </div>
        )}
      </div>

      {/* Card grid — 3 columns, compact */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-1">
        <div className="grid grid-cols-3 gap-1.5">
          {cards.map((card) => (
            <button
              key={card.uid || card.id}
              onClick={() => setSelectedCard(card)}
              className={`
                relative rounded-lg overflow-hidden text-left
                bg-gradient-to-b ${card.clan === 'Неоновые Наемники' ? 'from-purple-900/80 to-purple-800/60' : 'from-emerald-900/80 to-emerald-800/60'}
                border ${selectedCard?.uid === card.uid ? 'border-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.3)]' : rarityColors[card.rarity] + '/30'}
                transition-all duration-100
                active:scale-95
                p-1.5
              `}
            >
              {/* Rarity dot */}
              <div className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                card.rarity === 'legendary' ? 'bg-yellow-400' :
                card.rarity === 'rare' ? 'bg-blue-500' : 'bg-gray-500'
              }`} />

              <div className="text-[9px] text-white/40 mb-0.5">{clanEmojis[card.clan]}</div>
              <div className="text-[10px] font-bold text-white leading-tight truncate mb-0.5">
                {card.name}
              </div>
              <div className="text-[7px] text-white/40 truncate mb-1">{card.ability}</div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-white">⚡{card.power}</span>
                <span className="text-[10px] font-black text-red-300">💥{card.damage}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Attack panel — bottom */}
      <div className="shrink-0 bg-dark-card border-t border-dark-border px-3 py-2 flex items-center gap-2"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
          <div className="text-[9px] text-white/50">
            <span className="text-neon-blue font-bold">{maxPillz}</span> пиллз
          </div>
          <input
            type="range"
            min={0}
            max={maxPillz}
            value={pillz}
            onChange={(e) => setPillz(Number(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer
              bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink
              accent-neon-blue"
          />
          <div className="text-[9px] text-white/40">тратишь: {pillz}</div>
        </div>

        <button
          onClick={handleAttack}
          disabled={!selectedCard}
          className={`flex-1 py-2 rounded-lg font-bold text-sm
            transition-all duration-150
            ${selectedCard
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
