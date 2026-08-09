/**
 * marketplaceService.ts
 *
 * P2P маркетплейс для торговли картами.
 *
 * Чтение листингов — напрямую из Supabase (публичный магазин).
 * Запись (выставить/купить/отменить) — ТОЛЬКО через серверные эндпоинты
 * с токеном сессии (Authorization: Bearer): api/marketplace/{list,buy,cancel}.
 * Раньше клиент писал напрямую с anon-ключом — любой мог выставить карту
 * от чужого имени и удалить чужие листинги (дыра закрыта 09.08).
 */

import type { Card } from '../types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSessionToken, ensureSession } from './pvpService';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

export interface Listing {
  id: string;
  card: Card;
  price_nackl: number;
  seller_id: string;
  seller_name: string;
  created_at: string;
}

// ─── Public API ─────────────────────────────────────────

/**
 * Получить все активные листинги (публичное чтение).
 */
export async function getListings(): Promise<Listing[]> {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from('marketplace_listings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[marketplaceService] getListings error:', error);
    return [];
  }
  return data || [];
}

/**
 * Получить листинги конкретного продавца (публичное чтение).
 */
export async function getMyListings(sellerId: string): Promise<Listing[]> {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from('marketplace_listings')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[marketplaceService] getMyListings error:', error);
    return [];
  }
  return data || [];
}

/**
 * Выставить карту на продажу — сервер валидирует карту/цену и требует
 * токен сессии продавца.
 */
export async function createListing(
  card: Card,
  priceNackl: number,
  sellerId: string,
  sellerName: string,
): Promise<Listing | null> {
  if (!card.uid) {
    console.warn('[marketplaceService] createListing: card has no uid');
    return null;
  }
  if (priceNackl <= 0) {
    console.warn('[marketplaceService] createListing: price must be positive');
    return null;
  }

  try {
    await ensureSession(sellerId);
    const res = await fetch('/api/marketplace/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getSessionToken()}`,
      },
      body: JSON.stringify({ seller: sellerId, sellerName, card, priceNackl }),
    });
    const json = (await res.json()) as { success?: boolean; listing?: Listing; error?: string };
    if (!res.ok || !json.success) {
      console.error('[marketplaceService] createListing error:', json.error || res.status);
      return null;
    }
    return json.listing || null;
  } catch {
    console.error('[marketplaceService] createListing: network error');
    return null;
  }
}

/**
 * Купить карту с маркетплейса за игровой баланс.
 *
 * Серверная атомарная операция (RPC marketplace_purchase):
 * списывает цену с игрового баланса покупателя, зачисляет продавцу,
 * удаляет листинг. Требует токен сессии покупателя.
 */
export async function buyListing(
  listingId: string,
  buyerId: string,
): Promise<{ success: boolean; card?: Card; balanceNackl?: number; error?: string }> {
  try {
    await ensureSession(buyerId);
    const res = await fetch('/api/marketplace/buy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getSessionToken()}`,
      },
      body: JSON.stringify({ listingId, buyer: buyerId }),
    });
    const json = (await res.json()) as {
      success?: boolean;
      card?: Card | null;
      balanceNano?: string;
      error?: string;
    };
    if (res.status === 402) {
      return { success: false, error: json.error || 'Недостаточно средств' };
    }
    if (res.ok && json.success) {
      return {
        success: true,
        card: json.card ?? undefined,
        balanceNackl: json.balanceNano ? Number(json.balanceNano) / 1e9 : undefined,
      };
    }
    return { success: false, error: json.error || 'Ошибка покупки' };
  } catch {
    return { success: false, error: 'Сеть недоступна' };
  }
}

/**
 * Отменить листинг (вернуть карту продавцу) — сервер проверяет, что
 * листинг принадлежит sellerId (чужой отменить нельзя).
 */
export async function cancelListing(
  listingId: string,
  sellerId: string,
): Promise<{ success: boolean; card?: Card; error?: string }> {
  try {
    await ensureSession(sellerId);
    const res = await fetch('/api/marketplace/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getSessionToken()}`,
      },
      body: JSON.stringify({ listingId, seller: sellerId }),
    });
    const json = (await res.json()) as { success?: boolean; card?: Card | null; error?: string };
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Ошибка при отмене' };
    }
    return { success: true, card: json.card ?? undefined };
  } catch {
    return { success: false, error: 'Сеть недоступна' };
  }
}

/**
 * Получить количество активных листингов.
 */
export async function getListingCount(): Promise<number> {
  const listings = await getListings();
  return listings.length;
}
