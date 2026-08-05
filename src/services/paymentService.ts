/**
 * paymentService.ts
 *
 * Платежный сервис для покупки паков карт за NACKL.
 *
 * ⚠️ NACKL — нативный ECC токен Acki Nacki (индекс 1), НЕ TIP-3.
 *
 * Использует bee-sdk Wallet.send_tokens_direct.
 * Ключи подписи берутся из zkLogin-флоу (EPK-факторы), НЕ из gen_mining_keys.
 *
 * @see ИНТЕГРАЦИЯ_кошелька_zkLogin.md — полный флоу zkLogin
 */

import type { WalletConnection } from './beeEngine';
import { ENDPOINTS, API_URL, APP_ID } from './beeEngine';
import { getStoredEpkKey, clearEpkKey, verifyEpkFactor } from './zkLoginService';
import { toNano } from './helpers';

const DEVELOPER_WALLET = '0:d9ed11eaef8f0ec7b475fe29e293bb721cb6a64dfba3fd069b8e2f9303ff6b36';
const NACKL_ECC_INDEX = '1';

// Известные коды ошибок контракта Multifactor
export const ERROR_CODES = {
  ERR_FACTOR_EXPIRED: 502 as const,
  ERR_INVALID_SIGNATURE: 501 as const,
  ERR_FACTOR_NOT_FOUND: 506 as const,
  ERR_SECURITY_CARD: 700 as const,
  ERR_NOT_IN_WHITELIST: 412 as const,
  ERR_BELOW_MIN_VALUE: 200 as const,
};

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
  /** Код ошибки если известен (напр. 502) */
  errorCode?: number;
  /** Флаг: требуется переподключение кошелька (сессия протухла) */
  needsReconnect?: boolean;
}

// Lazy-load SDK
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
 * Проверить, что у нас есть живой EPK-ключ для отправки транзакции.
 * Если ключа нет или он протух — возвращает ошибку.
 */
async function ensureValidEpkKey(
  walletAddress: string,
): Promise<{ public: string; secret: string }> {
  const epk = getStoredEpkKey();

  if (!epk) {
    throw Object.assign(
      new Error('Нет зарегистрированного EPK-фактора. Выполните вход через Google или Telegram (zkLogin).'),
      { errorCode: 502, needsReconnect: true },
    );
  }

  // Дополнительная проверка через блокчейн
  const isValid = await verifyEpkFactor(walletAddress, epk.public);
  if (!isValid) {
    // Фактор протух — удаляем и требуем новый вход
    clearEpkKey();
    throw Object.assign(
      new Error('EPK-фактор протух или не зарегистрирован. Выполните повторный вход через Google или Telegram (zkLogin).'),
      { errorCode: 502, needsReconnect: true },
    );
  }

  return { public: epk.public, secret: epk.secret };
}

/**
 * Достать exit_code из вложенной структуры AppError.
 */
function parseErrorCode(e: unknown): number | null {
  if (!e || typeof e !== 'object') return null;
  const err = e as Record<string, unknown>;

  if (err.error_code && typeof err.error_code === 'string') {
    const code = parseInt(err.error_code, 10);
    if (!isNaN(code)) return code;
  }

  if (err.kind === 'tvm_exit') {
    return digExitCode(err);
  }
  if (err.tvm_error && typeof err.tvm_error === 'object') {
    return digExitCode(err);
  }

  return null;
}

function digExitCode(obj: Record<string, unknown>): number | null {
  try {
    const tvm = obj.tvm_error as Record<string, unknown> | undefined;
    if (!tvm) return null;
    const data = tvm.data as Record<string, unknown> | undefined;
    if (!data) return null;
    const node = data.node_error as Record<string, unknown> | undefined;
    if (!node) return null;
    const ext = node.extensions as Record<string, unknown> | undefined;
    if (!ext) return null;
    const details = ext.details as Record<string, unknown> | undefined;
    if (!details) return null;
    const exitCode = details.exit_code;
    if (exitCode !== undefined) return Number(exitCode);
  } catch {
    // ignore
  }
  return null;
}

/**
 * Купить пак карт за NACKL.
 *
 * Использует EPK-ключ из zkLogin для подписи транзакции.
 * Если ключ протух — возвращает needsReconnect=true.
 */
export async function buyPack(
  conn: WalletConnection,
  nacklAmount: number,
  _packType?: string,
): Promise<PaymentResult> {
  try {
    // ⚡ Проверяем EPK-ключ перед отправкой
    let signerKeys: { public: string; secret: string };
    try {
      signerKeys = await ensureValidEpkKey(conn.walletAddress);
    } catch (epkError) {
      const fe = epkError as Record<string, unknown>;
      return {
        success: false,
        error: String(fe.message || 'EPK-ключ не найден. Выполните вход через Google.'),
        errorCode: (fe.errorCode as number) || 502,
        needsReconnect: true,
      };
    }

    const sdk = await getSdk();
    const wallet = new sdk.Wallet(ENDPOINTS, null, API_URL, APP_ID);

    try {
      const nanoAmount = toNano(nacklAmount);

      const result = await wallet.send_tokens_direct({
        multifactor_address: conn.walletAddress,
        destination_address: DEVELOPER_WALLET,
        token_root: NACKL_ECC_INDEX,
        amount_raw: nanoAmount,
        flags: 0,
        signer_keys: signerKeys,
        bounce: false,
      });

      return {
        success: true,
        txHash: result.message_ids?.[0] || 'pending',
      };
    } finally {
      wallet.free();
    }
  } catch (e) {
    console.error('[paymentService] Payment failed:', e);

    const errorCode = parseErrorCode(e);
    const msg = e instanceof Error ? e.message : 'Unknown payment error';

    // 502 — ERR_FACTOR_EXPIRED (протухший ZKP-фактор)
    if (errorCode === 502 || msg.includes('502') || msg.includes('ERR_FACTOR_EXPIRED')) {
      clearEpkKey();
      return {
        success: false,
        error: 'Срок действия EPK-фактора истёк. Требуется повторный вход через Google.',
        errorCode: 502,
        needsReconnect: true,
      };
    }

    // 700 — включена security card
    if (errorCode === 700) {
      return {
        success: false,
        error: 'Транзакция отклонена security card. Отключите её в AN Wallet.',
        errorCode: 700,
      };
    }

    // 412 — dest не в whitelist
    if (errorCode === 412) {
      return {
        success: false,
        error: 'Адрес получателя не в whitelist кошелька.',
        errorCode: 412,
      };
    }

    // 200 — value ниже _min_value
    if (errorCode === 200) {
      return {
        success: false,
        error: 'Сумма перевода ниже минимальной.',
        errorCode: 200,
      };
    }

    if (errorCode) {
      return {
        success: false,
        error: `Ошибка блокчейна (код ${errorCode}): ${msg}`,
        errorCode,
      };
    }

    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Получить баланс NACKL кошелька через bee-sdk.
 */
export async function getBalance(walletAddress: string): Promise<string> {
  try {
    const sdk = await getSdk();
    const wallet = new sdk.Wallet(ENDPOINTS, null, API_URL, APP_ID);

    try {
      const balances = await wallet.get_multifactor_balances({
        multifactor_address: walletAddress,
      });
      const token1 = balances.ecc?.['1'] ?? '0';
      const amount = BigInt(token1);
      const base = 10n ** 9n;
      const whole = amount / base;
      const frac = (amount % base).toString().padStart(9, '0').slice(0, 4);
      return `${whole}.${frac}`;
    } finally {
      wallet.free();
    }
  } catch (e) {
    console.warn('[paymentService] getBalance failed:', e);
    return '0.0000';
  }
}