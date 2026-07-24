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
 * Сначала проверяет сохранённые ключи в localStorage.
 * Если нет — запрашивает через bee_connect (request_set_mining_keys).
 * Кошелёк попросит подтвердить добавление EPK-ключа.
 *
 * @param conn — подключение к кошельку (через bee_connect)
 * @returns объект { public, secret } с EPK ключами
 */
export async function getSignerKeys(
  conn: WalletConnection,
): Promise<{ public: string; secret: string }> {
  const stored = getStoredMiningKeys(conn.profileAddress);
  if (stored) {
    return { public: stored.ownerPublic, secret: stored.ownerSecret };
  }

  // Ключей нет — запрашиваем через BeeConnect
  const keys = await requestMiningKeys(conn);
  storeMiningKeys(conn.profileAddress, {
    ownerPublic: keys.ownerPublic,
    ownerSecret: keys.ownerSecret,
    minerAddress: null,
    areKeysPropagated: false,
  });

  return { public: keys.ownerPublic, secret: keys.ownerSecret };
}

/**
 * Конвертировать NACKL в nano (10^9).
 */
export function toNano(amount: number): string {
  return BigInt(Math.floor(amount * 1e9)).toString();
}
