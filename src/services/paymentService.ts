/**
 * Payment service for NACKL token transactions on Acki Nacki blockchain.
 *
 * Sends NACKL tokens from buyer's wallet to developer wallet for pack purchases.
 */

import type { WalletConnection } from './beeEngine';
import { ENDPOINTS, API_URL, APP_ID } from './beeEngine';

const DEVELOPER_WALLET = '0:d9ed11eaef8f0ec7b475fe29e293bb721cb6a64dfba3fd069b8e2f9303ff6b36';

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
 * Get the NACKL token root address from blockchain balances.
 * Returns the actual token root address from the wallet's balances.
 */
async function getNacklTokenRoot(walletAddress: string): Promise<string | null> {
  const sdk = await getSdk();
  const wallet = new sdk.Wallet(ENDPOINTS, null, API_URL, APP_ID);

  try {
    const balances = await wallet.get_multifactor_balances({
      multifactor_address: walletAddress,
    });

    // Token roots are keys in the ecc map — return the actual address
    if (balances.ecc) {
      const keys = Object.keys(balances.ecc);
      if (keys.length > 0) {
        return keys[0];
      }
    }
    return null;
  } catch (e) {
    console.error('Failed to get NACKL token root:', e);
    return null;
  } finally {
    wallet.free();
  }
}

/**
 * Send NACKL tokens from buyer to developer wallet.
 * Uses the SDK's Wallet.send_tokens_direct method.
 */
export async function buyPack(
  conn: WalletConnection,
  nacklAmount: number,
): Promise<PaymentResult> {
  try {
    const sdk = await getSdk();
    const wallet = new sdk.Wallet(ENDPOINTS, null, API_URL, APP_ID);

    try {
      // Convert NACKL amount to nano (multiply by 10^9)
      const nanoAmount = BigInt(Math.floor(nacklAmount * 1e9)).toString();

      // Get token root for NACKL from wallet balances
      const tokenRoot = await getNacklTokenRoot(conn.walletAddress);
      if (!tokenRoot) {
        return { success: false, error: 'NACKL token not found in wallet. Make sure you have NACKL tokens.' };
      }

      // Send tokens using the SDK
      const result = await wallet.send_tokens_direct({
        session_state_json: conn.sessionStateJson,
        multifactor_address: conn.walletAddress,
        destination_address: DEVELOPER_WALLET,
        token_root: tokenRoot,
        amount: nanoAmount,
      });

      // Update session state if returned
      if (result.updated_session_state_json) {
        conn.sessionStateJson = result.updated_session_state_json;
      }

      return {
        success: true,
        txHash: result.tx_hash || 'pending',
      };
    } finally {
      wallet.free();
    }
  } catch (e) {
    console.error('Payment failed:', e);
    const msg = e instanceof Error ? e.message : 'Unknown payment error';
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Get current NACKL balance from wallet.
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
