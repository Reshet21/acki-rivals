/**
 * ExchangeScreen.tsx — обмен NACKL → ACKR через казначейство.
 *
 * Игрок вводит сумму NACKL, платит на казначейский мультисиг M
 * (AN Wallet, EPK-подпись), сервер /api/treasury/buy валидирует
 * платёж в блокчейне и выдаёт ACKR двухфазным TIP-3 переводом.
 */
import { useState, useEffect, useCallback } from 'react';
import type { WalletConnection } from '../services/beeEngine';
import { useHaptic } from '../hooks/useHaptic';
import { useI18n } from '../i18n';
import {
  payNacklToTreasury,
  requestAckr,
  getTreasurySignerKeys,
  getTreasuryStatus,
  TREASURY_ADDRESS,
} from '../services/treasuryService';

interface Props {
  walletConnection: WalletConnection | null;
  nacklBalance: string | null;
  onReconnectWallet?: () => void;
  onZkLogin?: (provider: 'google' | 'telegram') => void;
  hasEpkKey?: boolean;
  onBack: () => void;
}

interface OrderRow {
  id?: string;
  status?: string;
  nackl_amount?: number;
  ackr_amount?: number;
  created_at?: string;
}

type ExState =
  | { kind: 'idle' }
  | { kind: 'working'; msg: string }
  | { kind: 'ok'; msg: string }
  | { kind: 'error'; msg: string; needsLogin?: boolean };

const IS_DEV_PAYMENT = import.meta.env.VITE_PAYMENT_MODE !== 'live';

const PRESETS = [10, 50, 100, 500, 1000];

export default function ExchangeScreen({
  walletConnection,
  nacklBalance,
  onReconnectWallet,
  onZkLogin,
  hasEpkKey,
  onBack,
}: Props) {
  const { t } = useI18n();
  const { impactOccurred, selectionChanged, notificationOccurred } = useHaptic();

  const [amount, setAmount] = useState(50);
  const [rate, setRate] = useState(1);
  const [minNackl, setMinNackl] = useState(1);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [state, setState] = useState<ExState>({ kind: 'idle' });

  const balanceNum = parseFloat(nacklBalance || '0');
  const ackrOut = amount * rate;

  const loadStatus = useCallback(async () => {
    const player = walletConnection?.walletAddress;
    const s = await getTreasuryStatus(player || '');
    if (s.ackrPerNackl > 0) setRate(s.ackrPerNackl);
    if (s.minNackl > 0) setMinNackl(s.minNackl);
    if (Array.isArray(s.orders) && s.orders.length > 0) {
      setOrders(s.orders.slice(0, 10) as OrderRow[]);
    }
  }, [walletConnection]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleExchange = async () => {
    if (!walletConnection) {
      setState({ kind: 'error', msg: t('shop.connectWalletError') || 'Подключи кошелёк' });
      return;
    }
    if (amount < minNackl) {
      setState({ kind: 'error', msg: `Минимум для обмена — ${minNackl} NACKL` });
      return;
    }
    if (balanceNum < amount) {
      setState({ kind: 'error', msg: t('shop.notEnoughNackl') || 'Недостаточно NACKL' });
      return;
    }

    const signerKeys = getTreasurySignerKeys();
    if (!signerKeys) {
      setState({ kind: 'error', msg: '🔑 Нужен вход (Google/Telegram) для подписи платежа', needsLogin: true });
      return;
    }

    impactOccurred('medium');
    setState({ kind: 'working', msg: `Платим ${amount} NACKL на казначейство...` });

    try {
      const txHash = await payNacklToTreasury(walletConnection, signerKeys, amount);
      setState({ kind: 'working', msg: `Оплачено ${amount} NACKL (tx ${txHash.slice(0, 10)}…). Подтверждаем платёж...` });

      const result = await requestAckr(walletConnection.walletAddress, amount);
      if (result.success) {
        setState({ kind: 'ok', msg: `✅ Получено ${result.ackrAmount ?? ackrOut} ACKR на TIP-3 кошелёк!` });
        notificationOccurred('success');
      } else {
        setState({ kind: 'error', msg: `Платёж отправлен, но выдача ACKR: ${result.error || 'ошибка'}. Повторите позже — деньги вернутся в порядке очереди.` });
        notificationOccurred('error');
      }
      loadStatus();
    } catch (e) {
      setState({ kind: 'error', msg: `Ошибка обмена: ${e instanceof Error ? e.message : 'неизвестная'}` });
      notificationOccurred('error');
    }
  };

  const canExchange = !IS_DEV_PAYMENT && !!walletConnection && hasEpkKey && amount >= minNackl && balanceNum >= amount && state.kind !== 'working';

  return (
    <div className="flex flex-col h-full w-full max-w-lg mx-auto overflow-hidden bg-battle relative">
      {/* Background aurora */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-72 h-72 rounded-full bg-emerald-500/[0.04] animate-aurora-1" style={{ top: '-10%', left: '-20%' }} />
        <div className="absolute w-56 h-56 rounded-full bg-an-gold/[0.04] animate-aurora-2" style={{ bottom: '-10%', right: '-15%' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => { impactOccurred('soft'); onBack(); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(255,255,255,0.05)' }}>
            ←
          </button>
          <h1 className="text-lg font-bold text-an-gold">💱 Обменник</h1>
          <div className="px-3 py-1.5 rounded-full text-xs font-bold text-emerald-300" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
            {nacklBalance || '0'} NACKL
          </div>
        </div>
      </div>

      {/* Scroll content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 relative z-10 space-y-3">

        {/* ═══ Rate hero card ═══ */}
        <div className="rounded-2xl overflow-hidden animate-slide-up" style={{ boxShadow: '0 8px 40px rgba(16,185,129,0.15)' }}>
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-5 relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute w-32 h-32 rounded-full bg-white/10 -top-10 -right-10" />
              <div className="absolute w-20 h-20 rounded-full bg-white/10 -bottom-6 -left-4" />
            </div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="flex flex-col items-center">
                <div className="text-3xl">🪙</div>
                <div className="text-[9px] text-white/70 mt-0.5">NACKL</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-[10px] text-white/70 uppercase tracking-widest">Курс казначейства</div>
                <div className="text-2xl font-black text-white my-0.5">
                  1 <span className="text-sm font-bold opacity-80">NACKL</span> = {rate} <span className="text-sm font-bold opacity-80">ACKR</span>
                </div>
                <div className="text-[9px] text-white/60">TIP-3 · выдаётся сервером после подтверждения платежа</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-3xl">🟢</div>
                <div className="text-[9px] text-white/70 mt-0.5">ACKR</div>
              </div>
            </div>
          </div>
          <div className="px-4 py-2.5 flex items-center justify-between text-[10px]" style={{ background: 'rgba(5,5,8,0.85)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-white/40">Казначейство</span>
            <span className="text-white/60 font-mono truncate ml-2">{TREASURY_ADDRESS}</span>
          </div>
        </div>

        {/* ═══ Amount card ═══ */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3 animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/40 uppercase tracking-wider">Сумма обмена</div>
            <div className="text-[10px] text-white/30">мин. {minNackl} NACKL</div>
          </div>

          {/* Amount input */}
          <div className="flex items-center gap-2 rounded-xl px-3.5 py-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              type="number"
              min={minNackl}
              step="1"
              value={amount}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setAmount(isNaN(v) || v < 0 ? 0 : v);
                selectionChanged();
              }}
              className="flex-1 bg-transparent text-xl font-black text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0"
            />
            <span className="text-sm font-bold text-neon-blue">NACKL</span>
          </div>

          {/* Slider */}
          <input
            type="range"
            min={minNackl}
            max={Math.max(minNackl * 10, balanceNum || 1000)}
            step="1"
            value={Math.min(amount, Math.max(minNackl * 10, balanceNum || 1000))}
            onChange={(e) => { setAmount(parseInt(e.target.value, 10)); selectionChanged(); }}
            className="w-full accent-emerald-500 h-1.5"
            disabled={IS_DEV_PAYMENT}
          />

          {/* Presets */}
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map((p) => (
              <button key={p}
                onClick={() => { setAmount(p); selectionChanged(); }}
                disabled={IS_DEV_PAYMENT}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-90 ${
                  amount === p
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                }`}>
                {p}
              </button>
            ))}
            {balanceNum > 0 && (
              <button
                onClick={() => { setAmount(Math.floor(balanceNum)); selectionChanged(); }}
                disabled={IS_DEV_PAYMENT}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-90 ${
                  amount === Math.floor(balanceNum)
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                }`}>
                MAX
              </button>
            )}
          </div>

          {/* Result */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <span className="text-xs text-white/50">Вы получите</span>
            <span className="text-lg font-black text-emerald-300">{ackrOut.toLocaleString()} ACKR</span>
          </div>
        </div>

        {/* ═══ Exchange button / status ═══ */}
        <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {IS_DEV_PAYMENT ? (
            <div className="rounded-xl px-3 py-3 text-[11px] text-center" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)', color: 'rgba(255,215,0,0.8)' }}>
              ⚡ DEV MODE: обмен включится после переключения VITE_PAYMENT_MODE=live
            </div>
          ) : !walletConnection ? (
            <button
              onClick={() => { impactOccurred('medium'); onReconnectWallet?.(); }}
              className="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-neon-blue to-neon-purple text-white active:scale-95 transition-all shadow-[0_0_20px_rgba(0,212,255,0.25)]">
              👛 Подключить кошелёк
            </button>
          ) : !hasEpkKey ? (
            <div className="space-y-2">
              <button
                onClick={() => { impactOccurred('medium'); onZkLogin?.('google'); }}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-500 to-blue-700 text-white active:scale-95 transition-all">
                🔑 Войти через Google (zkLogin)
              </button>
              <button
                onClick={() => { impactOccurred('medium'); onZkLogin?.('telegram'); }}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-to-r from-sky-500 to-cyan-600 text-white active:scale-95 transition-all">
                ✈️ Войти через Telegram (zkLogin)
              </button>
            </div>
          ) : (
            <button
              onClick={handleExchange}
              disabled={!canExchange}
              className={`w-full py-4 rounded-xl text-base font-black transition-all relative overflow-hidden ${
                canExchange
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white active:scale-95 shadow-[0_0_24px_rgba(16,185,129,0.35)]'
                  : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
              }`}>
              {canExchange && <span className="absolute inset-0 animate-shimmer pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />}
              {state.kind === 'working' ? '⏳ Обмен...' : `💱 Обменять ${amount} NACKL → ${ackrOut} ACKR`}
            </button>
          )}

          {state.kind !== 'idle' && state.kind !== 'working' && (
            <div className={`px-3 py-2.5 rounded-xl text-[11px] text-center animate-fade-in ${
              state.kind === 'ok'
                ? 'text-emerald-300'
                : 'text-yellow-400'
            }`} style={{ background: state.kind === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(255,180,0,0.08)', border: `1px solid ${state.kind === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(255,180,0,0.2)'}` }}>
              {state.msg}
            </div>
          )}
          {state.kind === 'working' && (
            <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[11px] text-center text-white/60" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
              {state.msg}
            </div>
          )}
        </div>

        {/* ═══ History ═══ */}
        {orders.length > 0 && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <div className="px-4 py-2.5 text-xs text-white/40 uppercase tracking-wider border-b border-white/[0.05]">
              🧾 История обменов
            </div>
            {orders.map((o, i) => (
              <div key={o.id ?? i} className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.03] last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${o.status === 'done' ? 'text-emerald-300' : o.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {o.status === 'done' ? '✅' : o.status === 'failed' ? '❌' : '⏳'}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-white/80">
                      {Number(o.nackl_amount ?? 0).toLocaleString()} NACKL → {Number(o.ackr_amount ?? 0).toLocaleString()} ACKR
                    </div>
                    <div className="text-[9px] text-white/30">{o.status}</div>
                  </div>
                </div>
                <div className="text-[9px] text-white/30">
                  {o.created_at ? new Date(o.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="text-[10px] text-white/25 leading-relaxed px-1 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          Обмен проходит через казначейство: платёж NACKL уходит на мультисиг казначейства, сервер проверяет его в блокчейне и отправляет ACKR на ваш TIP-3 кошелёк. ACKR — токен игры Acki Rivals (root{' '}
          <span className="font-mono">{import.meta.env.VITE_TREASURY_ROOT_ADDR || '0:09c28a5d…'}</span>).
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 px-4 py-3 relative z-10 border-t border-white/[0.03]" style={{ background: 'rgba(5,5,8,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <button onClick={() => { impactOccurred('soft'); onBack(); }}
          className="w-full py-2.5 rounded-xl font-bold text-sm bg-white/5 border border-white/10 text-white/60 active:bg-white/10 active:scale-[0.98] transition-all hover:bg-white/[0.08]">
          {t('deck.back') || 'Назад'}
        </button>
      </div>
    </div>
  );
}
