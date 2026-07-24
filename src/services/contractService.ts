/**
 * contractService.ts
 *
 * Сервис для взаимодействия со смарт-контрактами Acki Rivals.
 *
 * ⚠️ ВАЖНО: NACKL — нативный ECC токен с индексом 1 (НЕ TIP-3).
 *    Все платежи идут через sendTransaction на мультифакторном кошельке,
 *    а НЕ через TIP-3 TokenRoot/onAcceptTokensTransfer.
 *    Marketplace.sol требует переписывания под ECC механику.
 *
 * ⚠️ wallet.run() не существует в bee-sdk.
 *    Все on-chain вызовы теперь используют @eversdk/core.
 *
 * После деплоя контрактов в Shellnet, подставь их адреса в .env:
 *   VITE_COLLECTION_ADDRESS=0:...
 *   VITE_GAMEMATCH_ADDRESS=0:...
 *   VITE_PVPSTAKING_ADDRESS=0:...
 *   VITE_MARKETPLACE_ADDRESS=0:...
 */

import type { WalletConnection } from './beeEngine';
import {
  initTvmSdk,
  createClient,
  MULTIFACTOR_ABI,
} from './tvmSdkService';
import {
  getStoredMiningKeys,
  requestMiningKeys,
  storeMiningKeys,
  ENDPOINTS,
  APP_ID,
  API_URL,
} from './beeEngine';

// ─── Конфигурация ──────────────────────────────────────

export const COLLECTION_ADDRESS = import.meta.env.VITE_COLLECTION_ADDRESS || '';
export const GAMEMATCH_ADDRESS = import.meta.env.VITE_GAMEMATCH_ADDRESS || '';
export const PVPSTAKING_ADDRESS = import.meta.env.VITE_PVPSTAKING_ADDRESS || '';
export const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || '';
export const API_BASE = import.meta.env.VITE_API_URL || API_URL;
export const CHAIN_ENDPOINTS = ENDPOINTS;

// ─── ABI для вызовов контрактов ─────────────────────────
// (заглушки, заполняются после компиляции через sold)
// TODO: сгенерировать ABI из sold-компиляции контрактов

export const COLLECTION_ABI = {
  'ABI version': 2,
  version: '2.3',
  header: ['pubkey', 'time', 'expire'],
  functions: [
    {
      name: 'mint',
      inputs: [
        { name: 'gameCardId', type: 'uint256' },
        { name: 'data', type: 'tuple' },
        { name: 'to', type: 'address' },
      ],
      outputs: [{ name: 'tokenId', type: 'uint256' }, { name: 'tokenAddress', type: 'address' }],
    },
    {
      name: 'mintBatch',
      inputs: [
        { name: 'gameCardIds', type: 'uint256[]' },
        { name: 'data', type: 'tuple[]' },
        { name: 'to', type: 'address' },
      ],
      outputs: [],
    },
    {
      name: 'totalSupply',
      inputs: [],
      outputs: [{ name: 'totalSupply', type: 'uint256' }],
    },
    {
      name: 'tokenAddresses',
      inputs: [{ name: 'tokenId', type: 'uint256' }],
      outputs: [{ name: 'addr', type: 'address' }],
    },
  ],
  data: [],
  events: [],
};

export const MARKETPLACE_ABI = {
  'ABI version': 2,
  version: '2.3',
  header: ['pubkey', 'time', 'expire'],
  functions: [
    {
      name: 'list',
      inputs: [
        { name: 'tokenAddress', type: 'address' },
        { name: 'price', type: 'uint256' },
      ],
      outputs: [],
    },
    {
      name: 'buy',
      inputs: [{ name: 'tokenAddress', type: 'address' }],
      outputs: [],
    },
    {
      name: 'cancel',
      inputs: [{ name: 'tokenAddress', type: 'address' }],
      outputs: [],
    },
    {
      name: 'listings',
      inputs: [],
      outputs: [{ name: 'listings', type: 'map(address,uint256)' }],
    },
  ],
  data: [],
  events: [],
};

// ─── Получение ключей для подписи ───────────────────────

async function getSignerKeys(conn: WalletConnection): Promise<{ public: string; secret: string }> {
  const stored = getStoredMiningKeys(conn.profileAddress);
  if (stored) {
    return { public: stored.ownerPublic, secret: stored.ownerSecret };
  }
  const keys = await requestMiningKeys(conn);
  storeMiningKeys(conn.profileAddress, {
    ownerPublic: keys.ownerPublic,
    ownerSecret: keys.ownerSecret,
    minerAddress: null,
    areKeysPropagated: false,
  });
  return { public: keys.ownerPublic, secret: keys.ownerSecret };
}

// ─── NFT Mint ───────────────────────────────────────────

export interface MintResult {
  success: boolean;
  tokenId?: number;
  tokenAddress?: string;
  txHash?: string;
  error?: string;
}

/**
 * Заминтить карту как NFT через прямой вызов контракта Collection.
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
  to?: string,
): Promise<MintResult> {
  if (!COLLECTION_ADDRESS) {
    return {
      success: false,
      error: 'Collection address not configured. Set VITE_COLLECTION_ADDRESS in .env',
    };
  }

  try {
    await initTvmSdk();
    const signerKeys = await getSignerKeys(conn);
    const client = createClient('mainnet');

    try {
      const result = await client.processing.process_message({
        message_encode_params: {
          address: COLLECTION_ADDRESS,
          abi: { type: 'Contract', value: COLLECTION_ABI },
          call_set: {
            function_name: 'mint',
            input: {
              gameCardId,
              data: { cardId: gameCardId, ...data },
              to: to || conn.walletAddress,
            },
          },
          signer: { type: 'Keys', keys: signerKeys },
          processing_try_index: 1,
        },
        send_events: false,
      });

      return {
        success: true,
        tokenId: result.decoded?.output?.tokenId,
        tokenAddress: result.decoded?.output?.tokenAddress,
        txHash: result.transaction?.id,
      };
    } finally {
      client.close();
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
  to?: string,
): Promise<MintResult> {
  if (!COLLECTION_ADDRESS) {
    return { success: false, error: 'Collection address not configured.' };
  }

  try {
    await initTvmSdk();
    const signerKeys = await getSignerKeys(conn);
    const client = createClient('mainnet');

    try {
      const result = await client.processing.process_message({
        message_encode_params: {
          address: COLLECTION_ADDRESS,
          abi: { type: 'Contract', value: COLLECTION_ABI },
          call_set: {
            function_name: 'mintBatch',
            input: {
              gameCardIds: cards.map((c) => c.gameCardId),
              data: cards.map((c) => ({ cardId: c.gameCardId, ...c.data })),
              to: to || conn.walletAddress,
            },
          },
          signer: { type: 'Keys', keys: signerKeys },
          processing_try_index: 1,
        },
        send_events: false,
      });

      return {
        success: true,
        txHash: result.transaction?.id,
      };
    } finally {
      client.close();
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

/**
 * Выставить карту на продажу.
 */
export async function listCard(
  conn: WalletConnection,
  tokenAddress: string,
  priceNano: string,
): Promise<{ success: boolean; error?: string }> {
  if (!MARKETPLACE_ADDRESS) {
    return { success: false, error: 'Marketplace not configured.' };
  }

  try {
    await initTvmSdk();
    const signerKeys = await getSignerKeys(conn);
    const client = createClient('mainnet');

    try {
      await client.processing.process_message({
        message_encode_params: {
          address: MARKETPLACE_ADDRESS,
          abi: { type: 'Contract', value: MARKETPLACE_ABI },
          call_set: {
            function_name: 'list',
            input: {
              tokenAddress,
              price: priceNano,
            },
          },
          signer: { type: 'Keys', keys: signerKeys },
          processing_try_index: 1,
        },
        send_events: false,
      });
      return { success: true };
    } finally {
      client.close();
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
 * Отправляет NACKL (ECC index 1) через sendTransaction на мультифакторном кошельке.
 *
 * ⚠️ Marketplace.sol написан под TIP-3 — пока не работает с ECC NACKL.
 *    После переписывания контракта — buy будет принимать NACKL через cc.
 */
export async function buyCard(
  conn: WalletConnection,
  tokenAddress: string,
  priceNano: string,
): Promise<{ success: boolean; error?: string }> {
  if (!MARKETPLACE_ADDRESS) {
    return { success: false, error: 'Marketplace not configured.' };
  }

  try {
    await initTvmSdk();
    const signerKeys = await getSignerKeys(conn);
    const client = createClient('mainnet');

    try {
      // Отправляем sendTransaction с NACKL через cc + payload для маркетплейса
      // flag = 3 — обычная отправка, газ списывается с отправителя
      const result = await client.processing.process_message({
        message_encode_params: {
          address: conn.walletAddress,
          abi: { type: 'Contract', value: MULTIFACTOR_ABI },
          call_set: {
            function_name: 'sendTransaction',
            input: {
              dest: MARKETPLACE_ADDRESS,
              value: '0',
              cc: { '1': priceNano },
              bounce: false,
              flags: 3,
              payload: tokenAddress, // payload = адрес NFT для покупки
            },
          },
          signer: { type: 'Keys', keys: signerKeys },
          processing_try_index: 1,
        },
        send_events: false,
      });

      console.log('[contractService] buyCard success:', result.transaction?.id);
      return { success: true };
    } finally {
      client.close();
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
  tokenAddress: string,
): Promise<{ success: boolean; error?: string }> {
  if (!MARKETPLACE_ADDRESS) {
    return { success: false, error: 'Marketplace not configured.' };
  }

  try {
    await initTvmSdk();
    const signerKeys = await getSignerKeys(conn);
    const client = createClient('mainnet');

    try {
      await client.processing.process_message({
        message_encode_params: {
          address: MARKETPLACE_ADDRESS,
          abi: { type: 'Contract', value: MARKETPLACE_ABI },
          call_set: {
            function_name: 'cancel',
            input: { tokenAddress },
          },
          signer: { type: 'Keys', keys: signerKeys },
          processing_try_index: 1,
        },
        send_events: false,
      });
      return { success: true };
    } finally {
      client.close();
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
              collection { address }
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
export async function getCardMetadata(
  tokenAddress: string,
): Promise<Record<string, unknown> | null> {
  try {
    const query = JSON.stringify({
      query: `{
        blockchain {
          account(address: "${tokenAddress}") {
            info { name codeHash }
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
