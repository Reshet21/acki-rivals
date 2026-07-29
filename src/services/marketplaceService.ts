/**
 * marketplaceService.ts
 *
 * P2P маркетплейс для торговли картами.
 *
 * Версия 1: localStorage — листинги хранятся локально, видны только текущему игроку.
 * Это позволяет протестировать UI покупки/продажи без деплоя контрактов.
 *
 * Версия 2 (после деплоя): on-chain через Marketplace.sol + GraphQL indexer.
 * Тогда listCard/buyCard/cancelListing из contractService.ts станут рабочими.
 *
 * Логика:
 *   - listCard: добавляет карту в листинги, убирает из коллекции продавца
 *   - buyCard: забирает карту из листингов, добавляет в коллекцию покупателя
 *   - cancelListing: убирает из листингов, возвращает в коллекцию продавца
 */

import type { Card } from '../types';

const LISTINGS_KEY = 'acki-rivals-marketplace-listings';

export interface Listing {
  id: string;
  card: Card;
  priceNackl: number;
  sellerId: string;
  sellerName: string;
  createdAt: number;
}

// ─── Storage ────────────────────────────────────────────

function readListings(): Listing[] {
  try {
    const raw = localStorage.getItem(LISTINGS_KEY);
    return raw ? (JSON.parse(raw) as Listing[]) : [];
  } catch {
    return [];
  }
}

function writeListings(listings: Listing[]): void {
  localStorage.setItem(LISTINGS_KEY, JSON.stringify(listings));
}

// ─── Public API ─────────────────────────────────────────

/**
 * Получить все активные листинги.
 */
export function getListings(): Listing[] {
  return readListings().sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Получить листинги конкретного продавца.
 */
export function getMyListings(sellerId: string): Listing[] {
  return readListings()
    .filter((l) => l.sellerId === sellerId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Выставить карту на продажу.
 * Карта удаляется из localStorage-коллекции продавца и появляется в листингах.
 *
 * @param card Карта для продажи (с uid)
 * @param priceNackl Цена в NACKL
 * @param sellerId ID продавца (wallet address или 'anonymous')
 * @param sellerName Имя продавца (wallet name или 'Игрок')
 * @returns Созданный листинг или null при ошибке
 */
export function createListing(
  card: Card,
  priceNackl: number,
  sellerId: string,
  sellerName: string,
): Listing | null {
  if (!card.uid) {
    console.warn('[marketplaceService] createListing: card has no uid');
    return null;
  }
  if (priceNackl <= 0) {
    console.warn('[marketplaceService] createListing: price must be positive');
    return null;
  }

  // Проверяем, не выставлена ли уже эта карта
  const listings = readListings();
  if (listings.some((l) => l.card.uid === card.uid)) {
    console.warn('[marketplaceService] createListing: card already listed');
    return null;
  }

  const listing: Listing = {
    id: 'lst_' + crypto.randomUUID().slice(0, 12),
    card: { ...card },
    priceNackl,
    sellerId,
    sellerName,
    createdAt: Date.now(),
  };

  writeListings([...listings, listing]);
  return listing;
}

/**
 * Купить карту с маркетплейса.
 * В dev-режиме (без блокчейна) — просто переносит карту в коллекцию покупателя.
 * В live-режиме — здесь будет вызов contractService.buyCard().
 *
 * @param listingId ID листинга
 * @param buyerId ID покупателя
 * @returns Купленная карта или null при ошибке
 */
export function buyListing(
  listingId: string,
  buyerId: string,
): { success: boolean; card?: Card; error?: string } {
  const listings = readListings();
  const idx = listings.findIndex((l) => l.id === listingId);

  if (idx === -1) {
    return { success: false, error: 'Листинг не найден' };
  }

  const listing = listings[idx];

  if (listing.sellerId === buyerId) {
    return { success: false, error: 'Нельзя купить свою карту' };
  }

  // Удаляем из листингов
  listings.splice(idx, 1);
  writeListings(listings);

  return { success: true, card: { ...listing.card } };
}

/**
 * Отменить листинг (вернуть карту в коллекцию продавца).
 *
 * @param listingId ID листинга
 * @returns Карта, возвращённая в коллекцию, или null при ошибке
 */
export function cancelListing(
  listingId: string,
): { success: boolean; card?: Card; error?: string } {
  const listings = readListings();
  const idx = listings.findIndex((l) => l.id === listingId);

  if (idx === -1) {
    return { success: false, error: 'Листинг не найден' };
  }

  const listing = listings[idx];
  listings.splice(idx, 1);
  writeListings(listings);

  return { success: true, card: { ...listing.card } };
}

/**
 * Получить количество активных листингов.
 */
export function getListingCount(): number {
  return readListings().length;
}
