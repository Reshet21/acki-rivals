/**
 * paymentService.ts
 *
 * Платежный сервис для покупки паков карт в Acki Rivals.
 *
 * ⚠️ NACKL — нативный ECC токен Acki Nacki (index 1), НЕ TIP-3.
 *
 * Раньше использовал bee-sdk (send_tokens_direct), который оказался
 * майнинговым API, не подходящим для dApp-платежей.
 *
 * Сейчас использует @eversdk/core для прямого вызова sendTransaction
 * на мультифакторном кошельке через GraphQL.
 *
 * @see nacklPaymentService.ts — реализация отправки NACKL
 * @see tvmSdkService.ts — инициализация TonClient
 */

import type { WalletConnection } from './beeEngine';
import { buyPack as sendNackl } from './nacklPaymentService';

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Купить пак карт за NACKL.
 *
 * @param conn — подключение к кошельку (через bee_connect)
 * @param nacklAmount — сумма в NACKL (например 5)
 * @param packType — тип пака (для логирования, опционально)
 */
export async function buyPack(
  conn: WalletConnection,
  nacklAmount: number,
  packType?: string,
): Promise<PaymentResult> {
  const result = await sendNackl(conn, nacklAmount);

  if (result.success) {
    console.log(
      `[payment] Куплен пак${packType ? ` (${packType})` : ''} за ${nacklAmount} NACKL. TX: ${result.txHash}`,
    );
  } else {
    console.error(
      `[payment] Ошибка оплаты${packType ? ` (${packType})` : ''}: ${result.error}`,
    );
  }

  return result;
}

/**
 * Получить текущий баланс NACKL кошелька.
 * Делегирует в bee-sdk (get_multifactor_balances работает нормально).
 */
export { getBalance } from './nacklPaymentService';
