/**
 * minerWorker.ts — Web Worker that runs the WASM miner OFF the main thread.
 * The miner's synchronous start() would otherwise freeze the UI (black screen).
 *
 * Protocol:
 *   main → worker: { type: 'init', minerAddress, ownerPublic, ownerSecret, appId, endpoints }
 *   main → worker: { type: 'start', durationMs }
 *   main → worker: { type: 'stop' }
 *   main → worker: { type: 'tap', x, y }
 *   main → worker: { type: 'reward' }
 *   main → worker: { type: 'data' }        → reply 'data'
 *   main → worker: { type: 'dispose' }
 *
 *   worker → main: { type: 'ready' }
 *   worker → main: { type: 'status', running, canStart }
 *   worker → main: { type: 'data', tapSum, tapSum5m }
 *   worker → main: { type: 'event', message }     // raw miner callback messages
 *   worker → main: { type: 'error', message }
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdk: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let miner: any = null;
let started = false;

async function loadSdk() {
  if (sdk) return sdk;
  const mod = await import('@teamgosh/bee-sdk');
  const wasmUrl = new URL('@teamgosh/bee-sdk/bee_sdk_bg.wasm', import.meta.url);
  await mod.default({ module_or_path: wasmUrl });
  sdk = mod;
  return sdk;
}

function emit(type: string, payload?: Record<string, unknown>, reqId?: number) {
  self.postMessage({ type, reqId, ...(payload || {}) });
}

async function initMiner(msg: {
  minerAddress: string;
  ownerPublic: string;
  ownerSecret: string;
  appId: string;
  endpoints: string[];
}) {
  try {
    const sdkMod = await loadSdk();
    miner = await sdkMod.Miner.new(
      msg.endpoints,
      msg.appId,
      msg.minerAddress,
      msg.ownerPublic,
      msg.ownerSecret,
    );
    started = false;
    emit('ready');
    emit('status', { running: false, canStart: miner.can_start() });
  } catch (e) {
    emit('error', { message: e instanceof Error ? e.message : String(e) });
  }
}

function onMinerMessage(raw: string) {
  emit('event', { message: raw });
  try {
    const payload = JSON.parse(raw);
    if (payload.action === 'status_updated' && payload.data?.status) {
      const s = payload.data.status;
      const running = s === 'computing' || s === 'submitting';
      if (running !== started) {
        started = running;
        emit('status', { running, canStart: miner?.can_start() ?? false });
      }
    }
  } catch { /* non-json */ }
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (!msg || !msg.type) return;
  const reqId = typeof msg.reqId === 'number' ? msg.reqId : undefined;

  try {
    switch (msg.type) {
      case 'init':
        await initMiner(msg);
        break;

      case 'start':
        if (miner) {
          started = true;
          emit('status', { running: true, canStart: false });
          miner.start(msg.durationMs ?? 15000, onMinerMessage);
        }
        break;

      case 'stop':
        if (miner) {
          miner.stop();
          started = false;
          emit('status', { running: false, canStart: miner.can_start() });
        }
        break;

      case 'tap':
        if (miner) miner.add_tap(msg.x ?? 1, msg.y ?? 1);
        break;

      case 'reward':
        if (miner) {
          await miner.get_reward();
          emit('event', { message: 'reward_ok' }, reqId);
        } else {
          emit('error', { message: 'Miner not ready' }, reqId);
        }
        break;

      case 'data':
        if (miner) {
          const data = await miner.get_miner_data();
          emit('data', {
            tapSum: data.tap_sum.toString(),
            tapSum5m: data.tap_sum_5m.toString(),
          }, reqId);
          data.free();
        } else {
          emit('error', { message: 'Miner not ready' }, reqId);
        }
        break;

      case 'dispose':
        try { miner?.free?.(); } catch { /* ignore */ }
        miner = null;
        break;

      default:
        emit('error', { message: `Unknown worker message: ${msg.type}` }, reqId);
    }
  } catch (err) {
    emit('error', { message: err instanceof Error ? err.message : String(err) }, reqId);
  }
};
