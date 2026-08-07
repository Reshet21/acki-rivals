import { useState, useEffect } from 'react';
import type { Card, Rarity } from '../types';
import { PACKS, getPackById } from '../data/packs';
import { useI18n } from '../i18n';
import CardComponent from './CardComponent';
import { getRarityLabel, getPackName } from '../i18n/cardTranslations';
import { useHaptic } from '../hooks/useHaptic';
import type { WalletConnection } from '../services/beeEngine';
import {
  depositNackl,
  getPlayerBalance,
  buyWithBalance,
  fetchDepositQuote,
  TREASURY_ADDRESS,
  TREASURY_NAME,
} from '../services/treasuryService';

interface Props {
  walletConnection: WalletConnection | null;
  nacklBalance: string | null;
  onBuyPack: (packId: string) => Card[] | void;
  onBack: () => void;
  starterPackClaimed: boolean;
  onClaimStarterPack: () => void;
  onReconnectWallet?: () => void;
  onZkLogin?: (provider: 'google' | 'telegram') => void;
  hasEpkKey?: boolean;
}



// ═══ PAYMENT MODE:
// 'dev' = бесплатные паки (без блокчейна)
// 'live' = реальные NACKL транзакции
// Если не задан — безопасный режим (dev)
const IS_DEV_PAYMENT = import.meta.env.VITE_PAYMENT_MODE !== 'live';

const rarityStyles: Record<Rarity, { border: string; bg: string; glow: string; text: string; gradient: string }> = {
  common: { border: 'border-gray-400', bg: 'bg-gray-500/10', glow: '', text: 'text-gray-300', gradient: 'from-gray-600 to-gray-800' },
  uncommon: { border: 'border-green-400', bg: 'bg-green-500/10', glow: 'shadow-[0_0_12px_rgba(74,222,128,0.3)]', text: 'text-green-300', gradient: 'from-green-600 to-emerald-800' },
  rare: { border: 'border-blue-400', bg: 'bg-blue-500/10', glow: 'shadow-[0_0_15px_rgba(96,165,250,0.4)]', text: 'text-blue-300', gradient: 'from-blue-600 to-indigo-800' },
  epic: { border: 'border-purple-400', bg: 'bg-purple-500/10', glow: 'shadow-[0_0_18px_rgba(168,85,247,0.4)]', text: 'text-purple-300', gradient: 'from-purple-600 to-violet-800' },
  legendary: { border: 'border-yellow-400', bg: 'bg-yellow-500/10', glow: 'shadow-[0_0_20px_rgba(250,204,21,0.5)]', text: 'text-yellow-300', gradient: 'from-yellow-500 to-amber-700' },
};

type Phase = 'shop' | 'opening' | 'result';

const packVisuals: Record<string, { gradient: string; icon: string }> = {
  starter: { gradient: 'from-green-600 via-emerald-500 to-teal-600', icon: '🎉' },
  basic: { gradient: 'from-gray-600 via-gray-500 to-gray-700', icon: '📦' },
  standard: { gradient: 'from-blue-600 via-blue-500 to-purple-600', icon: '🎁' },
  advanced: { gradient: 'from-purple-600 via-pink-500 to-yellow-500', icon: '💎' },
};

export default function Shop({ walletConnection, nacklBalance, onBuyPack, onBack, starterPackClaimed, onClaimStarterPack, onReconnectWallet, onZkLogin, hasEpkKey }: Props) {
  const { t, lang } = useI18n();
  const { impactOccurred } = useHaptic();
  const [phase, setPhase] = useState<Phase>('shop');
  const [openedCards, setOpenedCards] = useState<Card[]>([]);
  const [revealIndex, setRevealIndex] = useState(-1);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [fallbackPackId, setFallbackPackId] = useState<string | null>(null);
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);
  const [checkingFallback, setCheckingFallback] = useState(false);
  const [gameBalance, setGameBalance] = useState<number | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(10);

  // Игровой баланс (депозиты NACKL на казначейство)
  useEffect(() => {
    if (!walletConnection) {
      setGameBalance(null);
      return;
    }
    let cancelled = false;
    getPlayerBalance(walletConnection.walletAddress).then((b) => {
      if (!cancelled) setGameBalance(b);
    });
    return () => {
      cancelled = true;
    };
  }, [walletConnection]);

  // Автопополнение: пока панель пополнения открыта, каждые 15с проверяем
  // новые платежи игрока; зачислили — обновляем баланс, при наличии
  // fallbackPackId сразу покупаем пак (без повторных подтверждений).
  useEffect(() => {
    if (!walletConnection || (!showDeposit && !fallbackPackId)) return;
    if (checkingFallback) return;
    const player = walletConnection.walletAddress;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const check = async () => {
      const dep = await depositNackl(player, depositAmount, 1);
      if (cancelled) return;
      if (dep.success && (dep.depositedNackl || 0) > 0) {
        if (dep.balanceNackl !== undefined) setGameBalance(dep.balanceNackl);
        setFallbackNote((prev) =>
          prev === null ? `Зачислено ${dep.depositedNackl} NACKL. Баланс: ${dep.balanceNackl?.toFixed(2)} NACKL` : prev,
        );
        if (fallbackPackId) {
          setCheckingFallback(true);
          setFallbackNote(`Зачислено ${dep.depositedNackl} NACKL. Покупаем пак…`);
          const buy = await buyWithBalance(player, fallbackPackId);
          if (cancelled) return;
          setCheckingFallback(false);
          if (buy.success) {
            if (buy.balanceNackl !== undefined) setGameBalance(buy.balanceNackl);
            const cards = onBuyPack(fallbackPackId);
            setFallbackPackId(null);
            setShowDeposit(false);
            if (cards && cards.length > 0) {
              setOpenedCards(cards);
              setRevealIndex(-1);
              setPhase('opening');
            }
          } else {
            setFallbackNote(buy.error || 'Недостаточно средств на балансе.');
          }
        }
      }
    };
    timer = setInterval(check, 15000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [walletConnection, showDeposit, fallbackPackId, checkingFallback, depositAmount, onBuyPack]);

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

    // Starter pack is free — no wallet needed
    if (packId !== 'starter' && !walletConnection) {
      setPaymentError(t('shop.connectWalletError'));
      return;
    }

    // Starter pack is free — skip NACKL check
    if (packId !== 'starter' && !IS_DEV_PAYMENT && !walletConnection) {
      setPaymentError(t('shop.connectWalletError'));
      return;
    }

    impactOccurred('medium');
    setBuyingPackId(packId);
    setPaymentError(null);
    setNeedsReconnect(false);

    // Starter pack is free — skip blockchain payment
    if (packId === 'starter') {
      onClaimStarterPack();
      const cards = onBuyPack(packId);
      if (!cards || cards.length === 0) return;
      setOpenedCards(cards);
      setRevealIndex(-1);
      setPhase('opening');
      setBuyingPackId(null);
      return;
    }

    if (!IS_DEV_PAYMENT) {
      // ─── PRODUCTION: покупка с игрового баланса ───
      // Баланс пополняется переводом NACKL на казначейство (панель ниже).
      // Сервер списывает цену пака атомарно; сумма не передаётся клиентом.
      const player = walletConnection!.walletAddress;
      const result = await buyWithBalance(player, packId);

      if (result.success) {
        if (result.balanceNackl !== undefined) setGameBalance(result.balanceNackl);
        const cards = onBuyPack(packId);
        if (!cards || cards.length === 0) return;
        setOpenedCards(cards);
        setRevealIndex(-1);
        setPhase('opening');
        setBuyingPackId(null);
        return;
      } else {
        // 402 (недостаточно средств) или ошибка — панель пополнения
        // с УНИКАЛЬНОЙ суммой (база = цена пака + дробный хвост):
        // платёж ровно на эту сумму может перевести только этот игрок.
        setPaymentError(result.error || t('shop.paymentError'));
        const q = await fetchDepositQuote(player, pack.nacklPrice);
        setDepositAmount(q?.amountNackl ?? pack.nacklPrice);
        setFallbackPackId(packId);
        setFallbackNote(null);
        setBuyingPackId(null);
        return;
      }
    }

    // ─── DEV MODE: бесплатная выдача (блокчейн отключён) ───
    const cards = onBuyPack(packId);
    if (!cards || cards.length === 0) return;
    setOpenedCards(cards);
    setRevealIndex(-1);
    setPhase('opening');
    setBuyingPackId(null);

    // Показываем предупреждение, что платёж не прошёл, но паки выданы
    const isPaymentAttempted = walletConnection !== null;
    if (isPaymentAttempted) {
      setPaymentError(t('shop.devModeWarning'));
    }
  };

  const handleCollect = () => {
    impactOccurred('light');
    setPhase('shop');
    setOpenedCards([]);
    setRevealIndex(-1);
  };

  // ═══ Пополнение игрового баланса ═══
  // Игрок вводит сумму, переводит NACKL на ник владельца казначейства,
  // сервер зачисляет ВСЕ его платежи на игровой баланс (анти-повтор по
  // msg_hash). Покупка паков идёт сразу с баланса, без подтверждений.
  const payTargetName = TREASURY_NAME || TREASURY_ADDRESS;
  const copyTreasuryAddress = async () => {
    try {
      await navigator.clipboard.writeText(payTargetName);
      setFallbackNote(`Скопировано: ${payTargetName} ✔`);
    } catch {
      setFallbackNote(`Переведите на ник: ${payTargetName}`);
    }
  };

  const handleDepositNow = async (buyPackAfter: string | null) => {
    if (!walletConnection) return;
    const player = walletConnection.walletAddress;

    impactOccurred('medium');
    setCheckingFallback(true);
    setFallbackNote(null);
    try {
      // 1. Сканируем блокчейн: зачисляем на игровой баланс все платежи игрока
      const dep = await depositNackl(player, depositAmount);
      if (!dep.success) {
        setFallbackNote(dep.error || 'Платёж не найден. Проверьте сумму и ник.');
        return;
      }
      if (dep.balanceNackl !== undefined) setGameBalance(dep.balanceNackl);
      setFallbackNote(
        dep.depositedNackl
          ? `Зачислено ${dep.depositedNackl} NACKL. Баланс: ${dep.balanceNackl?.toFixed(2)} NACKL`
          : `Баланс: ${dep.balanceNackl?.toFixed(2)} NACKL`,
      );

      // 2. Если покупаем пак — списываем с баланса
      if (buyPackAfter) {
        const buy = await buyWithBalance(player, buyPackAfter);
        if (buy.success) {
          if (buy.balanceNackl !== undefined) setGameBalance(buy.balanceNackl);
          const cards = onBuyPack(buyPackAfter);
          setFallbackPackId(null);
          setShowDeposit(false);
          if (!cards || cards.length === 0) {
            setFallbackNote('Платёж зачислен, но паки не выданы — обратитесь к разработчику.');
            return;
          }
          setOpenedCards(cards);
          setRevealIndex(-1);
          setPhase('opening');
        } else {
          setFallbackNote(buy.error || 'Недостаточно средств на балансе.');
        }
      }
    } catch {
      setFallbackNote('Ошибка проверки платежа. Попробуйте ещё раз.');
    } finally {
      setCheckingFallback(false);
      setBuyingPackId(null);
    }
  };

  const cancelFallback = () => {
    setFallbackPackId(null);
    setShowDeposit(false);
    setFallbackNote(null);
    setBuyingPackId(null);
  };

  const canBuyPack = (packId: string): boolean => {
    const pack = getPackById(packId);
    if (!pack) return false;
    // Starter pack is free — always available (if not claimed)
    if (packId === 'starter') {
      return !starterPackClaimed;
    }
    // Dev mode — кнопка всегда активна (бесплатно)
    if (IS_DEV_PAYMENT) return true;
    // Live mode — нужен кошелёк (NACKL отправляются с любого своего кошелька)
    return !!walletConnection;
  };

  // ═══ Pack opening animation ═══
  if (phase === 'opening' || phase === 'result') {
    const topRarity = openedCards.reduce((best, c) => {
      const order = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
      return (order[c.rarity] || 0) > (order[best] || 0) ? c.rarity : best;
    }, 'common' as Rarity);
    const rarityColors: Record<Rarity, string> = {
      common: 'rgba(156,163,175,0.3)',
      uncommon: 'rgba(74,222,128,0.3)',
      rare: 'rgba(96,165,250,0.3)',
      epic: 'rgba(168,85,247,0.3)',
      legendary: 'rgba(250,204,21,0.3)',
    };

    const rarityNameColors: Record<Rarity, string> = {
      common: 'text-gray-300',
      uncommon: 'text-green-300',
      rare: 'text-blue-300',
      epic: 'text-purple-300',
      legendary: 'text-yellow-300',
    };

    const allRevealed = revealIndex >= openedCards.length;

    return (
      <div className="flex flex-col h-full w-full max-w-lg mx-auto overflow-hidden bg-battle relative">
        {/* Background glow based on best rarity */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className={`absolute w-96 h-96 rounded-full opacity-20 ${topRarity === 'legendary' ? 'animate-title-glow' : 'animate-pulse-glow'}`}
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, ${rarityColors[topRarity]} 0%, transparent 70%)`,
            }} />
          {/* Sparkle particles for high rarity */}
          {(topRarity === 'epic' || topRarity === 'legendary') && [...Array(6)].map((_, i) => (
            <div key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{
                background: rarityColors[topRarity],
                top: `${20 + Math.random() * 60}%`,
                left: `${20 + Math.random() * 60}%`,
                animation: `sparkle ${1.5 + Math.random() * 2}s ease-in-out ${i * 0.3}s infinite`,
                opacity: 0,
              }} />
          ))}
        </div>

        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 shrink-0 relative z-10">
          <div className="flex items-center gap-2">
            {phase === 'opening' ? (
              <span className="text-lg">✨</span>
            ) : (
              <span className="text-lg">🎉</span>
            )}
            <div>
              <div className="text-base font-black text-white">
                {phase === 'opening' ? t('shop.opening') : t('shop.opened')}
              </div>
              <div className={`text-[9px] uppercase tracking-wider font-bold ${rarityNameColors[topRarity]}`}>
                {getRarityLabel(lang, topRarity)}
              </div>
            </div>
          </div>
          <div className="text-sm text-neon-blue font-bold">
            {nacklBalance !== null ? `${nacklBalance} NACKL` : '—'}
          </div>
        </div>

        {/* Opening sequence - dramatic reveal */}
        <div className="flex-1 min-h-0 flex items-center justify-center px-5 pb-4 relative z-10">
          {phase === 'opening' && !allRevealed && (
            <div className="flex flex-col items-center gap-4 w-full max-w-xs mx-auto">
              {/* Single card being revealed with 3D flip */}
              {openedCards.map((card, i) => {
                if (i !== revealIndex) return null;
                return (
                  <div key={i} className="w-full animate-card-reveal">
                    <div className="relative">
                      {/* Rarity glow ring */}
                      <div className={`absolute -inset-3 rounded-2xl opacity-40 ${topRarity === 'legendary' ? 'animate-legendary-glow' : topRarity === 'epic' ? 'animate-epic-pulse' : ''}`}
                        style={{
                          background: `radial-gradient(circle, ${rarityColors[card.rarity]} 0%, transparent 70%)`,
                        }} />
                      <CardComponent card={card} />
                      <div className={`text-center mt-2 text-[10px] font-bold ${rarityNameColors[card.rarity]}`}>
                        {getRarityLabel(lang, card.rarity)}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Reveal progress bar */}
              <div className="w-full max-w-[200px] mt-4">
                <div className="flex justify-between text-[8px] text-white/20 mb-1">
                  <span>{t('shop.opening')}</span>
                  <span>{revealIndex + 1}/{openedCards.length}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-an-gold to-an-orange rounded-full transition-all duration-300"
                    style={{ width: `${((revealIndex + 1) / openedCards.length) * 100}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* All cards grid after reveal */}
          {allRevealed && (
            <div className="w-full max-w-sm mx-auto animate-fade-in">
              <div className="grid grid-cols-2 gap-3">
                {openedCards.map((card, i) => (
                  <div key={i}
                    className="animate-card-pop"
                    style={{ animationDelay: `${i * 0.15}s` }}>
                    <div className="relative">
                      <div className={`absolute -inset-2 rounded-xl opacity-40 ${card.rarity === 'legendary' ? 'animate-legendary-glow' : card.rarity === 'epic' ? 'animate-epic-pulse' : ''}`}
                        style={{
                          background: `radial-gradient(circle, ${rarityColors[card.rarity]} 0%, transparent 70%)`,
                        }} />
                      {/* Glow burst for legendary/epic */}
                      {(card.rarity === 'legendary' || card.rarity === 'epic') && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-24 h-24 rounded-full animate-glow-burst"
                            style={{
                              background: `radial-gradient(circle, ${rarityColors[card.rarity]} 0%, transparent 70%)`,
                              animationDelay: `${i * 0.15}s`,
                            }} />
                        </div>
                      )}
                      <CardComponent card={card} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Collect button */}
        {phase === 'result' && (
          <div className="shrink-0 px-5 pb-5 relative z-10 animate-slide-up">
            <button
              onClick={handleCollect}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-an-gold via-yellow-500 to-an-orange text-an-dark active:scale-95 transition-all duration-200 shadow-[0_0_30px_rgba(255,215,0,0.3)]"
            >
              {t('shop.collect')} 🎴
            </button>
          </div>
        )}
      </div>
    );
  }

  // ═══ Shop ═══
  return (
    <div className="flex flex-col h-full w-full max-w-lg mx-auto overflow-hidden bg-shop relative">
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
          <div className="flex items-center gap-1.5">
            {gameBalance !== null && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)' }}>
                <span className="text-sm font-bold" style={{ color: 'rgba(255,215,0,0.95)' }}>
                  🎮 {gameBalance.toFixed(2)} NACKL
                </span>
              </div>
            )}
            {walletConnection && (
              <button
                onClick={async () => {
                  setShowDeposit(true); setFallbackPackId(null); setPaymentError(null);
                  const q = await fetchDepositQuote(walletConnection!.walletAddress, depositAmount);
                  if (q) setDepositAmount(q.amountNackl);
                }}
                className="px-2.5 py-1.5 rounded-full text-xs font-bold bg-white/10 border border-white/15 text-white active:scale-95 transition-all"
              >
                ➕ Пополнить
              </button>
            )}
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full animate-counter-glow"
              style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }}>
              <span className="text-sm text-neon-blue font-bold">
                {nacklBalance !== null ? `${nacklBalance} NACKL` : '—'}
              </span>
            </div>
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
          <div className="px-3 py-2 rounded-lg text-xs text-center" style={{ background: needsReconnect ? 'rgba(255,180,0,0.08)' : 'rgba(255,60,60,0.1)', border: needsReconnect ? '1px solid rgba(255,180,0,0.2)' : '1px solid rgba(255,60,60,0.2)' }}>
            <span className={needsReconnect ? 'text-yellow-400' : 'text-red-400'}>{paymentError}</span>
            {needsReconnect && (
              <div className="flex flex-col gap-2 mt-2">
                {onZkLogin && !hasEpkKey && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => { setNeedsReconnect(false); setPaymentError(null); onZkLogin?.('google'); }}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-500 to-blue-700 text-white active:scale-95 transition-all animate-pulse-glow"
                    >
                      🔑 {t('shop.zkLoginButton')}
                    </button>
                    <button
                      onClick={() => { setNeedsReconnect(false); setPaymentError(null); onZkLogin?.('telegram'); }}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-sky-500 to-cyan-600 text-white active:scale-95 transition-all"
                    >
                      ✈️ {t('shop.zkLoginTelegramButton')}
                    </button>
                  </div>
                )}
                {onReconnectWallet && (
                  <button
                    onClick={() => { setNeedsReconnect(false); setPaymentError(null); onReconnectWallet?.(); }}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-yellow-600 to-orange-600 text-white active:scale-95 transition-all"
                  >
                    {t('shop.reconnectWallet')} 🔄
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Packs */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 relative z-10">
        <div className="flex flex-col gap-4">
          {(fallbackPackId || showDeposit) && walletConnection && (
            <div className="rounded-2xl border border-neon-blue/30 bg-white/[0.04] overflow-hidden"
              style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
              <div className="bg-gradient-to-r from-neon-blue to-neon-purple p-4 relative overflow-hidden">
                <div className="relative z-10 flex items-center gap-3">
                  <div className="text-3xl">💸</div>
                  <div className="flex-1">
                    <div className="text-lg font-black text-white">Пополнить игровой баланс</div>
                    <div className="text-[10px] text-white/70">
                      {fallbackPackId
                        ? `${getPackName(lang, fallbackPackId)} · ${getPackById(fallbackPackId)?.nacklPrice} NACKL`
                        : 'Переводы на ник казначейства'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-4 py-4 flex flex-col gap-3">
                <div className="text-[12px] text-white/80">
                  Переведите РОВНО{' '}
                  <span className="font-bold text-white">{Number.isFinite(depositAmount) ? depositAmount.toFixed(2) : '—'} NACKL</span>{' '}
                  в AN Wallet на{' '}
                  <span className="font-bold text-white">ник: {payTargetName}</span>. Сумма уникальна для вас — платёж зачтётся только вам:
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    step="any"
                    inputMode="decimal"
                    value={Number.isFinite(depositAmount) ? String(depositAmount) : ''}
                    onChange={(e) => setDepositAmount(parseFloat(e.target.value))}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-sm font-bold outline-none focus:border-neon-blue"
                    placeholder="Сумма NACKL"
                  />
                  <span className="text-white/60 text-sm font-bold shrink-0">NACKL</span>
                  <button
                    onClick={async () => {
                      const q = await fetchDepositQuote(walletConnection!.walletAddress, depositAmount);
                      if (q) setDepositAmount(q.amountNackl);
                    }}
                    className="px-3 py-2.5 rounded-xl text-xs font-bold bg-white/10 border border-white/15 text-white active:scale-95 transition-all shrink-0"
                    title="Выдать новую уникальную сумму"
                  >
                    🎲
                  </button>
                </div>
                <div className="text-[10px] text-white/40">
                  Кнопка 🎲 выдаёт новую уникальную сумму (например, 10.37) — у двух игроков суммы не совпадают, поэтому платёж не перепутается
                </div>
                <div className="px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-[11px] font-mono text-white/80 break-all select-all">
                  {payTargetName}
                </div>
                <button
                  onClick={copyTreasuryAddress}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-white/10 border border-white/10 text-white active:scale-95 transition-all"
                >
                  📋 Скопировать ник
                </button>
                <div className="text-[10px] text-white/50 text-center">
                  Баланс проверяется автоматически каждые 15 секунд — ничего нажимать не нужно
                </div>
                <button
                  onClick={() => handleDepositNow(fallbackPackId)}
                  disabled={checkingFallback}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                    checkingFallback
                      ? 'bg-white/5 text-white/20 border border-white/5 cursor-wait'
                      : 'bg-gradient-to-r from-neon-blue to-neon-purple text-white active:scale-95 shadow-[0_0_12px_rgba(0,212,255,0.2)]'
                  }`}
                >
                  {checkingFallback ? 'Проверяем платёж…' : '✅ Я пополнил — проверить'}
                </button>
                {fallbackNote && (
                  <div className="text-[11px] text-center text-yellow-400/90">{fallbackNote}</div>
                )}
                <button
                  onClick={cancelFallback}
                  className="w-full py-2 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-white/50 active:bg-white/10 active:scale-[0.98] transition-all"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
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
                    ? 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07] active:scale-[0.98] hover:shadow-[0_8px_30px_rgba(0,0,0,0.3),0_0_20px_rgba(255,215,0,0.08)]'
                    : 'border-white/5 bg-white/[0.02] opacity-50'
                }`}
                style={canBuy ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : undefined}
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
                      <div className="text-xl font-black text-white">{pack.nacklPrice > 0 ? `${pack.nacklPrice} NACKL` : '🎁 БЕСПЛАТНО'}</div>
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
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all relative overflow-hidden ${
                      canBuy && !isBuying
                        ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-white active:scale-95 shadow-[0_0_12px_rgba(0,212,255,0.2)]'
                        : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                    }`}
                  >
                    {canBuy && !isBuying && <span className="absolute inset-0 animate-shimmer pointer-events-none" />}
                    {isBuying
                      ? t('shop.sendingTransaction')
                      : canBuy
                        ? pack.nacklPrice > 0
                          ? `${t('shop.buy')} — ${pack.nacklPrice} NACKL`
                          : '🎁 Забрать бесплатно'
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
