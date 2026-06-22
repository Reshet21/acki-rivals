import { useState, useEffect } from 'react';
import type { Card, Rarity } from '../types';
import { PACKS, getPackById } from '../data/packs';
import { openPack } from '../utils/packGenerator';
import { useI18n } from '../i18n';

interface Props {
  credits: number;
  onBuyPack: (packId: string) => void;
  onBack: () => void;
}

const rarityStyles: Record<Rarity, { border: string; bg: string; glow: string; text: string; label: string }> = {
  common: { border: 'border-gray-400', bg: 'bg-gray-500/10', glow: '', text: 'text-gray-300', label: 'Обычная' },
  uncommon: { border: 'border-green-400', bg: 'bg-green-500/10', glow: 'shadow-[0_0_12px_rgba(74,222,128,0.3)]', text: 'text-green-300', label: 'Необычная' },
  rare: { border: 'border-blue-400', bg: 'bg-blue-500/10', glow: 'shadow-[0_0_15px_rgba(96,165,250,0.4)]', text: 'text-blue-300', label: 'Редкая' },
  epic: { border: 'border-purple-400', bg: 'bg-purple-500/10', glow: 'shadow-[0_0_18px_rgba(168,85,247,0.4)]', text: 'text-purple-300', label: 'Эпическая' },
  legendary: { border: 'border-yellow-400', bg: 'bg-yellow-500/10', glow: 'shadow-[0_0_20px_rgba(250,204,21,0.5)]', text: 'text-yellow-300', label: 'Легендарная' },
};

const clanEmojis: Record<string, string> = {
  'Неоновые Наемники': '⚔️',
  'Цифровые Монахи': '🧘',
};

type Phase = 'shop' | 'opening' | 'result';

export default function Shop({ credits, onBuyPack, onBack }: Props) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>('shop');
  const [openedCards, setOpenedCards] = useState<Card[]>([]);
  const [revealIndex, setRevealIndex] = useState(-1);

  // Reveal cards one by one
  useEffect(() => {
    if (phase !== 'opening' || openedCards.length === 0) return;

    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      setRevealIndex(idx);
      if (idx >= openedCards.length) {
        clearInterval(interval);
        setTimeout(() => setPhase('result'), 400);
      }
    }, 300);

    return () => clearInterval(interval);
  }, [phase, openedCards.length]);

  const handleBuy = (packId: string) => {
    const pack = getPackById(packId);
    if (!pack || credits < pack.price) return;

    // Deduct credits and generate cards BEFORE setting phase
    onBuyPack(packId);
    const cards = openPack(packId);
    setOpenedCards(cards);
    setRevealIndex(-1);
    setPhase('opening');
  };

  const handleCollect = () => {
    setPhase('shop');
    setOpenedCards([]);
    setRevealIndex(-1);
  };

  // ═══ Opening animation ═══
  if (phase === 'opening' || phase === 'result') {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto p-4 h-[100dvh]">
        {/* Title */}
        <div className="text-xl font-bold text-white shrink-0">
          {phase === 'opening' ? `✨ ${t('shop.opening')}` : `🎉 ${t('shop.opened')}`}
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-3 gap-2.5 w-full flex-1 min-h-0 overflow-y-auto">
          {openedCards.map((card, i) => {
            const revealed = i <= revealIndex;
            const style = rarityStyles[card.rarity];
            return (
              <div
                key={i}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all duration-300
                  ${revealed ? `${style.border} ${style.bg} ${style.glow} scale-100 opacity-100` : 'border-white/5 bg-white/5 scale-90 opacity-0'}
                `}
              >
                {/* Clan emoji */}
                <div className="text-xl">{clanEmojis[card.clan]}</div>

                {/* Name */}
                <div className={`text-[11px] font-bold text-center leading-tight ${style.text}`}>
                  {card.name}
                </div>

                {/* Stats */}
                <div className="flex gap-2 text-[10px]">
                  <span className="text-white/60">⚡{card.power}</span>
                  <span className="text-red-300/80">💥{card.damage}</span>
                </div>

                {/* Ability */}
                <div className="text-[8px] text-white/40 text-center leading-tight px-1">
                  {card.ability}
                </div>

                {/* Rarity badge */}
                <div className={`text-[7px] font-bold px-2 py-0.5 rounded-full border ${style.border} ${style.text}`}>
                  {style.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Collect button */}
        {phase === 'result' && (
          <button
            onClick={handleCollect}
            className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-neon-blue to-neon-purple text-white active:scale-95 transition-all shrink-0"
          >
            {t('shop.collect')}
          </button>
        )}
      </div>
    );
  }

  // ═══ Shop ═══
  return (
    <div className="flex flex-col gap-3 w-full max-w-sm mx-auto p-4">
      <div className="flex justify-between items-center">
        <div className="text-lg font-bold text-white">{t('shop.title')}</div>
        <div className="text-sm text-neon-blue font-bold">💰 {credits}</div>
      </div>

      <div className="flex flex-col gap-3">
        {PACKS.map((pack) => {
          const canBuy = credits >= pack.price;
          const rarities = Object.entries(pack.rarityWeights);

          return (
            <div
              key={pack.id}
              className={`rounded-xl border p-3 transition-all ${
                canBuy ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02] opacity-50'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-sm font-bold text-white">{pack.name}</div>
                  <div className="text-[10px] text-white/40">{pack.description}</div>
                </div>
                <div className="text-right shrink-0 ml-2">
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

              <button
                onClick={() => handleBuy(pack.id)}
                disabled={!canBuy}
                className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all ${
                  canBuy
                    ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white active:scale-95 shadow-[0_0_12px_rgba(0,212,255,0.2)]'
                    : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                }`}
              >
                {canBuy ? `${t('shop.buy')} ${pack.price} 💰` : t('shop.notEnough')}
              </button>
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
        {t('deck.back')}
      </button>
    </div>
  );
}
