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
/** Ник владельца казначейства — по нему проходят переводы (по адресу AN Wallet просит app id) */
export const TREASURY_NAME = import.meta.env.VITE_TREASURY_NAME || '';
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
 * EPK-ключ для подписи NACKL-перевода (тот же флоу, что в paymentService).
 */
export function getTreasurySignerKeys(): { public: string; secret: string } | null {
  const epk = getStoredEpkKey();
  if (!epk) return null;
  return { public: epk.public, secret: epk.secret };
}

/**
 * Пополнить игровой баланс: сервер ищет в ленте казначейства незачисленный
 * платёж РОВНО amountNackl (отправителя по src не отличить — у всех
 * переводов src = казначейство, поэтому сумма заявки = идентификатор).
 * Платёж идёт несколько секунд — ретраим по retryAfterMs.
 */
export async function depositNackl(
  player: string,
  amountNackl: number,
  maxRetries = 24,
): Promise<{ success: boolean; depositedNackl?: number; balanceNackl?: number; error?: string }> {
  let attempt = 0;
  let retryAfterMs = 5000;
  const expectedNano = BigInt(Math.round(amountNackl * 1e9)).toString();

  while (attempt < maxRetries) {
    attempt += 1;
    try {
      const res = await fetch('/api/balance/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, expectedNano }),
      });
      const json = (await res.json()) as {
        success: boolean;
        depositedNano?: string;
        balanceNano?: string;
        error?: string;
        retryAfterMs?: number;
      };

      if (res.ok && json.success) {
        return {
          success: true,
          depositedNackl: json.depositedNano ? Number(json.depositedNano) / 1e9 : 0,
          balanceNackl: json.balanceNano ? Number(json.balanceNano) / 1e9 : 0,
        };
      }
      if (res.status === 400) {
        return { success: false, error: json.error || 'Ошибка запроса' };
      }
      // 202 (платёж ещё не найден) и 500 (сеть блокчейна) — ждём и пробуем ещё
      retryAfterMs = json.retryAfterMs || retryAfterMs;
      await new Promise((r) => setTimeout(r, retryAfterMs));
    } catch {
      await new Promise((r) => setTimeout(r, retryAfterMs));
    }
  }
  return { success: false, error: 'Таймаут: платёж не найден' };
}

/**
 * Текущий игровой баланс в NACKL (0 при ошибке).
 */
export async function getPlayerBalance(player: string): Promise<number> {
  try {
    const res = await fetch(`/api/balance?player=${encodeURIComponent(player)}`);
    const json = (await res.json()) as { success?: boolean; balanceNackl?: number };
    return json?.balanceNackl || 0;
  } catch {
    return 0;
  }
}

/**
 * Купить пак за игровой баланс: сервер атомарно списывает цену
 * (серверная цена пака, клиент не передаёт сумму).
 */
export async function buyWithBalance(
  player: string,
  packId: string,
): Promise<{ success: boolean; balanceNackl?: number; error?: string }> {
  try {
    const res = await fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player, packId }),
    });
    const json = (await res.json()) as {
      success: boolean;
      balanceNano?: string;
      error?: string;
    };
    if (res.ok && json.success) {
      return { success: true, balanceNackl: json.balanceNano ? Number(json.balanceNano) / 1e9 : undefined };
    }
    return { success: false, error: json.error || 'Покупка не удалась' };
  } catch {
    return { success: false, error: 'Сеть недоступна' };
  }
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
