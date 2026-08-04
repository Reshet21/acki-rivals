/**
 * paymentService.ts
 *
 * Платежный сервис для покупки паков карт за NACKL.
 *
 * ⚠️ NACKL — нативный ECC токен Acki Nacki (индекс 1), НЕ TIP-3.
 *
 * Использует bee-sdk Wallet.send_tokens_direct с правильным API:
 *   - token_root = "1" (ECC индекс NACKL)
 *   - amount_raw (не amount!)
 *   - flags: 0
 *   - signer_keys: EPK ключи (из getSignerKeys)
 *
 * @see bee_wallet/src/adapters/wasm/dto/mod.rs — TSendTokensDirectReq
 * @see helpers.ts — getSignerKeys для получения EPK ключей
 *
 * Обработка ошибок:
 *   - ERR_FACTOR_EXPIRED (502) — ZKP-фактор протух или удалён → needsReconnect
 *   - Перед отправкой проверяем epk_expire_at через get_epk_expire_at
 *   - Минимальное время жизни фактора: MIN_EPK_LIFE_TIME_SEC = 300с
 */

import type { WalletConnection } from './beeEngine';
import { ENDPOINTS, API_URL, APP_ID } from './beeEngine';
import { getSignerKeys, toNano } from './helpers';

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

// Минимальное время жизни EPK-фактора: контракт требует ≥ 300 сек
const MIN_EPK_LIFE_TIME_SEC = 300;

// Запас безопасности: если фактор живёт меньше 10 минут — предупреждаем
const EPK_SAFETY_MARGIN_SEC = 600;

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
 * Достать exit_code из вложенной структуры AppError.
 * bee-sdk ошибки приходят с полями tvm_error.data.node_error.extensions.details.exit_code.
 */
function parseErrorCode(e: unknown): number | null {
  if (!e || typeof e !== 'object') return null;
  const err = e as Record<string, unknown>;

  // Прямое поле error_code (строка) — простейший случай
  if (err.error_code && typeof err.error_code === 'string') {
    const code = parseInt(err.error_code, 10);
    if (!isNaN(code)) return code;
  }

  // kind = 'tvm_exit' — поле tvm_error
  if (err.kind === 'tvm_exit') {
    return digExitCode(err);
  }

  // Поле tvm_error без kind
  if (err.tvm_error && typeof err.tvm_error === 'object') {
    return digExitCode(err);
  }

  return null;
}

/** Раскопать exit_code из tvm_error.data.node_error.extensions.details  */
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
    // Игнорируем ошибки распаковки
  }
  return null;
}

/**
 * Проверить EPK-фактор перед отправкой транзакции.
 *
 * Дёргает get_epk_expire_at(epk) на контракте Multifactor и сравнивает
 * с текущим временем блокчейна (block.timestamp).
 *
 * @throws {Error} с errorCode=502 и needsReconnect=true если фактор протух
 */
export async function checkFactorBeforeSend(
  conn: WalletConnection,
  signerPubKey: string,
): Promise<void> {
  const sdk = await getSdk();
  const wallet = new sdk.Wallet(ENDPOINTS, null, API_URL, APP_ID);

  try {
    // get_epk_expire_at(epk) — геттер контракта Multifactor
    // Возвращает unix timestamp (сек) когда фактор протухает
    let epkExpireAt: string | undefined;
    try {
      epkExpireAt = await wallet.get_epk_expire_at({
        multifactor_address: conn.walletAddress,
        epk: signerPubKey,
      });
    } catch (getterError) {
      // Если геттер упал — это не обязательно проблема фактора,
      // возможно сеть недоступна. Пропускаем проверку и даём шанс
      // основной транзакции.
      console.warn('[paymentService] get_epk_expire_at failed, skipping factor check:', getterError);
      return;
    }

    const expireTs = parseInt(epkExpireAt ?? '', 10);

    // 0 или NaN — фактор не зарегистрирован или удалён cleanExpiredZKPFactors
    if (!epkExpireAt || isNaN(expireTs) || expireTs === 0) {
      const err = new Error(
        'ZKP-фактор не зарегистрирован или был удалён. ' +
        'Требуется повторный вход через AN Wallet (переподключите кошелёк).'
      );
      (err as any).errorCode = 502;
      (err as any).needsReconnect = true;
      throw err;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    // epk_expire_at в прошлом — сессия истекла
    if (expireTs <= nowSeconds) {
      const err = new Error(
        'Срок действия ZKP-фактора истёк. ' +
        'Требуется повторный вход через AN Wallet (переподключите кошелёк).'
      );
      (err as any).errorCode = 502;
      (err as any).needsReconnect = true;
      throw err;
    }

    // Фактор живёт меньше MIN_EPK_LIFE_TIME — контракт не примет
    const remaining = expireTs - nowSeconds;
    if (remaining < MIN_EPK_LIFE_TIME_SEC) {
      const err = new Error(
        `ZKP-фактор скоро истекает (осталось ${remaining}с, минимум ${MIN_EPK_LIFE_TIME_SEC}с). ` +
        'Требуется повторный вход через AN Wallet.'
      );
      (err as any).errorCode = 502;
      (err as any).needsReconnect = true;
      throw err;
    }

    // Предупреждаем, если осталось меньше запаса безопасности
    if (remaining < EPK_SAFETY_MARGIN_SEC) {
      console.warn(
        `[paymentService] EPK factor expires soon: ${remaining}s remaining ` +
        `(safety margin: ${EPK_SAFETY_MARGIN_SEC}s)`,
      );
    }
  } finally {
    wallet.free();
  }
}

/**
 * Отправить NACKL с кошелька покупателя на кошелёк разработчика.
 *
 * Перед отправкой проверяет EPK-фактор (get_epk_expire_at).
 * Если фактор протух — возвращает PaymentResult с needsReconnect=true
 * и понятным сообщением вместо технической простыни AppError.
 */
export async function buyPack(
  conn: WalletConnection,
  nacklAmount: number,
  _packType?: string,
): Promise<PaymentResult> {
  try {
    // Получаем свежие signerKeys (всегда с forceRefresh = true)
    let signerKeys: { public: string; secret: string };
    try {
      signerKeys = await getSignerKeys(conn, true);
    } catch (keysError) {
      console.error('[paymentService] Failed to get signer keys:', keysError);
      return {
        success: false,
        error: 'Не удалось получить ключи подписи. Проверьте подключение к AN Wallet.',
        needsReconnect: true,
      };
    }

    // ⚡ Проверяем EPK-фактор ДО отправки транзакции
    const factorCheck = await checkFactorBeforeSend(conn, signerKeys.public)
      .then(() => null as { error: string } | null)
      .catch((err: any) => ({
        error: err.message || 'ZKP-фактор протух',
      }));

    if (factorCheck) {
      return {
        success: false,
        error: factorCheck.error,
        errorCode: 502,
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

    // Пробуем извлечь код ошибки из AppError
    const errorCode = parseErrorCode(e);
    const msg = e instanceof Error ? e.message : 'Unknown payment error';

    // 502 — ERR_FACTOR_EXPIRED (протухший ZKP-фактор)
    if (errorCode === 502 || msg.includes('502') || msg.includes('ERR_FACTOR_EXPIRED')) {
      return {
        success: false,
        error: 'Срок действия ZKP-фактора истёк. Требуется повторный вход через AN Wallet.',
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

    // Если есть код ошибки — показываем его
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