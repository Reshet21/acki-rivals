/**
 * contractService.ts
 *
 * Сервис для взаимодействия со смарт-контрактами Acki Rivals.
 *
 * ⚠️ NACKL — нативный ECC токен с индексом 1 (НЕ TIP-3).
 * ⚠️ Marketplace.sol написан под TIP-3 — требует переписывания под ECC.
 *
 * On-chain запись (mint, list, buy, cancel) — заглушки до деплоя контрактов.
 * Чтение (getOwnedNFTs, getCardMetadata) — через GraphQL.
 *
 * После деплоя контрактов в Shellnet, подставь их адреса в .env:
 *   VITE_COLLECTION_ADDRESS=0:...
 *   VITE_MARKETPLACE_ADDRESS=0:...
 *   VITE_GAMEMATCH_ADDRESS=0:...
 *   VITE_PVPSTAKING_ADDRESS=0:...
 */

import { ENDPOINTS, API_URL } from './beeEngine';

// ─── Конфигурация ──────────────────────────────────────

export const COLLECTION_ADDRESS =
  import.meta.env.VITE_COLLECTION_ADDRESS || '';
export const MARKETPLACE_ADDRESS =
  import.meta.env.VITE_MARKETPLACE_ADDRESS || '';
export const GAMEMATCH_ADDRESS =
  import.meta.env.VITE_GAMEMATCH_ADDRESS || '';
export const PVPSTAKING_ADDRESS =
  import.meta.env.VITE_PVPSTAKING_ADDRESS || '';
export const API_BASE = import.meta.env.VITE_API_URL || API_URL;
export const CHAIN_ENDPOINTS = ENDPOINTS;

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
 * ⚠️ Требует деплоя Collection.sol и настройки VITE_COLLECTION_ADDRESS.
 */
export async function mintCard(
  _gameCardId: number,
  _data: {
    name: string;
    power: number;
    damage: number;
    ability: string;
    rarity: string;
    clan: string;
    uri: string;
  },
): Promise<MintResult> {
  if (!COLLECTION_ADDRESS) {
    return {
      success: false,
      error:
        'Collection not deployed. Set VITE_COLLECTION_ADDRESS in .env',
    };
  }
  return {
    success: false,
    error: 'Mint requires on-chain integration — TODO after contract deployment',
  };
}

/**
 * Заминтить несколько карт за раз (макс 8).
 * ⚠️ Требует деплоя Collection.sol.
 */
export async function mintCardsBatch(): Promise<MintResult> {
  if (!COLLECTION_ADDRESS) {
    return {
      success: false,
      error: 'Collection not deployed.',
    };
  }
  return {
    success: false,
    error: 'Batch mint requires on-chain integration — TODO',
  };
}

// ─── Маркетплейс ────────────────────────────────────────

/**
 * Выставить карту на продажу.
 * ⚠️ Требует деплоя Marketplace.sol.
 */
export async function listCard(
  _tokenAddress: string,
  _priceNano: string,
): Promise<{ success: boolean; error?: string }> {
  if (!MARKETPLACE_ADDRESS) {
    return { success: false, error: 'Marketplace not configured.' };
  }
  return {
    success: false,
    error: 'Marketplace on-chain integration — TODO',
  };
}

/**
 * Купить карту с маркетплейса.
 */
export async function buyCard(
  _tokenAddress: string,
  _priceNano: string,
): Promise<{ success: boolean; error?: string }> {
  if (!MARKETPLACE_ADDRESS) {
    return { success: false, error: 'Marketplace not configured.' };
  }
  return {
    success: false,
    error: 'Marketplace on-chain integration — TODO',
  };
}

/**
 * Отменить листинг.
 */
export async function cancelListing(
  _tokenAddress: string,
): Promise<{ success: boolean; error?: string }> {
  if (!MARKETPLACE_ADDRESS) {
    return { success: false, error: 'Marketplace not configured.' };
  }
  return {
    success: false,
    error: 'Marketplace on-chain integration — TODO',
  };
}

// ─── Чтение данных с блокчейна ─────────────────────────

/**
 * Получить адреса всех NFT карт пользователя через GraphQL.
 */
export async function getOwnedNFTs(
  walletAddress: string,
): Promise<string[]> {
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
      .filter(
        (n: any) =>
          n.collection?.address === COLLECTION_ADDRESS.toLowerCase(),
      )
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
