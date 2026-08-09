import { useState, useEffect, useRef, useCallback } from 'react';
import type { WalletConnection } from '../services/beeEngine';
import {
  requestMiningKeys,
  waitForMiningKeysPropagation,
  getStoredMiningKeys,
  storeMiningKeys,
  ENDPOINTS,
  APP_ID,
} from '../services/beeEngine';
import { useHaptic } from '../hooks/useHaptic';
import { useI18n } from '../i18n';
import Icon from './Icon';

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
  const { impactOccurred } = useHaptic();
  const { t } = useI18n();
  const [miningKeys, setMiningKeys] = useState(() =>
    getStoredMiningKeys(connection.profileAddress)
  );
  const [minerAddress, setMinerAddress] = useState<string | null>(miningKeys?.minerAddress ?? null);
  const [keysPropagated, setKeysPropagated] = useState(miningKeys?.areKeysPropagated ?? false);

  const [isRequestingKeys, setIsRequestingKeys] = useState(false);
  const [isWaitingPropagation, setIsWaitingPropagation] = useState(false);
  const [waitElapsed, setWaitElapsed] = useState(0);
  const [isInitMiner, setIsInitMiner] = useState(false);
  const [minerReady, setMinerReady] = useState(false);
  const [minerState, setMinerState] = useState<MinerState>({ running: false, canStart: false, debug: null });
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(
    miningKeys?.areKeysPropagated ? t('mining.keysPropagated') : null
  );

  const workerRef = useRef<Worker | null>(null);
  const propTokenRef = useRef(0);
  const waitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgIdRef = useRef(0);
  const pendingRef = useRef<Record<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>>({});

  // ─── Worker lifecycle ─────────────────────────────────
  const createWorker = useCallback(() => {
    const w = new Worker(
      new URL('../services/minerWorker.ts', import.meta.url),
      { type: 'module' },
    );
    w.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (!msg) return;
      if (msg.reqId != null && pendingRef.current[msg.reqId]) {
        const p = pendingRef.current[msg.reqId];
        delete pendingRef.current[msg.reqId];
        if (msg.type === 'error') p.reject(new Error(msg.message));
        else p.resolve(msg);
        return;
      }
      switch (msg.type) {
        case 'ready':
          setMinerReady(true);
          break;
        case 'status':
          setMinerState((s) => ({ ...s, running: msg.running, canStart: msg.canStart }));
          break;
        case 'data':
          setMinerState((s) => ({
            ...s,
            debug: {
              tapSum: msg.tapSum,
              tapSum5m: msg.tapSum5m,
              updatedAt: new Date().toLocaleTimeString(),
            },
          }));
          break;
        case 'event':
          try {
            const payload = JSON.parse(msg.message);
            if (payload.error) {
              setMinerState((s) => ({ ...s, running: false }));
              setError(`${payload.action ?? 'miner'}: ${payload.error}`);
            }
          } catch { /* non-json */ }
          break;
        case 'error':
          setError(msg.message);
          break;
      }
    };
    w.onerror = (e) => {
      setError(e.message || 'Worker error');
      setMinerState((s) => ({ ...s, running: false }));
    };
    workerRef.current = w;
    return w;
  }, []);

  const send = useCallback(<T,>(type: string, payload?: Record<string, unknown>): Promise<T> => {
    const w = workerRef.current;
    if (!w) return Promise.reject(new Error('Worker not ready'));
    return new Promise<T>((resolve, reject) => {
      const reqId = ++msgIdRef.current;
      pendingRef.current[reqId] = { resolve: resolve as (v: unknown) => void, reject };
      w.postMessage({ type, reqId, ...(payload || {}) });
    });
  }, []);

  // Initialize worker on mount, dispose on unmount
  useEffect(() => {
    const w = createWorker();
    return () => {
      try { w.postMessage({ type: 'dispose' }); } catch { /* ignore */ }
      w.terminate();
      workerRef.current = null;
    };
  }, [createWorker]);

  // Start data polling once miner is ready
  useEffect(() => {
    if (!minerReady) return;
    const poll = async () => {
      try { await send('data'); } catch { /* worker busy */ }
    };
    poll();
    dataTimerRef.current = setInterval(poll, 5000);
    return () => {
      if (dataTimerRef.current) clearInterval(dataTimerRef.current);
      dataTimerRef.current = null;
    };
  }, [minerReady, send]);

  // Elapsed-time counter while waiting for propagation
  useEffect(() => {
    if (!isWaitingPropagation) { setWaitElapsed(0); return; }
    setWaitElapsed(0);
    waitTimerRef.current = setInterval(() => setWaitElapsed((s) => s + 1), 1000);
    return () => {
      if (waitTimerRef.current) clearInterval(waitTimerRef.current);
      waitTimerRef.current = null;
    };
  }, [isWaitingPropagation]);

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
      setMinerReady(false);
      try { workerRef.current?.postMessage({ type: 'dispose' }); } catch { /* ignore */ }

      // Step 1: generate + request keys (fast)
      const keys = await requestMiningKeys(connection);
      setMiningKeys({ ...keys, minerAddress: null, areKeysPropagated: false });

      // Step 2: wait for blockchain propagation (can take minutes)
      setIsRequestingKeys(false);
      setStatus(t('mining.keysSent'));
      const token = ++propTokenRef.current;
      setIsWaitingPropagation(true);

      const addr = await waitForMiningKeysPropagation(connection.walletName, keys.ownerPublic);
      if (token !== propTokenRef.current) return;

      setMinerAddress(addr);
      setKeysPropagated(true);
      setMiningKeys((prev) => prev ? { ...prev, minerAddress: addr, areKeysPropagated: true } : null);
      setStatus(t('mining.keysPropagated'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    } finally {
      setIsRequestingKeys(false);
      setIsWaitingPropagation(false);
    }
  };

  const handleCancelWait = () => {
    propTokenRef.current++;
    setIsRequestingKeys(false);
    setIsWaitingPropagation(false);
    setStatus(null);
    setError(t('mining.cancelled'));
  };

  const handleInitMiner = async () => {
    if (!miningKeys?.ownerPublic || !miningKeys.ownerSecret || !minerAddress) return;
    try {
      setIsInitMiner(true);
      setError(null);
      setMinerReady(false);
      const w = workerRef.current;
      if (!w) return;
      w.postMessage({
        type: 'init',
        minerAddress,
        ownerPublic: miningKeys.ownerPublic,
        ownerSecret: miningKeys.ownerSecret,
        appId: APP_ID,
        endpoints: ENDPOINTS,
      });
      setStatus(t('mining.initMiner'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsInitMiner(false);
    }
  };

  const handleStart = () => {
    try {
      setError(null);
      setMinerState((s) => ({ ...s, running: true, canStart: false }));
      workerRef.current?.postMessage({ type: 'start', durationMs: 15000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleStop = () => {
    workerRef.current?.postMessage({ type: 'stop' });
  };

  const handleAddTap = () => {
    try { workerRef.current?.postMessage({ type: 'tap', x: 1, y: 1 }); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const handleGetReward = async () => {
    try {
      await send('reward');
      setStatus(t('mining.reward'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto p-4">
      <div className="text-lg font-bold text-white">{t('mining.title').replace(/^[^\p{L}\p{N}]+/u, '').trim()}</div>

      {/* Mining keys status — caption, not a button */}
      <div className="w-full px-1 text-xs">
        <div className="flex justify-center items-center gap-1.5 text-white/50">
          <span>{t('mining.miningKeys')}</span>
          <span className={keysPropagated ? 'text-neon-green' : 'text-yellow-400'}>
            {keysPropagated ? t('mining.ready') : miningKeys ? t('mining.waitingStatus') : t('mining.notConfigured')}
          </span>
        </div>
        {miningKeys?.ownerPublic && (
          <div className="text-[10px] text-white/30 font-mono truncate text-center mt-1">
            pub: {miningKeys.ownerPublic}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 w-full">
        {!keysPropagated && !isWaitingPropagation && (
          <button
            onClick={handleRequestKeys}
            disabled={isRequestingKeys}
            className="w-full py-3 rounded-lg font-bold text-sm
              bg-gradient-to-r from-neon-green to-emerald-500 text-white
              shadow-[0_0_16px_rgba(0,255,159,0.3)]
              active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isRequestingKeys && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />}
            {isRequestingKeys ? t('mining.requestingKeys') : t('mining.setupKeys')}
          </button>
        )}

        {isWaitingPropagation && (
          <div className="w-full rounded-xl p-4 text-center" style={{
            background: 'rgba(0,212,255,0.04)',
            border: '1px solid rgba(0,212,255,0.15)',
          }}>
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="w-5 h-5 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin-slow" />
              <span className="text-sm font-bold" style={{ color: '#00d4ff' }}>{t('mining.waitingBlockchain')}</span>
            </div>
            <div className="px-3 py-2 rounded-lg text-[11px] font-bold text-yellow-400" style={{ background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.2)' }}>
              {t('mining.confirmInWallet')}
            </div>
            <div className="text-[10px] text-white/40 mt-1.5">
              {t('mining.waitElapsed')}: {Math.floor(waitElapsed / 60)}:{String(waitElapsed % 60).padStart(2, '0')}
            </div>
            <div className="text-[10px] text-white/30 mt-1">{t('mining.waitHint')}</div>
            <button
              onClick={handleCancelWait}
              className="mt-3 px-4 py-1.5 rounded-lg text-[11px] font-bold
                bg-white/5 border border-white/10 text-white/50
                active:scale-95 transition-all"
            >
              {t('mining.cancel')}
            </button>
          </div>
        )}

        {keysPropagated && !minerReady && (
          <button
            onClick={handleInitMiner}
            disabled={isInitMiner}
            className="w-full py-3 rounded-lg font-bold text-sm
              bg-gradient-to-r from-neon-blue to-neon-purple text-white
              shadow-[0_0_16px_rgba(0,212,255,0.3)]
              active:scale-95 transition-all disabled:opacity-50"
          >
            {isInitMiner ? t('mining.initing') : t('mining.startMiner')}
          </button>
        )}

        {minerReady && (
          <div className="flex gap-2">
            <button
              onClick={() => { impactOccurred('medium'); minerState.running ? handleStop() : handleStart(); }}
              className={`flex-1 py-3 rounded-lg font-bold text-sm active:scale-95 transition-all ${
                minerState.running
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-gradient-to-r from-neon-green to-emerald-500 text-white shadow-[0_0_12px_rgba(0,255,159,0.3)]'
              }`}
            >
              {t(minerState.running ? 'mining.stop' : 'mining.start')}
            </button>
            <button
              onClick={() => { impactOccurred('light'); handleAddTap(); }}
              disabled={!minerState.running}
              className="flex-1 py-3 rounded-lg font-bold text-sm
                bg-white/5 border border-white/10 text-white/60
                active:scale-95 transition-all disabled:opacity-30"
            >
              {t('mining.tap')}
            </button>
            <button
              onClick={handleGetReward}
              className="flex-1 py-3 rounded-lg font-bold text-sm
                bg-yellow-500/20 border border-yellow-500/30 text-yellow-400
                active:scale-95 transition-all"
            >
              <span className="inline-flex items-center gap-1.5 justify-center"><Icon name="gift" size={15} /> {t('mining.reward')}</span>
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
          <div>{t('mining.taps')}: {minerState.debug.tapSum} ({t('mining.taps5m')}: {minerState.debug.tapSum5m})</div>
          <div>{t('mining.updatedAt')}: {minerState.debug.updatedAt}</div>
        </div>
      )}

      <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-full py-2.5 rounded-lg font-bold text-sm bg-white/5 border border-white/10 text-white/60 active:bg-white/10 active:scale-[0.98] transition-all mt-2">
        {t('mining.back')}
      </button>
    </div>
  );
}
