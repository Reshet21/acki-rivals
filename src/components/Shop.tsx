import { useState, useEffect, useRef } from 'react';
import type { Card, Rarity } from '../types';
import { PACKS, getPackById } from '../data/packs';
import { cards } from '../data/cards';
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
import Icon from './Icon';

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

const packVisuals: Record<string, { color: string; icon: import('./Icon').IconName }> = {
  starter: { color: 'bg-emerald-600', icon: 'party' },
  basic: { color: 'bg-gray-600', icon: 'gift' },
  standard: { color: 'bg-blue-600', icon: 'gift' },
  advanced: { color: 'bg-purple-600', icon: 'sparkle' },
};

export default function Shop({ walletConnection, nacklBalance, onBuyPack, onBack, starterPackClaimed, onClaimStarterPack, onReconnectWallet, onZkLogin, hasEpkKey }: Props) {
  const { t, lang } = useI18n();
  const { impactOccurred, selectionChanged } = useHaptic();
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
  const [lastSpent, setLastSpent] = useState<number | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(10);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [infoPackId, setInfoPackId] = useState<string | null>(null);

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
      // Проверяем только сумму с уникальным хвостом (база + 0.01..0.99).
      // Целая сумма в поле = хвост ещё не добавлен: сначала генерим его,
      // иначе платёж ровно на целую сумму может принадлежать другому игроку.
      if (!hasTail(depositAmount)) {
        applyQuote(depositAmount);
        return;
      }
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
            const fbPack = getPackById(fallbackPackId);
            if (fbPack) setLastSpent(fbPack.nacklPrice);
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
        setLastSpent(pack.nacklPrice);
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
    setLastSpent(null);
  };

  // ═══ Пополнение игрового баланса ═══
  // Игрок вводит сумму, переводит NACKL на ник владельца казначейства,
  // сервер зачисляет ВСЕ его платежи на игровой баланс (анти-повтор по
  // msg_hash). Покупка паков идёт сразу с баланса, без подтверждений.
  const payTargetName = TREASURY_NAME || TREASURY_ADDRESS;
  const copyTreasuryAddress = async () => {
    try {
      await navigator.clipboard.writeText(payTargetName);
      setFallbackNote(`Скопировано: ${payTargetName}`);
    } catch {
      setFallbackNote(`Переведите на ник: ${payTargetName}`);
    }
  };

  // Уникальная сумма: база (что ввёл игрок / цена пака) + случайный хвост
  // 0.01..0.99. Хвост пишется ПРЯМО В ПОЛЕ и генерится автоматически:
  // 1. после ввода (debounce 800мс); 2. при открытии панели; 3. по blur;
  // 4. внутри "Я пополнил"/автополлинга, если сумма вдруг ещё целая.
  // ручная перегенерация.
  const hasTail = (amount: number) =>
    Number.isFinite(amount) && Math.round(amount * 100) % 100 !== 0;

  const quoteVersionRef = useRef(0);
  const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyQuote = async (wanted: number) => {
    if (!walletConnection || !Number.isFinite(wanted) || wanted <= 0) return;
    const version = ++quoteVersionRef.current;
    setQuoteLoading(true);
    try {
      const q = await fetchDepositQuote(walletConnection.walletAddress, wanted);
      if (q && version === quoteVersionRef.current) setDepositAmount(q.amountNackl);
    } finally {
      if (version === quoteVersionRef.current) setQuoteLoading(false);
    }
  };

  // Ввод суммы: сразу инвалидируем летящие квоты (игрок печатает) и по
  // остановке печати (800мс тишины) автоматом добавляем уникальный хвост.
  // Если игрок сам ввёл дробную (например 25.37) — это уже уникальная
  // сумма, её не трогаем.
  const onDepositAmountChange = (raw: string) => {
    quoteVersionRef.current++;
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    const amount = parseFloat(raw);
    setDepositAmount(amount);
    if (!Number.isFinite(amount) || amount <= 0 || hasTail(amount)) return;
    quoteTimerRef.current = setTimeout(() => {
      applyQuote(amount);
    }, 800);
  };

  const handleDepositNow = async (buyPackAfter: string | null) => {
    if (!walletConnection) return;
    const player = walletConnection.walletAddress;

    impactOccurred('medium');
    setCheckingFallback(true);
    setFallbackNote(null);
    try {
      // Сумма без хвоста: сначала генерим уникальную (база + 0.01..0.99),
      // затем игрок переводит РОВНО её — платёж не перепутается с чужим.
      let amount = depositAmount;
      if (!hasTail(amount)) {
        const q = await fetchDepositQuote(player, amount);
        if (!q) {
          setFallbackNote('Не удалось подобрать уникальную сумму, попробуйте ещё раз');
          return;
        }
        amount = q.amountNackl;
        setDepositAmount(amount);
        setFallbackNote(`Переведите РОВНО ${amount.toFixed(2)} NACKL на ник ${payTargetName} и нажмите «Я пополнил» ещё раз`);
        return;
      }

      // 1. Сканируем блокчейн: зачисляем на игровой баланс все платежи игрока
      const dep = await depositNackl(player, amount);
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
              <span className="text-white/90"><Icon name="sparkle" size={18} /></span>
            ) : (
              <span className="text-white/90"><Icon name="party" size={18} /></span>
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
          <div className="flex flex-col items-end gap-0.5">
            {lastSpent !== null && (
              <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: 'rgba(255,110,110,0.95)' }}>
                −{lastSpent.toFixed(2)} NACKL
              </span>
            )}
            <span className="text-sm text-neon-blue font-bold whitespace-nowrap">
              {gameBalance !== null ? `${gameBalance.toFixed(2)} NACKL` : '—'}
            </span>
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
              className="w-full py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: '#ffffff' }}
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
    <div className="flex flex-col h-full w-full max-w-lg mx-auto overflow-hidden bg-shop relative">
      {/* Header */}
      <div className="px-4 py-3 shrink-0 relative z-10">
        {/* Одна строка: назад (слева) + заголовок (центр) + балансы (справа) на одном уровне */}
        <div className="relative flex items-center min-h-[36px]">
          <button onClick={() => { impactOccurred('soft'); onBack(); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
            ←
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 text-lg font-bold text-white whitespace-nowrap"><Icon name="bag" size={16} /> {t('shop.title').replace(/^[^\p{L}\p{N}]+/u, '').trim()}</div>
          <div className="ml-auto flex flex-col items-end gap-0.5">
            {gameBalance !== null && (
              <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: 'rgba(255,215,0,0.95)' }}>
                <span className="inline-flex items-center gap-1"><Icon name="gamepad" size={11} /> {gameBalance.toFixed(2)} NACKL</span>
              </span>
            )}
            <span className="text-[10px] text-neon-blue font-bold whitespace-nowrap">
              {nacklBalance !== null ? `${nacklBalance} NACKL` : '—'}
            </span>
          </div>
        </div>
        {/* Пополнить — centered, full width */}
        {walletConnection && (
          <button
            onClick={() => {
              setShowDeposit(true); setFallbackPackId(null); setPaymentError(null);
              applyQuote(depositAmount);
            }}
            className="w-full mt-2 py-2 text-sm font-bold bg-white/10 border border-white/15 text-white active:scale-[0.98] transition-all"
            style={{ borderRadius: 9 }}
          >
            <span className="inline-flex items-center gap-1.5 justify-center"><Icon name="plus" size={15} /> Пополнить</span>
          </button>
        )}
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
                      <span className="inline-flex items-center gap-1.5 justify-center"><Icon name="key" size={14} /> {t('shop.zkLoginButton')}</span>
                    </button>
                    <button
                      onClick={() => { setNeedsReconnect(false); setPaymentError(null); onZkLogin?.('telegram'); }}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-sky-500 to-cyan-600 text-white active:scale-95 transition-all"
                    >
                      {t('shop.zkLoginTelegramButton')}
                    </button>
                  </div>
                )}
                {onReconnectWallet && (
                  <button
                    onClick={() => { setNeedsReconnect(false); setPaymentError(null); onReconnectWallet?.(); }}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-yellow-600 to-orange-600 text-white active:scale-95 transition-all"
                  >
                    <span className="inline-flex items-center gap-1.5 justify-center">{t('shop.reconnectWallet')} <Icon name="arrowRight" size={14} /></span>
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
                  <div className="text-white/60"><Icon name="moneybag" size={30} /></div>
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
                  <span className="font-bold text-white">
                    {hasTail(depositAmount)
                      ? depositAmount.toFixed(2)
                      : quoteLoading
                        ? 'подбираем…'
                        : '—'} NACKL
                  </span>{' '}
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
                    onChange={(e) => onDepositAmountChange(e.target.value)}
                    onBlur={() => {
                      if (!hasTail(depositAmount)) applyQuote(depositAmount);
                    }}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white text-sm font-bold outline-none focus:border-neon-blue"
                    placeholder="Сумма NACKL"
                  />
                  <span className="text-white/60 text-sm font-bold shrink-0">NACKL</span>
                  <button
                    onClick={() => applyQuote(depositAmount)}
                    disabled={quoteLoading}
                    className="px-3 py-2.5 rounded-xl text-xs font-bold bg-white/10 border border-white/15 text-white active:scale-95 transition-all shrink-0 disabled:opacity-40"
                    title="Выдать новую уникальную сумму"
                  >
                    {quoteLoading ? '…' : <Icon name="dice" size={16} />}
                  </button>
                </div>
                <div className="text-[10px] text-white/40">
                  Уникальная сумма (например, 10.37) генерируется автоматически после ввода. У двух игроков суммы не совпадают, поэтому платёж не перепутается
                </div>
                <div className="px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-[11px] font-mono text-white/80 break-all select-all">
                  {payTargetName}
                </div>
                <button
                  onClick={copyTreasuryAddress}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-white/10 border border-white/10 text-white active:scale-95 transition-all"
                >
                  <span className="inline-flex items-center gap-1.5 justify-center"><Icon name="deck" size={14} /> Скопировать ник</span>
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
                  {checkingFallback ? 'Проверяем платёж…' : <span className="inline-flex items-center gap-1.5 justify-center"><Icon name="check" size={14} stroke={2.4} /> Я пополнил — проверить</span>}
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
                {/* Pack header — solid color */}
                <div className={`${visual.color} p-4 relative overflow-hidden`}>
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute w-24 h-24 rounded-full bg-white/10 -top-8 -right-8" />
                    <div className="absolute w-16 h-16 rounded-full bg-white/5 bottom-2 left-4" />
                  </div>
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="text-white"><Icon name={visual.icon} size={30} /></div>
                    <div className="flex-1">
                      <div className="text-lg font-black text-white">{getPackName(lang, pack.id)}</div>
                      <div className="text-[10px] text-white/70">{t(pack.descKey)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-white">{pack.nacklPrice > 0 ? `${pack.nacklPrice} NACKL` : <span className="inline-flex items-center gap-1.5"><Icon name="gift" size={16} /> БЕСПЛАТНО</span>}</div>
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

                  {pack.pity && (() => {
                    const current = Number(localStorage.getItem(`acki-pity-${pack.id}`) || 0);
                    const { rarity, max } = pack.pity;
                    const left = Math.max(0, max - current);
                    const pct = Math.min(100, Math.round((current / max) * 100));
                    const style = rarityStyles[rarity];
                    return (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[9px] font-bold ${style.text}`}>
                            {t('shop.pityGuarantee').replace('{rarity}', getRarityLabel(lang, rarity)).replace('{max}', String(max))}
                          </span>
                          <span className="text-[9px] text-white/40">{left === 0 ? <Icon name="check" size={11} stroke={2.4} /> : t('shop.pityLeft').replace('{left}', String(left))}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${left === 0 ? 'bg-yellow-400' : 'bg-white/25'}`}
                            style={{ width: `${left === 0 ? 100 : pct}%` }} />
                        </div>
                      </div>
                    );
                  })()}

                  <button
                    onClick={() => { impactOccurred('light'); setInfoPackId(pack.id); }}
                    className="w-full mb-2 py-2 rounded-xl text-[10px] font-bold bg-white/[0.04] border border-white/[0.08] text-white/50 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                  >
                    <Icon name="info" size={12} /> {t('shop.packInfo')}
                  </button>

                  <button
                    onClick={() => handleBuy(pack.id)}
                    disabled={!canBuy || isBuying}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all relative overflow-hidden ${
                      canBuy && !isBuying
                        ? 'active:scale-95'
                        : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                    }`}
                    style={canBuy && !isBuying ? { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: '#ffffff' } : undefined}
                  >
                    {canBuy && !isBuying && <span className="absolute inset-0 animate-shimmer pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />}
                    {isBuying
                      ? t('shop.sendingTransaction')
                      : canBuy
                        ? pack.nacklPrice > 0
                          ? `${t('shop.buy')} — ${pack.nacklPrice} NACKL`
                          : <span className="inline-flex items-center gap-1.5 justify-center"><Icon name="gift" size={15} /> Забрать бесплатно</span>
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

      {/* Pack contents modal */}
      {infoPackId && (() => {
        const pack = getPackById(infoPackId);
        if (!pack) return null;
        const rarities = Object.entries(pack.rarityWeights).filter(([r]) =>
          !pack.allowedRarities || pack.allowedRarities.includes(r as Rarity)
        ) as [Rarity, number][];
        const total = rarities.reduce((s, [, w]) => s + w, 0);
        const rarityOrder: Rarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
        const possibleCards = cards
          .filter((c) => rarities.some(([r]) => r === c.rarity))
          .sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity) || a.id - b.id);
        const grouped = rarityOrder
          .map((r) => ({ rarity: r, list: possibleCards.filter((c) => c.rarity === r) }))
          .filter((g) => g.list.length > 0);

        return (
          <div className="absolute inset-0 z-40 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.65)' }}>
            <div className="w-full max-w-md max-h-[85%] flex flex-col rounded-t-3xl border border-white/[0.08] p-4 pb-6 animate-slide-up" style={{ background: '#0b0b12' }}>
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="text-base font-black text-white flex items-center gap-2">
                  <Icon name="info" size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  {getPackName(lang, pack.id)} — {t('shop.packInfo')}
                </div>
                <button onClick={() => { selectionChanged(); setInfoPackId(null); }} className="p-1.5 rounded-lg bg-white/[0.05] active:scale-90 transition-all">
                  <Icon name="close" size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
                {/* Drop rates with bars */}
                <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5">{t('shop.dropRates')}</div>
                <div className="space-y-1.5 mb-3">
                  {rarities.map(([rarity, weight]) => {
                    const style = rarityStyles[rarity];
                    const pct = (weight / total) * 100;
                    return (
                      <div key={rarity} className="flex items-center gap-2">
                        <span className={`w-20 shrink-0 text-[10px] font-bold ${style.text}`}>{getRarityLabel(lang, rarity)}</span>
                        <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                          <div className={`h-full rounded-full ${style.gradient}`} style={{ width: `${Math.max(2, pct)}%` }} />
                        </div>
                        <span className="w-12 shrink-0 text-right text-[10px] text-white/50">{pct < 1 ? pct.toFixed(1) : Math.round(pct)}%</span>
                      </div>
                    );
                  })}
                </div>

                {/* Pity note */}
                {pack.pity && (
                  <div className="mb-3 px-3 py-2 rounded-xl border border-yellow-400/20" style={{ background: 'rgba(255,215,0,0.05)' }}>
                    <div className="text-[10px] font-bold text-yellow-300/90">
                      {t('shop.pityGuarantee').replace('{rarity}', getRarityLabel(lang, pack.pity.rarity)).replace('{max}', String(pack.pity.max))}
                    </div>
                  </div>
                )}

                {/* Possible cards */}
                <div className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5">{t('shop.possibleCards')}</div>
                <div className="space-y-2.5">
                  {grouped.map((g) => {
                    const style = rarityStyles[g.rarity];
                    return (
                      <div key={g.rarity}>
                        <div className={`text-[9px] font-black uppercase tracking-wider mb-1 ${style.text}`}>
                          {getRarityLabel(lang, g.rarity)} · {g.list.length}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {g.list.map((card) => (
                            <div key={card.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]" title={`${card.name} · ${card.power + (card.stars ?? 0)}⚔ ${card.damage + (card.stars ?? 0)}💥`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${style.bg}`} />
                              <span className="text-[10px] font-bold text-white/85">{card.name}</span>
                              <span className="text-[9px] text-white/35">{card.power + (card.stars ?? 0)}/{card.damage + (card.stars ?? 0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
