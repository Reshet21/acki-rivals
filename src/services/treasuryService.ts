/**
 * treasuryService.ts — клиент сервиса казначейства.
 *
 * Игрок платит NACKL на казначейство (адрес M), затем этот сервис
 * подтверждает платёж через /api/treasury/buy — сервер валидирует
 * транзакцию в блокчейне и выдаёт ACKR (двухфазный TIP-3 перевод).
 */
import type { WalletConnection } from './beeEngine';
import { ENDPOINTS, API_URL, APP_ID } from './beeEngine';
import { getStoredEpkKey } from './zkLoginService';
import { toNano } from './helpers';

/** Казначейство — куда игрок шлёт NACKL (мультисиг M, Shellnet) */
export const TREASURY_ADDRESS =
  import.meta.env.VITE_TREASURY_ADDRESS ||
  '0:badc33121c6284f5dbf1ec829edbd1d97f5fc7fae5f15461acdd74d77c341d85';
const NACKL_ECC_INDEX = '1';

export interface BuyResult {
  success: boolean;
  ackrAmount?: number;
  error?: string;
  retryAfterMs?: number;
  txHash?: string;
}

let sdkModule: any = null;
let sdkInitPromise: Promise<void> | null = null;

async function getSdk(): Promise<any> {
  if (sdkModule) return sdkModule;
  if (sdkInitPromise) {
    await sdkInitPromise;
    return sdkModule;
  }
  sdkInitPromise = (async () => {
    const mod = await import('@teamgosh/bee-sdk');
    const wasmUrl = new URL('@teamgosh/bee-sdk/bee_sdk_bg.wasm', import.meta.url);
    await mod.default({ module_or_path: wasmUrl });
    sdkModule = mod;
  })();
  await sdkInitPromise;
  return sdkModule;
}

/**
 * Шаг 1: игрок платит NACKL на казначейство через AN Wallet.
 */
export async function payNacklToTreasury(
  conn: WalletConnection,
  signerKeys: { public: string; secret: string },
  nacklAmount: number,
): Promise<string> {
  const sdk = await getSdk();
  const wallet = new sdk.Wallet(ENDPOINTS, null, API_URL, APP_ID);
  try {
    const result = await wallet.send_tokens_direct({
      multifactor_address: conn.walletAddress,
      destination_address: TREASURY_ADDRESS,
      token_root: NACKL_ECC_INDEX,
      amount_raw: toNano(nacklAmount),
      flags: 0,
      signer_keys: signerKeys,
      bounce: false,
    });
    return result.message_ids?.[0] || 'pending';
  } finally {
    wallet.free();
  }
}

/**
 * Шаг 2: запросить выдачу ACKR (сервер валидирует платёж).
 * Платёж может идти несколько секунд — ретраим по retryAfterMs.
 */
export async function requestAckr(
  player: string,
  nacklAmount: number,
  maxRetries = 12,
): Promise<BuyResult> {
  let attempt = 0;
  let retryAfterMs = 5000;

  while (attempt < maxRetries) {
    attempt += 1;
    try {
      const res = await fetch('/api/treasury/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, nacklAmount }),
      });
      const json = (await res.json()) as BuyResult & { orderId?: string };

      if (res.ok && json.success) {
        return { success: true, ackrAmount: json.ackrAmount, txHash: json.txHash };
      }
      if (res.status === 409) {
        return { success: false, error: json.error || 'Платёж уже обработан' };
      }
      if (res.status === 400) {
        return { success: false, error: json.error || 'Ошибка запроса' };
      }
      // 202 (платёж ещё не найден) и 500 (сеть блокчейна) — ждём и пробуем ещё
      retryAfterMs = json.retryAfterMs || retryAfterMs;
      await new Promise((r) => setTimeout(r, retryAfterMs));
    } catch {
      // сеть — ждём и пробуем ещё
      await new Promise((r) => setTimeout(r, retryAfterMs));
    }
  }
  return { success: false, error: 'Таймаут подтверждения платежа' };
}

/**
 * Подтвердить покупку пака: сервер ищет входящий NACKL-платёж на казначейство
 * и возвращает 200, когда платёж найден. Платёж идёт несколько секунд —
 * ретраим по retryAfterMs.
 */
export async function confirmPackPayment(
  player: string,
  nacklAmount: number,
  packId: string,
  txHash?: string,
  maxRetries = 24,
): Promise<BuyResult> {
  let attempt = 0;
  let retryAfterMs = 5000;

  while (attempt < maxRetries) {
    attempt += 1;
    try {
      const res = await fetch('/api/shop/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, nacklAmount, packId, txHash: txHash?.trim() || undefined }),
      });
      const json = (await res.json()) as BuyResult;

      if (res.ok && json.success) {
        return { success: true };
      }
      if (res.status === 409) {
        return { success: false, error: json.error || 'Платёж уже обработан' };
      }
      if (res.status === 400) {
        return { success: false, error: json.error || 'Ошибка запроса' };
      }
      // 202 (платёж ещё не найден) и 500 (сеть блокчейна) — ждём и пробуем ещё
      retryAfterMs = json.retryAfterMs || retryAfterMs;
      await new Promise((r) => setTimeout(r, retryAfterMs));
    } catch {
      // сеть — ждём и пробуем ещё
      await new Promise((r) => setTimeout(r, retryAfterMs));
    }
  }
  return { success: false, error: 'Таймаут подтверждения платежа' };
}

/**
 * EPK-ключ для подписи NACKL-перевода (тот же флоу, что в paymentService).
 */
export function getTreasurySignerKeys(): { public: string; secret: string } | null {
  const epk = getStoredEpkKey();
  if (!epk) return null;
  return { public: epk.public, secret: epk.secret };
}

/** Статус/история заказов игрока (для UI «получить ACKR») */
export async function getTreasuryStatus(player: string): Promise<{
  treasury: string;
  ackrPerNackl: number;
  minNackl: number;
  orders: Array<Record<string, unknown>>;
}> {
  try {
    const res = await fetch(`/api/treasury/status?player=${encodeURIComponent(player)}`);
    return (await res.json()) as ReturnType<typeof getTreasuryStatus>;
  } catch {
    return { treasury: TREASURY_ADDRESS, ackrPerNackl: 1, minNackl: 1, orders: [] };
  }
}
