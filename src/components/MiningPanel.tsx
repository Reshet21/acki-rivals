import { useState, useEffect } from 'react';
import type { WalletConnection } from '../services/beeEngine';
import {
  requestMiningKeys,
  waitForMiningKeysPropagation,
  getStoredMiningKeys,
  storeMiningKeys,
} from '../services/beeEngine';
import {
  subscribe,
  initMining,
  startMining,
  stopMining,
  addTap,
  getReward,
  getState,
} from '../services/miningService';
import { useHaptic } from '../hooks/useHaptic';
import { useI18n } from '../i18n';
import Icon from './Icon';

interface Props {
  connection: WalletConnection;
  onBack: () => void;
}

export default function MiningPanel({ connection, onBack }: Props) {
  const { impactOccurred } = useHaptic();
  const { t } = useI18n();
  const [miningKeys, setMiningKeys] = useState(() =>
    getStoredMiningKeys(connection.profileAddress)
  );
  const [keysPropagated, setKeysPropagated] = useState(miningKeys?.areKeysPropagated ?? false);

  const [isRequestingKeys, setIsRequestingKeys] = useState(false);
  const [isWaitingPropagation, setIsWaitingPropagation] = useState(false);
  const [waitElapsed, setWaitElapsed] = useState(0);
  const [minerReady, setMinerReady] = useState(() => getState().ready);
  const [minerRunning, setMinerRunning] = useState(() => getState().running);
  const [tapData, setTapData] = useState(() => getState().tapSum);
  const [tapData5m, setTapData5m] = useState(() => getState().tapSum5m);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(
    miningKeys?.areKeysPropagated ? t('mining.keysPropagated') : null
  );

  const propTokenRef = { current: 0 };
  const waitTimerRef = { current: null as ReturnType<typeof setInterval> | null };

  // Подписка на глобальный майнинг-сервис
  useEffect(() => {
    return subscribe((s) => {
      setMinerReady(s.ready);
      setMinerRunning(s.running);
      setTapData(s.tapSum);
      setTapData5m(s.tapSum5m);
      if (s.error) setError(s.error);
    });
  }, []);

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

      setKeysPropagated(true);
      setMiningKeys((prev) => prev ? { ...prev, minerAddress: addr, areKeysPropagated: true } : null);
      setStatus(t('mining.keysPropagated'));
      // Сервис сам подхватит ключи и запустит майнинг
      initMining();
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

  const handleStartMiner = () => {
    setError(null);
    initMining();
  };

  const handleGetReward = async () => {
    try {
      await getReward();
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
            onClick={handleStartMiner}
            className="w-full py-3 rounded-lg font-bold text-sm
              bg-gradient-to-r from-neon-blue to-neon-purple text-white
              shadow-[0_0_16px_rgba(0,212,255,0.3)]
              active:scale-95 transition-all"
          >
            {t('mining.startMiner')}
          </button>
        )}

        {minerReady && (
          <div className="flex gap-2">
            <button
              onClick={() => { impactOccurred('medium'); minerRunning ? stopMining() : startMining(); }}
              className={`flex-1 py-3 rounded-lg font-bold text-sm active:scale-95 transition-all ${
                minerRunning
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-gradient-to-r from-neon-green to-emerald-500 text-white shadow-[0_0_12px_rgba(0,255,159,0.3)]'
              }`}
            >
              {t(minerRunning ? 'mining.stop' : 'mining.start')}
            </button>
            <button
              onClick={() => { impactOccurred('light'); addTap(); }}
              disabled={!minerRunning}
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
      {tapData !== '0' && (
        <div className="w-full bg-white/5 rounded-lg p-2 text-[10px] text-white/40 font-mono">
          <div>{t('mining.taps')}: {tapData} ({t('mining.taps5m')}: {tapData5m})</div>
          <div className="text-white/30">{t('mining.runsInBackground')}</div>
        </div>
      )}

      <button onClick={() => { impactOccurred('soft'); onBack(); }} className="w-full py-2.5 rounded-lg font-bold text-sm bg-white/5 border border-white/10 text-white/60 active:bg-white/10 active:scale-[0.98] transition-all mt-2">
        {t('mining.back')}
      </button>
    </div>
  );
}
