import { useState, useEffect, useRef } from 'react';
import type { WalletConnection } from '../services/beeEngine';
import {
  requestMiningKeys,
  waitForMiningKeysPropagation,
  initMiner as sdkInitMiner,
  getStoredMiningKeys,
  storeMiningKeys,
} from '../services/beeEngine';

interface Props {
  connection: WalletConnection;
  onBack: () => void;
}

interface MinerState {
  running: boolean;
  canStart: boolean;
  debug: { tapSum: string; tapSum5m: string; updatedAt: string } | null;
}

export default function MiningPanel({ connection, onBack }: Props) {
  const [miningKeys, setMiningKeys] = useState(() =>
    getStoredMiningKeys(connection.profileAddress)
  );
  const [minerAddress, setMinerAddress] = useState<string | null>(miningKeys?.minerAddress ?? null);
  const [keysPropagated, setKeysPropagated] = useState(miningKeys?.areKeysPropagated ?? false);

  const [isRequestingKeys, setIsRequestingKeys] = useState(false);
  const [isWaitingPropagation, setIsWaitingPropagation] = useState(false);
  const [isInitMiner, setIsInitMiner] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [miner, setMiner] = useState<any>(null);
  const [minerState, setMinerState] = useState<MinerState>({ running: false, canStart: false, debug: null });
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(
    miningKeys?.areKeysPropagated ? 'Ключи восстановлены из кэша' : null
  );

  const minerRef = useRef<typeof miner>(null);
  const propTokenRef = useRef(0);

  useEffect(() => { minerRef.current = miner; }, [miner]);

  // Cleanup
  useEffect(() => {
    return () => {
      propTokenRef.current++;
      minerRef.current?.free?.();
    };
  }, []);

  // Poll miner state
  useEffect(() => {
    if (!miner) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const canStart = miner.can_start();
        if (!cancelled) setMinerState((s) => ({ ...s, canStart }));

        const data = await miner.get_miner_data();
        if (!cancelled) {
          setMinerState((s) => ({
            ...s,
            debug: {
              tapSum: data.tap_sum.toString(),
              tapSum5m: data.tap_sum_5m.toString(),
              updatedAt: new Date().toLocaleTimeString(),
            },
          }));
        }
        data.free();
      } catch { /* ignore */ }
    };

    poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [miner]);

  // Save keys to storage
  useEffect(() => {
    if (miningKeys?.ownerPublic && miningKeys.ownerSecret) {
      storeMiningKeys(connection.profileAddress, miningKeys);
    }
  }, [miningKeys, connection.profileAddress]);

  const handleRequestKeys = async () => {
    try {
      setIsRequestingKeys(true);
      setError(null);
      setStatus(null);
      setKeysPropagated(false);
      setMinerAddress(null);
      setMinerState({ running: false, canStart: false, debug: null });
      miner?.free?.();
      setMiner(null);

      const keys = await requestMiningKeys(connection);
      setMiningKeys({ ...keys, minerAddress: null, areKeysPropagated: false });
      setStatus('Ключи отправлены. Ожидание распространения в блокчейне...');

      const token = ++propTokenRef.current;
      setIsWaitingPropagation(true);

      const addr = await waitForMiningKeysPropagation(connection.walletName, keys.ownerPublic);
      if (token !== propTokenRef.current) return;

      setMinerAddress(addr);
      setKeysPropagated(true);
      setMiningKeys((prev) => prev ? { ...prev, minerAddress: addr, areKeysPropagated: true } : null);
      setStatus('Ключи распространены. Можно инициализировать майнер.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    } finally {
      setIsRequestingKeys(false);
      setIsWaitingPropagation(false);
    }
  };

  const handleInitMiner = async () => {
    if (!miningKeys?.ownerPublic || !miningKeys.ownerSecret || !minerAddress) return;
    try {
      setIsInitMiner(true);
      setError(null);
      miner?.free?.();
      const instance = await sdkInitMiner(minerAddress, miningKeys.ownerPublic, miningKeys.ownerSecret);
      setMiner(instance);
      setMinerState({ running: false, canStart: instance.can_start(), debug: null });
      setStatus('Майнер инициализирован.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsInitMiner(false);
    }
  };

  const handleStart = () => {
    if (!miner) return;
    try {
      setError(null);
      miner.start(15000, (msg: string) => {
        try {
          const payload = JSON.parse(msg);
          if (payload.error) {
            setMinerState((s) => ({ ...s, running: false }));
            setError(`${payload.action ?? 'miner'}: ${payload.error}`);
          }
          if (payload.action === 'status_updated' && payload.data?.status) {
            const s = payload.data.status;
            if (s === 'computing' || s === 'submitting') setMinerState((p) => ({ ...p, running: true }));
            if (s === 'finished' || s === 'removed') setMinerState((p) => ({ ...p, running: false }));
          }
        } catch { /* non-json */ }
      });
      setMinerState((s) => ({ ...s, running: true, canStart: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleStop = () => {
    if (!miner) return;
    miner.stop();
    setMinerState((s) => ({ ...s, running: false, canStart: miner.can_start() }));
  };

  const handleAddTap = () => {
    if (!miner) return;
    try { miner.add_tap(1, 1); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const handleGetReward = async () => {
    if (!miner) return;
    try { await miner.get_reward(); setStatus('Награда получена!'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto p-4">
      <div className="text-lg font-bold text-neon-green">⛏️ Майнинг</div>

      {/* Mining keys status */}
      <div className="w-full bg-white/5 rounded-lg p-3 text-xs">
        <div className="flex justify-between text-white/50 mb-1">
          <span>Ключи майнинга</span>
          <span className={keysPropagated ? 'text-neon-green' : 'text-yellow-400'}>
            {keysPropagated ? 'Готово' : miningKeys ? 'Ожидание' : 'Не настроены'}
          </span>
        </div>
        {miningKeys?.ownerPublic && (
          <div className="text-[10px] text-white/30 font-mono truncate">
            pub: {miningKeys.ownerPublic}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 w-full">
        {!keysPropagated && (
          <button
            onClick={handleRequestKeys}
            disabled={isRequestingKeys || isWaitingPropagation}
            className="w-full py-3 rounded-lg font-bold text-sm
              bg-gradient-to-r from-neon-green to-emerald-500 text-white
              shadow-[0_0_16px_rgba(0,255,159,0.3)]
              active:scale-95 transition-all disabled:opacity-50"
          >
            {isRequestingKeys ? 'Запрос ключей...' :
             isWaitingPropagation ? 'Ожидание блокчейна...' :
             '🔑 Настроить ключи майнинга'}
          </button>
        )}

        {keysPropagated && !miner && (
          <button
            onClick={handleInitMiner}
            disabled={isInitMiner}
            className="w-full py-3 rounded-lg font-bold text-sm
              bg-gradient-to-r from-neon-blue to-neon-purple text-white
              shadow-[0_0_16px_rgba(0,212,255,0.3)]
              active:scale-95 transition-all disabled:opacity-50"
          >
            {isInitMiner ? 'Инициализация...' : '⚙️ Запустить майнер'}
          </button>
        )}

        {miner && (
          <div className="flex gap-2">
            <button
              onClick={minerState.running ? handleStop : handleStart}
              className={`flex-1 py-3 rounded-lg font-bold text-sm active:scale-95 transition-all ${
                minerState.running
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-gradient-to-r from-neon-green to-emerald-500 text-white shadow-[0_0_12px_rgba(0,255,159,0.3)]'
              }`}
            >
              {minerState.running ? '⏹ Стоп' : '▶️ Старт'}
            </button>
            <button
              onClick={handleAddTap}
              disabled={!minerState.running}
              className="flex-1 py-3 rounded-lg font-bold text-sm
                bg-white/5 border border-white/10 text-white/60
                active:scale-95 transition-all disabled:opacity-30"
            >
              👆 Тапнуть
            </button>
            <button
              onClick={handleGetReward}
              className="flex-1 py-3 rounded-lg font-bold text-sm
                bg-yellow-500/20 border border-yellow-500/30 text-yellow-400
                active:scale-95 transition-all"
            >
              🎁 Награда
            </button>
          </div>
        )}
      </div>

      {/* Status */}
      {status && <div className="text-xs text-white/50 text-center">{status}</div>}
      {error && <div className="text-xs text-red-400 text-center">{error}</div>}

      {/* Miner debug */}
      {minerState.debug && (
        <div className="w-full bg-white/5 rounded-lg p-2 text-[10px] text-white/40 font-mono">
          <div>Тапов: {minerState.debug.tapSum} (5м: {minerState.debug.tapSum5m})</div>
          <div>Обновлено: {minerState.debug.updatedAt}</div>
        </div>
      )}

      <button onClick={onBack} className="text-xs text-white/30 hover:text-white/50 transition-colors mt-2">
        Назад
      </button>
    </div>
  );
}
