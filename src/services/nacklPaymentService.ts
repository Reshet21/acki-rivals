/**
 * nacklPaymentService.ts
 *
 * Отправка NACKL (ECC index 1) напрямую через @eversdk/core, минуя bee_connect.
 *
 * Архитектура:
 *   1. TonClient подключается к GraphQL эндпоинту Acki Nacki
 *   2. Сообщение sendTransaction кодируется через ABI мультифакторного кошелька
 *   3. Подписывается EPK-ключами (от gen_mining_keys / requestMiningKeys)
 *   4. Отправляется через client.processing.process_message
 *   5. Результат — message_id для отслеживания в блокчейне
 *
 * @see tvmSdkService.ts — инициализация SDK и конфигурация
 * @see beeEngine.ts — получение EPK ключей (requestMiningKeys, getStoredMiningKeys)
 */

import type { WalletConnection } from './beeEngine';
import {
  getStoredMiningKeys,
  requestMiningKeys,
  storeMiningKeys,
} from './beeEngine';
import {
  initTvmSdk,
  createClient,
  MULTIFACTOR_ABI,
  DEVELOPER_WALLET,
} from './tvmSdkService';

// ─── Интерфейсы ─────────────────────────────────────────

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

// ─── Вспомогательные функции ────────────────────────────

/**
 * Получить или создать EPK ключи для подписи транзакции.
 * Сначала проверяет localStorage, если нет — запрашивает через bee_connect.
 */
async function getSignerKeys(
  conn: WalletConnection,
): Promise<{ public: string; secret: string }> {
  const stored = getStoredMiningKeys(conn.profileAddress);
  if (stored) {
    return { public: stored.ownerPublic, secret: stored.ownerSecret };
  }

  // Ключей нет — запрашиваем через BeeConnect (кошелёк попросит подтвердить)
  const keys = await requestMiningKeys(conn);
  storeMiningKeys(conn.profileAddress, {
    ownerPublic: keys.ownerPublic,
    ownerSecret: keys.ownerSecret,
    minerAddress: null,
    areKeysPropagated: false,
  });

  return { public: keys.ownerPublic, secret: keys.ownerSecret };
}

/**
 * Конвертировать NACKL в нано (10^9).
 */
function toNano(amount: number): string {
  return BigInt(Math.floor(amount * 1e9)).toString();
}

// ─── Основная функция отправки ──────────────────────────

/**
 * Отправить NACKL через tvm-sdk напрямую в блокчейн Acki Nacki.
 *
 * Вызывает sendTransaction на мультифакторном кошельке пользователя:
 *   - dest: DEVELOPER_WALLET
 *   - value: 0 (газ не требуется, флаг 3 = оплата отправителем)
 *   - cc: {"1": amount} (NACKL, ECC index 1)
 *   - bounce: false
 *   - flags: 3 (сообщение оплачивает контракт отправителя)
 *   - payload: ""
 */
/**
 * Получить баланс NACKL (ECC index 1) кошелька.
 *
 * Использует bee-sdk Wallet.get_multifactor_balances (этот метод работает 
 * нормально и не требует EPK-ключей, только GraphQL запрос).
 */
export async function getBalance(walletAddress: string): Promise<string> {
  try {
    const { ENDPOINTS, API_URL, APP_ID } = await import('./beeEngine');
    const sdkMod = await import('@teamgosh/bee-sdk');
    const wasmUrl = new URL('@teamgosh/bee-sdk/bee_sdk_bg.wasm', import.meta.url);
    await sdkMod.default({ module_or_path: wasmUrl });

    const wallet = new sdkMod.Wallet(ENDPOINTS, null, API_URL, APP_ID);
    try {
      const balances = await wallet.get_multifactor_balances({
        multifactor_address: walletAddress,
      });
      const token1 = balances.ecc?.['1'] ?? '0';
      // Форматируем: NACKL имеет 9 десятичных знаков
      const amount = BigInt(token1);
      const base = 10n ** 9n;
      const whole = amount / base;
      const frac = (amount % base).toString().padStart(9, '0').slice(0, 4);
      return `${whole}.${frac}`;
    } finally {
      wallet.free();
    }
  } catch (e) {
    console.warn('[nacklPayment] getBalance failed:', e);
    return '0.0000';
  }
}

/**
 * Отправить NACKL через tvm-sdk напрямую в блокчейн Acki Nacki.
 *
 * Вызывает sendTransaction на мультифакторном кошельке пользователя:
 *   - dest: DEVELOPER_WALLET
 *   - value: 0 (газ не требуется, флаг 3 = оплата отправителем)
 *   - cc: {"1": amount} (NACKL, ECC index 1)
 *   - bounce: false
 *   - flags: 3 (сообщение оплачивает контракт отправителя)
 *   - payload: ""
 */
export async function buyPack(
  conn: WalletConnection,
  nacklAmount: number,
): Promise<PaymentResult> {
  try {
    // 1. Инициализируем SDK (если ещё не)
    await initTvmSdk();

    // 2. Получаем ключи для подписи
    const signerKeys = await getSignerKeys(conn);

    // 3. Создаём клиент и отправляем
    const client = createClient('mainnet');
    try {
      const nanoAmount = toNano(nacklAmount);

      // Формируем параметры для sendTransaction
      // cc — ECC токены: ключ = индекс токена (1 = NACKL), значение = сумма в нано
      const cc: Record<string, string> = {
        '1': nanoAmount,
      };

      const result = await client.processing.process_message({
        message_encode_params: {
          address: conn.walletAddress,
          abi: {
            type: 'Contract',
            value: MULTIFACTOR_ABI,
          },
          call_set: {
            function_name: 'sendTransaction',
            input: {
              dest: DEVELOPER_WALLET,
              value: '0', // 0 SHELL — газ оплачивается через флаги
              cc,
              bounce: false,
              flags: 3, // 3 = обычная отложенная отправка с оплатой газе отправителем
              payload: '', // пустой payload = простой перевод
            },
          },
          signer: {
            type: 'Keys',
            keys: signerKeys,
          },
          processing_try_index: 1,
        },
        send_events: false,
      });

      return {
        success: true,
        txHash: result.transaction?.id || result.fees?.total || 'pending',
      };
    } finally {
      client.close();
    }
  } catch (e) {
    console.error('[nacklPayment] Payment failed:', e);
    const msg = e instanceof Error ? e.message : 'Unknown payment error';

    // Если ошибка связана с ключами — сбрасываем кеш для перезапроса
    if (
      msg.includes('signer_keys') ||
      msg.includes('EPK') ||
      msg.includes('factor') ||
      msg.includes('expired') ||
      msg.includes('keys')
    ) {
      storeMiningKeys(conn.profileAddress, null);
    }

    return {
      success: false,
      error: msg,
    };
  }
}
