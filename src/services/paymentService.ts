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
 */

import type { WalletConnection } from './beeEngine';
import { ENDPOINTS, API_URL, APP_ID } from './beeEngine';
import { getSignerKeys, toNano } from './helpers';

const DEVELOPER_WALLET = '0:d9ed11eaef8f0ec7b475fe29e293bb721cb6a64dfba3fd069b8e2f9303ff6b36';
const NACKL_ECC_INDEX = '1';

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
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
 * Отправить NACKL с кошелька покупателя на кошелёк разработчика.
 *
 * @see TSendTokensDirectReq:
 *   { multifactor_address, destination_address, token_root,
 *     amount_raw, flags, signer_keys, bounce? }
 */
export async function buyPack(
  conn: WalletConnection,
  nacklAmount: number,
  _packType?: string,
): Promise<PaymentResult> {
  try {
    const signerKeys = await getSignerKeys(conn);
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
    const msg = e instanceof Error ? e.message : 'Unknown payment error';

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
