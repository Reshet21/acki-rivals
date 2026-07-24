/**
 * Payment service for NACKL token transactions on Acki Nacki blockchain.
 *
 * Sends NACKL tokens from buyer's wallet to developer wallet for pack purchases.
 *
 * NACKL — нативный ECC токен Acki Nacki с индексом 1.
 * У него НЕТ TIP-3 TokenRoot контракта — это встроенный токен сети.
 *
 * Для отправки через bee-sdk Wallet.send_tokens_direct() нужно:
 *   token_root = "1"  (ECC индекс NACKL)
 *   amount_raw        (не amount!)
 *   flags: 0          (обычный перевод)
 *   signer_keys       (EPK ключи, полученные через requestMiningKeys / gen_mining_keys)
 *
 * @see bee_wallet/src/adapters/wasm/dto/mod.rs — TSendTokensDirectReq
 * @see https://docs.ackinacki.com/glossary#extra-currency-collection
 */

import type { WalletConnection } from './beeEngine';
import {
  ENDPOINTS, API_URL, APP_ID,
  getStoredMiningKeys,
  requestMiningKeys,
  storeMiningKeys,
} from './beeEngine';

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
 * Для отправки нужны EPK ключи (signer_keys).
 * Если их нет — автоматически запрашиваем через requestMiningKeys.
 *
 * @see TSendTokensDirectReq из bee-sdk:
 *   { multifactor_address, destination_address, token_root,
 *     amount_raw, flags, signer_keys, bounce?, value?, payload? }
 */
export async function buyPack(
  conn: WalletConnection,
  nacklAmount: number,
): Promise<PaymentResult> {
  try {
    // ── Получаем EPK ключи ──────────────────────────────────
    let miningKeys = getStoredMiningKeys(conn.profileAddress);
    if (!miningKeys || !miningKeys.areKeysPropagated) {
      // Если ключей нет — запрашиваем через BeeConnect
      // (кошелёк попросит подтвердить добавление ключей)
      const keys = await requestMiningKeys(conn);
      miningKeys = {
        ownerPublic: keys.ownerPublic,
        ownerSecret: keys.ownerSecret,
        minerAddress: null,
        areKeysPropagated: false,
      };
      storeMiningKeys(conn.profileAddress, miningKeys);
    }

    const sdk = await getSdk();
    const wallet = new sdk.Wallet(ENDPOINTS, null, API_URL, APP_ID);

    try {
      const nanoAmount = BigInt(Math.floor(nacklAmount * 1e9)).toString();

      // Правильный API из bee-sdk TSendTokensDirectReq
      const result = await wallet.send_tokens_direct({
        multifactor_address: conn.walletAddress,
        destination_address: DEVELOPER_WALLET,
        token_root: NACKL_ECC_INDEX,        // ECC index 1 = NACKL
        amount_raw: nanoAmount,              // amount_raw, не amount!
        flags: 0,                             // 0 = обычный перевод
        signer_keys: {                        // EPK ключи
          public: miningKeys.ownerPublic,
          secret: miningKeys.ownerSecret,
        },
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
    console.error('Payment failed:', e);
    const msg = e instanceof Error ? e.message : 'Unknown payment error';

    // Если ключи не прошли — предлагаем перезапросить
    if (msg.includes('signer_keys') || msg.includes('EPK') || msg.includes('factor')) {
      // Сбрасываем кеш ключей — в следующий раз перезапросим
      if (conn?.profileAddress) {
        storeMiningKeys(conn.profileAddress, null);
      }
    }

    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Получить текущий баланс NACKL (ECC index 1) кошелька.
 */
export async function getBalance(walletAddress: string): Promise<string> {
  const sdk = await getSdk();
  const wallet = new sdk.Wallet(ENDPOINTS, null, API_URL, APP_ID);

  try {
    const balances = await wallet.get_multifactor_balances({
      multifactor_address: walletAddress,
    });
    const token1 = balances.ecc['1'] ?? '0';
    return formatNano(token1);
  } catch (e) {
    console.error('Failed to get balance:', e);
    return '0';
  } finally {
    wallet.free();
  }
}

function formatNano(value: string, decimals = 9, fractionDigits = 4): string {
  let amount = 0n;
  try {
    amount = BigInt(value);
  } catch {
    return '0.0000';
  }
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const frac = amount % base;
  const fracScaled = (frac * 10n ** BigInt(fractionDigits)) / base;
  return `${whole}.${fracScaled.toString().padStart(fractionDigits, '0')}`;
}
