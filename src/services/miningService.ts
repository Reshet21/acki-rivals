/**
 * miningService.ts — глобальный майнинг-сервис.
 *
 * Воркер живёт, пока приложение открыто (не зависит от экрана MiningPanel).
 * Авто-цикл: start(15с) → завершение → пауза 1.5с → снова start.
 * Пауза при скрытой вкладке (visibilitychange), авто-рестарт при возврате.
 * Сам читает сессию и ключи из localStorage — работает на любом экране.
 */

import { getStoredSession, getStoredMiningKeys, ENDPOINTS, APP_ID } from './beeEngine';

export interface MiningState {
  ready: boolean;
  running: boolean;
  canStart: boolean;
  tapSum: string;
  tapSum5m: string;
  error: string | null;
  lastEvent: string | null;
}

const initialState: MiningState = {
  ready: false,
  running: false,
  canStart: false,
  tapSum: '0',
  tapSum5m: '0',
  error: null,
  lastEvent: null,
};

let worker: Worker | null = null;
let listeners: Array<(s: MiningState) => void> = [];
let autoEnabled = false;
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let msgId = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let state: MiningState = { ...initialState };

function emit() {
  for (const l of listeners) l(state);
}

export function subscribe(fn: (s: MiningState) => void): () => void {
  listeners.push(fn);
  fn(state);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function getState(): MiningState {
  return state;
}

function sessionAlive(): boolean {
  const conn = getStoredSession();
  if (!conn) return false;
  const keys = getStoredMiningKeys(conn.profileAddress);
  return !!keys?.areKeysPropagated && !!keys.minerAddress;
}

function makeWorker(): Worker {
  const w = new Worker(new URL('./minerWorker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent) => {
    const msg = e.data;
    if (msg?.reqId != null && pending.has(msg.reqId)) {
      const p = pending.get(msg.reqId)!;
      pending.delete(msg.reqId);
      if (msg.type === 'error') p.reject(new Error(msg.message));
      else p.resolve(msg);
      return;
    }
    switch (msg?.type) {
      case 'ready':
        state.ready = true;
        emit();
        scheduleRestart();
        break;
      case 'status':
        state.running = !!msg.running;
        state.canStart = !!msg.canStart;
        emit();
        if (!state.running) scheduleRestart();
        break;
      case 'data':
        state.tapSum = msg.tapSum;
        state.tapSum5m = msg.tapSum5m;
        emit();
        break;
      case 'event':
        state.lastEvent = msg.message;
        try {
          const payload = JSON.parse(msg.message);
          if (payload.error) {
            state.error = String(payload.error);
            state.running = false;
            emit();
            scheduleRestart();
          }
        } catch {
          /* non-json */
        }
        emit();
        break;
      case 'error':
        state.error = msg.message;
        state.running = false;
        emit();
        scheduleRestart();
        break;
    }
  };
  w.onerror = (e: ErrorEvent) => {
    state.error = e.message || 'Worker error';
    state.running = false;
    emit();
    scheduleRestart();
  };
  return w;
}

function send(type: string, payload?: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!worker) return reject(new Error('Worker not ready'));
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    worker.postMessage({ type, reqId: id, ...(payload || {}) });
  });
}

function scheduleRestart() {
  if (!autoEnabled) return;
  if (restartTimer) return;
  if (!state.ready || state.running) return;
  if (document.hidden) return;
  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (autoEnabled && state.ready && !state.running && !document.hidden && sessionAlive()) {
      startMining();
    }
  }, 1500);
}

export function startMining() {
  worker?.postMessage({ type: 'start', durationMs: 15000 });
}

export function stopMining() {
  worker?.postMessage({ type: 'stop' });
}

export function addTap() {
  worker?.postMessage({ type: 'tap', x: 1, y: 1 });
}

export async function getReward(): Promise<void> {
  try {
    await send('reward');
    state.lastEvent = 'reward_ok';
    emit();
  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e);
    emit();
  }
}

/** Инициализация воркера, если есть сессия + ключи (идемпотентно). */
export function initMining(): boolean {
  if (worker) return true;
  const conn = getStoredSession();
  if (!conn) return false;
  const keys = getStoredMiningKeys(conn.profileAddress);
  if (!keys?.areKeysPropagated || !keys.minerAddress) return false;
  worker = makeWorker();
  worker.postMessage({
    type: 'init',
    minerAddress: keys.minerAddress,
    ownerPublic: keys.ownerPublic,
    ownerSecret: keys.ownerSecret,
    appId: APP_ID,
    endpoints: ENDPOINTS,
  });
  return true;
}

/** Включить авто-майнинг: стартует сам при заходе в приложение. */
export function enableAutoMining() {
  autoEnabled = true;
  if (initMining()) scheduleRestart();
}

/** Выключить авто-майнинг (например при отключении кошелька). */
export function disableAutoMining() {
  autoEnabled = false;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  stopMining();
  worker?.postMessage({ type: 'dispose' });
  worker = null;
  state = { ...initialState };
  emit();
}

function onVisibilityChange() {
  if (document.hidden) {
    stopMining();
  } else {
    scheduleRestart();
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', onVisibilityChange);
}
