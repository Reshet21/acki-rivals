/**
 * api-lib/deck.ts — серверная валидация колод и карт.
 *
 * Коллекция игрока живёт в localStorage (клиентская), поэтому сервер
 * не может проверить "владение" картой — но он обязан проверить, что
 * карта ВООБЩЕ СУЩЕСТВУЕТ в каталоге и её статы не подделаны:
 * каждая карта нормализуется против каталога (id/name/clan/power/damage/
 * ability/rarity берутся из каталога, а не от клиента).
 */
import type { Card } from './battle-types.js';
import { getCardById, MAX_STARS } from './battle-cards.js';

export const DECK_SIZE = 10;
export const MAX_PILLZ = 12;

const UID_RE = /^[A-Za-z0-9_-]{6,64}$/;

/**
 * Нормализовать и проверить колоду. Возвращает либо нормализованную
 * колоду (статы из каталога, stars в 0..MAX_STARS), либо null.
 * Требования: ровно DECK_SIZE карт, все карты из каталога, уникальные uid.
 */
export function validateDeck(raw: unknown): Card[] | null {
  if (!Array.isArray(raw) || raw.length !== DECK_SIZE) return null;

  const deck: Card[] = [];
  const seenUids = new Set<string>();
  const seenIds = new Set<string>();

  for (const item of raw) {
    const card = normalizeCard(item);
    if (!card) return null;

    const uid = card.uid || '';
    if (!UID_RE.test(uid)) return null;
    if (seenUids.has(uid)) return null;
    seenUids.add(uid);

    const key = `${card.id}:${uid}`;
    if (seenIds.has(key)) return null;
    seenIds.add(key);

    deck.push(card);
  }

  return deck;
}

/**
 * Нормализовать карту против каталога. Принимает только реальные поля
 * карты (uid, stars — клиентские; всё остальное — из каталога).
 * Возвращает null, если карта не существует в каталоге или uid битый.
 */
export function normalizeCard(raw: unknown): Card | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const id = Number(r.id);
  if (!Number.isInteger(id)) return null;
  const catalog = getCardById(id);
  if (!catalog) return null;

  const uid = typeof r.uid === 'string' ? r.uid.trim() : '';
  if (!UID_RE.test(uid)) return null;

  const stars = r.stars === undefined || r.stars === null ? 0 : Number(r.stars);
  if (!Number.isInteger(stars) || stars < 0 || stars > MAX_STARS) return null;

  return { ...catalog, uid, stars };
}

/** Проверить цену листинга (NACKL): 0.01 .. 100000 */
export function isValidPrice(price: unknown): price is number {
  if (typeof price !== 'number' || !Number.isFinite(price)) return false;
  return price >= 0.01 && price <= 100_000;
}
