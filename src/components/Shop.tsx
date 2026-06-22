import { useState } from 'react';
import type { Card, Rarity } from '../types';
import { PACKS, getPackById } from '../data/packs';
import { openPack } from '../utils/packGenerator';

interface Props {
  credits: number;
  onBuyPack: (packId: string) => void;
  onBack: () => void;
}

const rarityStyles: Record<Rarity, { border: string; bg: string; text: string; label: string }> = {
  common: { border: 'border-gray-400', bg: 'bg-gray-500/10', text: 'text-gray-300', label: 'Обычная' },
  uncommon: { border: 'border-green-400', bg: 'bg-green-500/10', text: 'text-green-300', label: 'Необычная' },
  rare: { border: 'border-blue-400', bg: 'bg-blue-500/10', text: 'text-blue-300', label: 'Редкая' },
  legendary: { border: 'border-yellow-400', bg: 'bg-yellow-500/10', text: 'text-yellow-300', label: 'Легендарная' },
};

const clanEmojis: Record<string, string> = {
  'Неоновые Наемники': '⚔️',
  'Цифровые Монахи': '🧘',
};

export default function Shop({ credits, onBuyPack, onBack }: Props) {
  const [openedCards, setOpenedCards] = useState<Card[] | null>(null);
  const [openingPack, setOpeningPack] = useState<string | null>(null);

  const handleBuy = (packId: string) => {
    const pack = getPackById(packId);
    if (!pack || credits < pack.price) return;
    onBuyPack(packId);
  };

  const handleOpen = (packId: string) => {
    setOpeningPack(packId);
    const cards = openPack(packId);
    // Simulate opening animation
    setTimeout(() => {
      setOpenedCards(cards);
      setOpeningPack(null);
    }, 600);
  };

  const handleCloseResult = () => {
    setOpenedCards(null);
  };

  // Pack opening result overlay
  if (openedCards) {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto p-4">
        <div className="text-xl font-bold text-white">🎉 Набор открыт!</div>

        <div className="grid grid-cols-3 gap-2 w-full">
          {openedCards.map((card, i) => {
            const style = rarityStyles[card.rarity];
            return (
              <div
                key={i}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 ${style.border} ${style.bg} animate-fade-in`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="text-lg">{clanEmojis[card.clan]}</div>
                <div className={`text-[10px] font-bold text-center leading-tight ${style.text}`}>
                  {card.name}
                </div>
                <div className="text-[8px] text-white/40">
                  {card.power}⚡ {card.damage}💥
                </div>
                <div className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
                  {style.label}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleCloseResult}
          className="w-full py-3 rounded-xl font-bold text-sm bg-white/10 text-white active:scale-95 transition-all"
        >
          Забрать карты
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm mx-auto p-4">
      <div className="flex justify-between items-center">
        <div className="text-lg font-bold text-white">🛒 Магазин</div>
        <div className="text-sm text-neon-blue font-bold">💰 {credits}</div>
      </div>

      <div className="flex flex-col gap-3">
        {PACKS.map((pack) => {
          const canBuy = credits >= pack.price;
          const isOpening = openingPack === pack.id;
          const rarities = Object.entries(pack.rarityWeights);

          return (
            <div
              key={pack.id}
              className={`rounded-xl border p-3 transition-all ${
                canBuy ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02] opacity-60'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-sm font-bold text-white">{pack.name}</div>
                  <div className="text-[10px] text-white/40">{pack.description}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${canBuy ? 'text-neon-blue' : 'text-white/30'}`}>
                    💰 {pack.price}
                  </div>
                  <div className="text-[9px] text-white/30">{pack.cardCount} карт</div>
                </div>
              </div>

              {/* Rarity chances */}
              <div className="flex gap-1.5 mb-3 flex-wrap">
                {rarities.map(([rarity, weight]) => {
                  const style = rarityStyles[rarity as Rarity];
                  const total = rarities.reduce((s, [, w]) => s + w, 0);
                  const pct = Math.round((weight / total) * 100);
                  return (
                    <span
                      key={rarity}
                      className={`text-[8px] px-1.5 py-0.5 rounded-full border ${style.border} ${style.text}`}
                    >
                      {style.label} {pct}%
                    </span>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleBuy(pack.id)}
                  disabled={!canBuy || isOpening}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    canBuy && !isOpening
                      ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30 active:scale-95'
                      : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  Купить
                </button>
                <button
                  onClick={() => handleOpen(pack.id)}
                  disabled={!canBuy || isOpening}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    canBuy && !isOpening
                      ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30 active:scale-95'
                      : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  {isOpening ? 'Открытие...' : 'Открыть'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

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
  );
}
