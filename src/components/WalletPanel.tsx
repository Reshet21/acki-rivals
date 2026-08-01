import { useState, useEffect, useRef } from 'react';
import type { WalletConnection } from '../services/beeEngine';
import {
  createSession,
  waitWalletHello,
  disconnectSession,
  getNacklBalance,
} from '../services/beeEngine';
import { useHaptic } from '../hooks/useHaptic';
import { useI18n } from '../i18n';

interface Props {
  connection: WalletConnection | null;
  onConnected: (conn: WalletConnection) => void;
  onDisconnect: () => void;
  onBack: () => void;
}

export default function WalletPanel({ connection: initialConnection, onConnected, onDisconnect, onBack }: Props) {
  const { impactOccurred } = useHaptic();
  const { t } = useI18n();
  const [connection, setConnection] = useState<WalletConnection | null>(() => initialConnection);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const sessionRef = useRef<{ sessionId: string; description: string; clientDhSecret: string; createdAt: number } | null>(null);
  const waitTokenRef = useRef(0);

  // Poll balance when connected
  useEffect(() => {
    if (!connection) { setBalance(null); return; }

    let cancelled = false;
    const poll = async () => {
      try {
        const b = await getNacklBalance(connection.walletAddress);
        if (!cancelled) setBalance(b);
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [connection]);

  const handleConnect = async () => {
    try {
      setIsCreating(true);
      setError(null);
      setDeepLink(null);

      const session = await createSession();
      sessionRef.current = session;
      setDeepLink(session.deepLink);

      const token = ++waitTokenRef.current;
      setIsWaiting(true);

      const conn = await waitWalletHello(
        session.sessionId,
        session.description,
        session.clientDhSecret,
        session.createdAt,
      );

      if (token !== waitTokenRef.current) return;
      setConnection(conn);
      onConnected(conn);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsCreating(false);
      setIsWaiting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    try {
      setIsDisconnecting(true);
      await disconnectSession(connection);
      setConnection(null);
      setDeepLink(null);
      setBalance(null);
      onDisconnect();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsDisconnecting(false);
    }
  };

  const cancelWaiting = () => {
    waitTokenRef.current++;
    setIsWaiting(false);
    setDeepLink(null);
    setError(null);
  };

  // Connected state
  if (connection) {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto p-4">
        <div className="text-center rounded-2xl p-6 w-full" style={{
          background: 'linear-gradient(135deg, rgba(74,222,128,0.08) 0%, rgba(0,230,118,0.04) 100%)',
          border: '1px solid rgba(74,222,128,0.2)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(74,222,128,0.1)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}>
          <div className="text-lg font-bold text-neon-green">✅ {t('wallet.connected')}</div>
          <div className="text-sm text-white/60 mt-1">{connection.walletName}</div>
          <div className="text-xs text-white/40 font-mono mt-0.5 truncate">
            {connection.walletAddress}
          </div>
          {balance !== null && (
            <div className="text-sm text-neon-blue mt-2">
              NACKL: <span className="font-mono font-bold">{balance}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => { impactOccurred('light'); handleDisconnect(); }}
          disabled={isDisconnecting}
          className="w-full py-3 rounded-lg font-bold text-sm
            bg-white/5 border border-white/10 text-white/60
            hover:bg-white/10 active:scale-95 transition-all"
        >
          {isDisconnecting ? t('wallet.disconnecting') : `🔌 ${t('wallet.disconnect')}`}
        </button>

        <button onClick={() => { impactOccurred('soft'); onBack(); }} className="text-xs text-white/30 hover:text-white/50 transition-colors">
          {t('wallet.back')}
        </button>
      </div>
    );
  }

  // QR / deeplink state
  if (deepLink) {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto p-4">
        <div className="text-center">
          <div className="text-lg font-bold text-white/70">{t('wallet.scanQR')}</div>
          <div className="text-xs text-white/40 mt-1">{t('wallet.openApp')}</div>
        </div>

        <div
          className="w-full max-w-xs bg-white/10 rounded-xl p-3 break-all text-xs font-mono text-white/70 border border-white/10"
        >
          {deepLink}
        </div>

        <a
          href={deepLink}
          target="_blank"
          rel="noreferrer"
          className="text-neon-blue text-sm underline"
        >
          {t('wallet.openWallet')}
        </a>

        {isWaiting && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs text-white/40">{t('wallet.waitForConfirmation')}</div>
            <div className="text-xs text-yellow-400/80 text-center max-w-xs">
              1. Откройте ссылку в AN Wallet{'\n'}
              2. Нажмите "Подключить" в кошельке{'\n'}
              3. Подождите подтверждения (до 3 мин)
            </div>
            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-neon-blue/50 rounded-full animate-pulse" />
            </div>
          </div>
        )}

        <button
          onClick={cancelWaiting}
          className="text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          {t('wallet.cancel')}
        </button>

        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>
    );
  }

  // Initial connect state
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto p-4">
      <div className="text-lg font-bold text-white/70">{t('wallet.connectWallet')}</div>
      <div className="text-xs text-white/40 text-center">
        {t('wallet.connectDescription')}
      </div>

      <button
        onClick={() => { impactOccurred('medium'); handleConnect(); }}
        disabled={isCreating}
        className="w-full py-3 rounded-lg font-bold text-sm
          bg-gradient-to-r from-neon-blue to-neon-purple text-white
          shadow-[0_0_20px_rgba(0,212,255,0.3)]
          hover:opacity-90 active:scale-95 transition-all
          disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
      >
        <span className="absolute inset-0 animate-shimmer pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)', backgroundSize: '200% 100%' }} />
        {isCreating ? t('wallet.creatingSession') : t('wallet.connectAnWallet')}
      </button>

      {error && <div className="text-xs text-red-400 text-center">{error}</div>}

      <button onClick={() => { impactOccurred('soft'); onBack(); }} className="text-xs text-white/30 hover:text-white/50 transition-colors">
        {t('wallet.back')}
      </button>
    </div>
  );
}
