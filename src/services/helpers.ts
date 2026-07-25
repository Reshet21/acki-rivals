/**
 * helpers.ts
 *
 * Общие утилиты для работы с блокчейном Acki Nacki.
 *
 * Содержит вынесенные функции, которые используются в разных сервисах,
 * чтобы избежать дублирования кода.
 */

import type { WalletConnection } from './beeEngine';
import {
  getStoredMiningKeys,
  requestMiningKeys,
  storeMiningKeys,
} from './beeEngine';

/**
 * Получить или создать EPK ключи для подписи транзакций.
 *
 * ⚠️ EPK-ключи (эфемерные) имеют ограниченный срок жизни (макс 180 дней).
 * Если ключ просрочен — мультифакторный контракт вернёт exit code 502
 * (ERR_FACTOR_EXPIRED).
 *
 * Стратегия:
 * - Если `forceRefresh = true` — всегда запрашиваем свежие ключи через BeeConnect.
 * - Если `forceRefresh = false` — сначала проверяем localStorage.
 *   Если ключи есть и им меньше 7 дней — используем их.
 *   Иначе — запрашиваем свежие.
 *
 * @param conn — подключение к кошельку (через bee_connect)
 * @param forceRefresh — если true, игнорировать кэш и запросить новые ключи
 * @returns объект { public, secret } с EPK ключами
 */
export async function getSignerKeys(
  conn: WalletConnection,
  forceRefresh = false,
): Promise<{ public: string; secret: string }> {
  const stored = getStoredMiningKeys(conn.profileAddress);

  if (!forceRefresh && stored && !isKeyExpired(stored._timestamp)) {
    return { public: stored.ownerPublic, secret: stored.ownerSecret };
  }

  // Ключей нет / просрочены / принудительно — запрашиваем через BeeConnect
  const keys = await requestMiningKeys(conn);
  storeMiningKeys(conn.profileAddress, {
    ownerPublic: keys.ownerPublic,
    ownerSecret: keys.ownerSecret,
    minerAddress: null,
    areKeysPropagated: false,
    _timestamp: Date.now(),
  });

  return { public: keys.ownerPublic, secret: keys.ownerSecret };
}

/**
 * Проверить, не просрочен ли ключ (по умолчанию 7 дней).
 */
function isKeyExpired(timestamp?: number, maxAgeMs = 7 * 24 * 60 * 60 * 1000): boolean {
  if (!timestamp) return true;
  return Date.now() - timestamp > maxAgeMs;
}

/**
 * Конвертировать NACKL в nano (10^9).
 */
export function toNano(amount: number): string {
  return BigInt(Math.floor(amount * 1e9)).toString();
}
