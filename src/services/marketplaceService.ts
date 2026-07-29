/**
 * marketplaceService.ts
 *
 * P2P маркетплейс для торговли картами.
 *
 * Версия 2: данные хранятся в Supabase (таблица marketplace_listings),
 * поэтому листинги видны всем игрокам.
 */

import type { Card } from '../types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
 * Получить все активные листинги.
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
 * Получить листинги конкретного продавца.
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
 * Выставить карту на продажу.
 */
export async function createListing(
  card: Card,
  priceNackl: number,
  sellerId: string,
  sellerName: string,
): Promise<Listing | null> {
  const client = getClient();
  if (!client) {
    console.warn('[marketplaceService] Supabase not configured');
    return null;
  }

  if (!card.uid) {
    console.warn('[marketplaceService] createListing: card has no uid');
    return null;
  }
  if (priceNackl <= 0) {
    console.warn('[marketplaceService] createListing: price must be positive');
    return null;
  }

  const { data, error } = await client
    .from('marketplace_listings')
    .insert({
      card,
      price_nackl: priceNackl,
      seller_id: sellerId,
      seller_name: sellerName,
    })
    .select()
    .single();

  if (error) {
    console.error('[marketplaceService] createListing error:', error);
    return null;
  }
  return data;
}

/**
 * Купить карту с маркетплейса.
 *
 * Атомарная операция: удаляем листинг только если продавец НЕ равен покупателю.
 * Если два игрока пытаются купить одновременно — один получит листинг, второй ошибку.
 */
export async function buyListing(
  listingId: string,
  buyerId: string,
): Promise<{ success: boolean; card?: Card; error?: string }> {
  const client = getClient();
  if (!client) {
    return { success: false, error: 'Supabase не настроен' };
  }

  // Атомарная операция: удаляем строку где id совпадает и seller_id НЕ равен покупателю
  const { data: deleted, error } = await client
    .from('marketplace_listings')
    .delete()
    .eq('id', listingId)
    .neq('seller_id', buyerId)
    .select()
    .single();

  if (error) {
    // Если ничего не удалили — значит листинг не найден или это своя карта
    if (error.code === 'PGRST116') {
      // Проверяем, существует ли листинг
      const { data: existing } = await client
        .from('marketplace_listings')
        .select('seller_id')
        .eq('id', listingId)
        .single();

      if (existing) {
        return { success: false, error: 'Нельзя купить свою карту' };
      }
      return { success: false, error: 'Листинг не найден' };
    }
    console.error('[marketplaceService] buyListing error:', error);
    return { success: false, error: 'Ошибка при покупке' };
  }

  if (!deleted?.card) {
    return { success: false, error: 'Ошибка: карта не найдена' };
  }
  return { success: true, card: deleted.card };
}

/**
 * Отменить листинг (вернуть карту продавцу).
 */
export async function cancelListing(
  listingId: string,
): Promise<{ success: boolean; card?: Card; error?: string }> {
  const client = getClient();
  if (!client) {
    return { success: false, error: 'Supabase не настроен' };
  }

  const { data: deleted, error } = await client
    .from('marketplace_listings')
    .delete()
    .eq('id', listingId)
    .select()
    .single();

  if (error) {
    console.error('[marketplaceService] cancelListing error:', error);
    return { success: false, error: 'Ошибка при отмене' };
  }

  return { success: true, card: deleted?.card };
}

/**
 * Получить количество активных листингов.
 */
export async function getListingCount(): Promise<number> {
  const listings = await getListings();
  return listings.length;
}
