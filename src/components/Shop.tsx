import { useState, useEffect } from 'react';
import type { Card, Rarity } from '../types';
import { PACKS, getPackById } from '../data/packs';
import { useI18n } from '../i18n';
import CardComponent from './CardComponent';
import { getRarityLabel, getPackName } from '../i18n/cardTranslations';
import { useHaptic } from '../hooks/useHaptic';
import type { WalletConnection } from '../services/beeEngine';
import { buyPack as buyPackWithNackl } from '../services/paymentService';

interface Props {
  walletConnection: WalletConnection | null;
  nacklBalance: string | null;
  onBuyPack: (packId: string) => Card[] | void;
  onBack: () => void;
}

const rarityStyles: Record<Rarity, { border: string; bg: string; glow: string; text: string; gradient: string }> = {
  common: { border: 'border-gray-400', bg: 'bg-gray-500/10', glow: '', text: 'text-gray-300', gradient: 'from-gray-600 to-gray-800' },
  uncommon: { border: 'border-green-400', bg: 'bg-green-500/10', glow: 'shadow-[0_0_12px_rgba(74,222,128,0.3)]', text: 'text-green-300', gradient: 'from-green-600 to-emerald-800' },
  rare: { border: 'border-blue-400', bg: 'bg-blue-500/10', glow: 'shadow-[0_0_15px_rgba(96,165,250,0.4)]', text: 'text-blue-300', gradient: 'from-blue-600 to-indigo-800' },
  epic: { border: 'border-purple-400', bg: 'bg-purple-500/10', glow: 'shadow-[0_0_18px_rgba(168,85,247,0.4)]', text: 'text-purple-300', gradient: 'from-purple-600 to-violet-800' },
  legendary: { border: 'border-yellow-400', bg: 'bg-yellow-500/10', glow: 'shadow-[0_0_20px_rgba(250,204,21,0.5)]', text: 'text-yellow-300', gradient: 'from-yellow-500 to-amber-700' },
};

type Phase = 'shop' | 'opening' | 'result';

const packVisuals: Record<string, { gradient: string; icon: string }> = {
  basic: { gradient: 'from-gray-600 via-gray-500 to-gray-700', icon: '📦' },
  standard: { gradient: 'from-blue-600 via-blue-500 to-purple-600', icon: '🎁' },
  advanced: { gradient: 'from-purple-600 via-pink-500 to-yellow-500', icon: '💎' },
};

export default function Shop({ walletConnection, nacklBalance, onBuyPack, onBack }: Props) {
  const { t, lang } = useI18n();
  const { impactOccurred } = useHaptic();
  const [phase, setPhase] = useState<Phase>('shop');
  const [openedCards, setOpenedCards] = useState<Card[]>([]);
  const [revealIndex, setRevealIndex] = useState(-1);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

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
    }, 350);

    return () => clearInterval(interval);
  }, [phase, openedCards.length]);

  const handleBuy = async (packId: string) => {
    const pack = getPackById(packId);
    if (!pack) return;

    if (!walletConnection) {
      setPaymentError(t('shop.connectWalletError'));
      return;
    }

    const balance = parseFloat(nacklBalance || '0');
    if (balance < pack.nacklPrice) {
      setPaymentError(t('shop.notEnoughNackl'));
      return;
    }

    impactOccurred('medium');
    setBuyingPackId(packId);
    setPaymentError(null);

    try {
      const result = await buyPackWithNackl(walletConnection, pack.nacklPrice);

      if (result.success) {
        const cards = onBuyPack(packId);
        if (!cards || cards.length === 0) return;
        setOpenedCards(cards);
        setRevealIndex(-1);
        setPhase('opening');
      } else {
        setPaymentError(result.error || t('shop.paymentError'));
      }
    } catch (e) {
      setPaymentError(t('shop.networkError'));
    } finally {
      setBuyingPackId(null);
    }
  };

  const handleCollect = () => {
    impactOccurred('light');
    setPhase('shop');
    setOpenedCards([]);
    setRevealIndex(-1);
  };

  const canBuyPack = (packId: string): boolean => {
    if (!walletConnection) return false;
    const pack = getPackById(packId);
    if (!pack) return false;
    const balance = parseFloat(nacklBalance || '0');
    return balance >= pack.nacklPrice;
  };

  // ═══ Pack opening animation ═══
  if (phase === 'opening' || phase === 'result') {
    const topRarity = openedCards.reduce((best, c) => {
      const order = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
      return (order[c.rarity] || 0) > (order[best] || 0) ? c.rarity : best;
    }, 'common' as Rarity);
    const topStyle = rarityStyles[topRarity];

    return (
      <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden bg-battle relative">
        {/* Background glow based on best rarity */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className={`absolute w-64 h-64 rounded-full animate-pulse-glow opacity-20 ${topStyle.glow}`}
            style={{ top: '10%', left: '50%', transform: 'translateX(-50%)', background: `radial-gradient(circle, currentColor 0%, transparent 70%)` }} />
        </div>

        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 shrink-0 relative z-10">
          <div className="text-lg font-bold text-white">
            {phase === 'opening' ? `✨ ${t('shop.opening')}` : `🎉 ${t('shop.opened')}`}
          </div>
          <div className="text-sm text-neon-blue font-bold">
            {nacklBalance !== null ? `${nacklBalance} NACKL` : '—'}
          </div>
        </div>

        {/* Cards grid */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 relative z-10">
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm mx-auto">
            {openedCards.map((card, i) => {
              const revealed = i <= revealIndex;
              return (
                <div
                  key={i}
                  className={`transition-all duration-500 ${
                    revealed
                      ? 'opacity-100 scale-100 translate-y-0'
                      : 'opacity-0 scale-75 translate-y-4'
                  }`}
                >
                  {revealed && <CardComponent card={card} compact />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Collect button */}
        {phase === 'result' && (
          <div className="shrink-0 px-4 pb-4 relative z-10">
            <button
              onClick={handleCollect}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-neon-blue to-neon-purple text-white active:scale-95 transition-all shadow-[0_0_16px_rgba(0,212,255,0.3)]"
            >
              {t('shop.collect')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ═══ Shop ═══
  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto overflow-hidden bg-shop relative">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-48 h-48 rounded-full animate-aurora-1 opacity-15"
          style={{ top: '-20%', left: '-10%', background: 'radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)' }} />
        <div className="absolute w-40 h-40 rounded-full animate-aurora-2 opacity-10"
          style={{ bottom: '10%', right: '-10%', background: 'radial-gradient(circle, rgba(0,212,255,0.3) 0%, transparent 70%)', animationDelay: '4s' }} />
      </div>

      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 shrink-0 relative z-10">
        <div className="text-lg font-bold text-white">{t('shop.title')}</div>
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full animate-counter-glow"
          style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}>
          <span className="text-sm text-neon-blue font-bold">
            {nacklBalance !== null ? `${nacklBalance} NACKL` : '—'}
          </span>
        </div>
      </div>

      {/* Wallet warning */}
      {!walletConnection && (
        <div className="px-4 mb-3">
          <div className="px-3 py-2 rounded-lg text-xs text-center" style={{ background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.2)' }}>
            <span style={{ color: 'rgba(255,215,0,0.8)' }}>{t('shop.connectWalletInfo')}</span>
          </div>
        </div>
      )}

      {/* Payment error */}
      {paymentError && (
        <div className="px-4 mb-3">
          <div className="px-3 py-2 rounded-lg text-xs text-center" style={{ background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.2)' }}>
            <span className="text-red-400">{paymentError}</span>
          </div>
        </div>
      )}

      {/* Packs */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 relative z-10">
        <div className="flex flex-col gap-4">
          {PACKS.map((pack) => {
            const canBuy = canBuyPack(pack.id);
            const isBuying = buyingPackId === pack.id;
            const rarities = Object.entries(pack.rarityWeights);
            const visual = packVisuals[pack.id] || packVisuals.basic;

            return (
              <div
                key={pack.id}
                className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
                  canBuy
                    ? 'border-white/10 bg-white/5 hover:bg-white/8 active:scale-[0.98]'
                    : 'border-white/5 bg-white/[0.02] opacity-50'
                }`}
              >
                {/* Pack header with gradient */}
                <div className={`bg-gradient-to-r ${visual.gradient} p-4 relative overflow-hidden`}>
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute w-24 h-24 rounded-full bg-white/10 -top-8 -right-8" />
                    <div className="absolute w-16 h-16 rounded-full bg-white/5 bottom-2 left-4" />
                  </div>
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="text-3xl">{visual.icon}</div>
                    <div className="flex-1">
                      <div className="text-lg font-black text-white">{getPackName(lang, pack.id)}</div>
                      <div className="text-[10px] text-white/70">{t(pack.descKey)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-white">{pack.nacklPrice} NACKL</div>
                      <div className="text-[9px] text-white/60">{pack.cardCount} {t('deck.cards')}</div>
                    </div>
                  </div>
                </div>

                {/* Rarity chances */}
                <div className="px-4 py-3">
                  <div className="text-[9px] text-white/30 uppercase tracking-wider mb-2">{t('shop.dropRates') || 'Drop rates'}</div>
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {rarities.map(([rarity, weight]) => {
                      const style = rarityStyles[rarity as Rarity];
                      const total = rarities.reduce((s, [, w]) => s + w, 0);
                      const pct = Math.round((weight / total) * 100);
                      return (
                        <span
                          key={rarity}
                          className={`text-[9px] px-2 py-0.5 rounded-full border ${style.border} ${style.text}`}
                        >
                          {getRarityLabel(lang, rarity)} {pct}%
                        </span>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handleBuy(pack.id)}
                    disabled={!canBuy || isBuying}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                      canBuy && !isBuying
                        ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white active:scale-95 shadow-[0_0_12px_rgba(0,212,255,0.2)]'
                        : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                    }`}
                  >
                    {isBuying
                      ? t('shop.sendingTransaction')
                      : canBuy
                        ? `${t('shop.buy')} — ${pack.nacklPrice} NACKL`
                        : walletConnection
                          ? t('shop.notEnough')
                          : t('shop.noWallet')
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Back button */}
      <div className="shrink-0 px-4 pb-4 relative z-10">
        <button
          onClick={() => { impactOccurred('soft'); onBack(); }}
          className="w-full py-2.5 rounded-lg font-bold text-sm bg-white/5 border border-white/10 text-white/60 active:bg-white/10 active:scale-[0.98] transition-all"
        >
          {t('deck.back')}
        </button>
      </div>
    </div>
  );
}
