import { useState, useEffect, useRef } from 'react';
import type { WalletConnection } from '../services/beeEngine';
import {
  createSession,
  waitWalletHello,
  disconnectSession,
  getNacklBalance,
} from '../services/beeEngine';

interface Props {
  onConnected: (conn: WalletConnection) => void;
  onBack: () => void;
}

export default function WalletPanel({ onConnected, onBack }: Props) {
  const [connection, setConnection] = useState<WalletConnection | null>(null);
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
        <div className="text-center">
          <div className="text-lg font-bold text-neon-green">✅ Кошелек подключен</div>
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
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="w-full py-3 rounded-lg font-bold text-sm
            bg-white/5 border border-white/10 text-white/60
            hover:bg-white/10 active:scale-95 transition-all"
        >
          {isDisconnecting ? 'Отключение...' : '🔌 Отключить'}
        </button>

        <button onClick={onBack} className="text-xs text-white/30 hover:text-white/50 transition-colors">
          Назад
        </button>
      </div>
    );
  }

  // QR / deeplink state
  if (deepLink) {
    return (
      <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto p-4">
        <div className="text-center">
          <div className="text-lg font-bold text-white/70">Сканируйте QR</div>
          <div className="text-xs text-white/40 mt-1">в приложении AN Wallet</div>
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
          Открыть кошелек
        </a>

        <div className="text-xs text-white/40">
          {isWaiting ? 'Ожидание подтверждения...' : 'Сессия создана'}
        </div>

        <button
          onClick={cancelWaiting}
          className="text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          Отмена
        </button>

        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>
    );
  }

  // Initial connect state
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto p-4">
      <div className="text-lg font-bold text-white/70">Подключить кошелек</div>
      <div className="text-xs text-white/40 text-center">
        Подключите AN Wallet для участия в боях и майнинга
      </div>

      <button
        onClick={handleConnect}
        disabled={isCreating}
        className="w-full py-3 rounded-lg font-bold text-sm
          bg-gradient-to-r from-neon-blue to-neon-purple text-white
          shadow-[0_0_20px_rgba(0,212,255,0.3)]
          hover:opacity-90 active:scale-95 transition-all
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isCreating ? 'Создание сессии...' : '🔗 Подключить AN Wallet'}
      </button>

      {error && <div className="text-xs text-red-400 text-center">{error}</div>}

      <button onClick={onBack} className="text-xs text-white/30 hover:text-white/50 transition-colors">
        Назад
      </button>
    </div>
  );
}
