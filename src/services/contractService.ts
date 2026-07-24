/**
 * contractService.ts
 *
 * Сервис для взаимодействия со смарт-контрактами Acki Rivals.
 *
 * После деплоя контрактов в Shellnet, подставь их адреса в .env:
 *   VITE_COLLECTION_ADDRESS=0:...
 *   VITE_GAMEMATCH_ADDRESS=0:...
 *   VITE_PVPSTAKING_ADDRESS=0:...
 *   VITE_MARKETPLACE_ADDRESS=0:...
 *   VITE_NACKL_TOKEN_ROOT=0:...  (адрес NACKL TIP-3 токена в сети)
 */

import type { WalletConnection } from './beeEngine';
import { ENDPOINTS, APP_ID, API_URL } from './beeEngine';

// ─── Конфигурация ──────────────────────────────────────

export const COLLECTION_ADDRESS = import.meta.env.VITE_COLLECTION_ADDRESS || '';
export const GAMEMATCH_ADDRESS = import.meta.env.VITE_GAMEMATCH_ADDRESS || '';
export const PVPSTAKING_ADDRESS = import.meta.env.VITE_PVPSTAKING_ADDRESS || '';
export const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || '';
export const NACKL_TOKEN_ROOT = import.meta.env.VITE_NACKL_TOKEN_ROOT || '';
export const API_BASE = import.meta.env.VITE_API_URL || API_URL;
export const CHAIN_ENDPOINTS = ENDPOINTS;

// ─── ABI для вызовов контрактов ─────────────────────────
// (заглушки, заполняются после компиляции через sold)

export const COLLECTION_ABI = {
  'mint': { abiVersion: 2, version: '2.3', header: ['pubkey', 'time', 'expire'], functions: [] },
  'mintBatch': { abiVersion: 2, version: '2.3', header: ['pubkey', 'time', 'expire'], functions: [] },
  'totalSupply': { abiVersion: 2, version: '2.3', header: ['pubkey', 'time', 'expire'], functions: [] },
  'tokenAddresses': { abiVersion: 2, version: '2.3', header: ['pubkey', 'time', 'expire'], functions: [] },
};

// ─── NFT Mint ───────────────────────────────────────────

export interface MintResult {
  success: boolean;
  tokenId?: number;
  tokenAddress?: string;
  txHash?: string;
  error?: string;
}

/**
 * Заминтить карту как NFT.
 * @param conn Подключение к кошельку
 * @param gameCardId ID карты в игре (1-44)
 * @param data Метаданные карты
 * @param to Адрес получателя
 */
export async function mintCard(
  conn: WalletConnection,
  gameCardId: number,
  data: {
    name: string;
    power: number;
    damage: number;
    ability: string;
    rarity: string;
    clan: string;
    uri: string;
  },
  to?: string
): Promise<MintResult> {
  if (!COLLECTION_ADDRESS) {
    return { success: false, error: 'Collection address not configured. Set VITE_COLLECTION_ADDRESS in .env' };
  }

  try {
    const sdk = await loadSdk();
    const wallet = new sdk.Wallet(CHAIN_ENDPOINTS, null, API_BASE, APP_ID);

    try {
      const result = await wallet.run({
        session_state_json: conn.sessionStateJson,
        address: COLLECTION_ADDRESS,
        abi: COLLECTION_ABI,
        method: 'mint',
        params: {
          gameCardId,
          data: {
            cardId: gameCardId,
            ...data,
          },
          to: to || conn.walletAddress,
        },
        sign: true,
      });

      return {
        success: true,
        tokenId: result?.tokenId,
        tokenAddress: result?.tokenAddress,
        txHash: result?.transaction?.id,
      };
    } finally {
      wallet.free();
    }
  } catch (e) {
    console.error('mintCard failed:', e);
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unknown mint error',
    };
  }
}

/**
 * Заминтить несколько карт за раз (макс 8).
 */
export async function mintCardsBatch(
  conn: WalletConnection,
  cards: Array<{
    gameCardId: number;
    data: {
      name: string;
      power: number;
      damage: number;
      ability: string;
      rarity: string;
      clan: string;
      uri: string;
    };
  }>,
  to?: string
): Promise<MintResult> {
  if (!COLLECTION_ADDRESS) {
    return { success: false, error: 'Collection address not configured.' };
  }

  try {
    const sdk = await loadSdk();
    const wallet = new sdk.Wallet(CHAIN_ENDPOINTS, null, API_BASE, APP_ID);

    try {
      const result = await wallet.run({
        session_state_json: conn.sessionStateJson,
        address: COLLECTION_ADDRESS,
        abi: COLLECTION_ABI,
        method: 'mintBatch',
        params: {
          gameCardIds: cards.map((c) => c.gameCardId),
          data: cards.map((c) => ({
            cardId: c.gameCardId,
            ...c.data,
          })),
          to: to || conn.walletAddress,
        },
        sign: true,
      });

      return {
        success: true,
        txHash: result?.transaction?.id,
      };
    } finally {
      wallet.free();
    }
  } catch (e) {
    console.error('mintCardsBatch failed:', e);
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unknown batch mint error',
    };
  }
}

// ─── Маркетплейс ────────────────────────────────────────

export interface ListingInfo {
  seller: string;
  tokenAddress: string;
  tokenRoot: string;
  price: string;  // в NACKL (nano)
  active: boolean;
}

export const MARKETPLACE_ABI = {
  'list': { abiVersion: 2, version: '2.3', header: ['pubkey', 'time', 'expire'], functions: [] },
  'buy': { abiVersion: 2, version: '2.3', header: ['pubkey', 'time', 'expire'], functions: [] },
  'cancel': { abiVersion: 2, version: '2.3', header: ['pubkey', 'time', 'expire'], functions: [] },
  'listings': { abiVersion: 2, version: '2.3', header: ['pubkey', 'time', 'expire'], functions: [] },
};

/**
 * Выставить карту на продажу.
 */
export async function listCard(
  conn: WalletConnection,
  tokenAddress: string,
  priceNano: string   // цена в nanoNACKL
): Promise<{ success: boolean; error?: string }> {
  if (!MARKETPLACE_ADDRESS) {
    return { success: false, error: 'Marketplace not configured.' };
  }

  try {
    const sdk = await loadSdk();
    const wallet = new sdk.Wallet(CHAIN_ENDPOINTS, null, API_BASE, APP_ID);

    try {
      await wallet.run({
        session_state_json: conn.sessionStateJson,
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        method: 'list',
        params: {
          tokenAddress,
          _tokenRoot: NACKL_TOKEN_ROOT,
          price: priceNano,
        },
        sign: true,
      });
      return { success: true };
    } finally {
      wallet.free();
    }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to list card',
    };
  }
}

/**
 * Купить карту с маркетплейса.
 */
export async function buyCard(
  conn: WalletConnection,
  tokenAddress: string,
  priceNano: string
): Promise<{ success: boolean; error?: string }> {
  if (!MARKETPLACE_ADDRESS) {
    return { success: false, error: 'Marketplace not configured.' };
  }

  try {
    const sdk = await loadSdk();
    const wallet = new sdk.Wallet(CHAIN_ENDPOINTS, null, API_BASE, APP_ID);

    try {
      // Отправляем NACKL через TIP-3 transfer с payload "buy"
      const tokenWallet = await getNacklWallet(conn);

      const payload = sdk.abi.encode({
        abi: { type: 'Tuple', components: [
          { name: 'action', type: 'string' },
          { name: 'tokenAddress', type: 'address' },
        ]},
        data: { action: 'buy', tokenAddress },
      });

      await wallet.send_tokens_direct({
        session_state_json: conn.sessionStateJson,
        multifactor_address: conn.walletAddress,
        destination_address: MARKETPLACE_ADDRESS,
        token_root: NACKL_TOKEN_ROOT,
        amount: priceNano,
        payload,
      });

      return { success: true };
    } finally {
      wallet.free();
    }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to buy card',
    };
  }
}

/**
 * Отменить листинг.
 */
export async function cancelListing(
  conn: WalletConnection,
  tokenAddress: string
): Promise<{ success: boolean; error?: string }> {
  if (!MARKETPLACE_ADDRESS) {
    return { success: false, error: 'Marketplace not configured.' };
  }

  try {
    const sdk = await loadSdk();
    const wallet = new sdk.Wallet(CHAIN_ENDPOINTS, null, API_BASE, APP_ID);

    try {
      await wallet.run({
        session_state_json: conn.sessionStateJson,
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        method: 'cancel',
        params: { tokenAddress },
        sign: true,
      });
      return { success: true };
    } finally {
      wallet.free();
    }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to cancel listing',
    };
  }
}

// ─── Чтение данных с блокчейна ─────────────────────────

/**
 * Получить адреса всех NFT карт пользователя через GraphQL.
 */
export async function getOwnedNFTs(walletAddress: string): Promise<string[]> {
  try {
    const query = JSON.stringify({
      query: `{
        blockchain {
          account(address: "${walletAddress}") {
            nfts {
              address
              collection {
                address
              }
            }
          }
        }
      }`,
    });

    const res = await fetch(`${CHAIN_ENDPOINTS[0]}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: query,
    });

    if (!res.ok) return [];

    const data = await res.json();
    const nfts = data?.data?.blockchain?.account?.nfts || [];

    // Фильтруем только NFT нашей коллекции
    return nfts
      .filter((n: any) => n.collection?.address === COLLECTION_ADDRESS.toLowerCase())
      .map((n: any) => n.address);
  } catch (e) {
    console.warn('getOwnedNFTs failed:', e);
    return [];
  }
}

/**
 * Получить метаданные карты с её контракта.
 */
export async function getCardMetadata(tokenAddress: string): Promise<{
  owner: string;
  cardId: number;
  name: string;
  power: number;
  damage: number;
  ability: string;
  rarity: string;
  clan: string;
  stars: number;
  uri: string;
} | null> {
  try {
    // Через GraphQL — запрашиваем данные контракта
    const query = JSON.stringify({
      query: `{
        blockchain {
          account(address: "${tokenAddress}") {
            info {
              name
              codeHash
            }
          }
        }
      }`,
    });

    const res = await fetch(`${CHAIN_ENDPOINTS[0]}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: query,
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data?.data?.blockchain?.account?.info || null;
  } catch (e) {
    console.warn('getCardMetadata failed:', e);
    return null;
  }
}

// ─── Utility ────────────────────────────────────────────

let sdkModule: any = null;

async function loadSdk(): Promise<any> {
  if (sdkModule) return sdkModule;
  const mod = await import('@teamgosh/bee-sdk');
  const wasmUrl = new URL('@teamgosh/bee-sdk/bee_sdk_bg.wasm', import.meta.url);
  await mod.default({ module_or_path: wasmUrl });
  sdkModule = mod;
  return sdkModule;
}

/**
 * Получить адрес NACKL TokenWallet для текущего кошелька.
 */
async function getNacklWallet(conn: WalletConnection): Promise<string> {
  const sdk = await loadSdk();
  const wallet = new sdk.Wallet(CHAIN_ENDPOINTS, null, API_BASE, APP_ID);

  try {
    const balances = await wallet.get_multifactor_balances({
      multifactor_address: conn.walletAddress,
    });

    // NACKL обычно на ключе '1' или первом доступном
    if (balances.ecc) {
      const keys = Object.keys(balances.ecc);
      return keys[0] || '';
    }
    return '';
  } finally {
    wallet.free();
  }
}

/**
 * Конвертировать NACKL в nano (умножить на 10^9).
 */
export function nacklToNano(amount: number): string {
  return BigInt(Math.floor(amount * 1e9)).toString();
}

/**
 * Конвертировать nano в NACKL (поделить на 10^9).
 */
export function nanoToNackl(nano: string): number {
  try {
    return Number(BigInt(nano)) / 1e9;
  } catch {
    return 0;
  }
}
