/**
 * treasuryService.ts — клиент игрового баланса (казначейство).
 *
 * Игрок переводит NACKL на казначейство (ник владельца) — сервер находит
 * платёж в блокчейне и зачисляет на игровой баланс (player_balances).
 * Покупка паков и PvP-предметы списываются с этого баланса.
 *
 * 🔒 Безопасность (09.08): depositNackl шлёт токен сессии — сервер
 * принимает заявку только от владельца токена адреса.
 */
import { getSessionToken, ensureSession } from './pvpService';

/** Казначейство — куда игрок шлёт NACKL (адрес M) */
export const TREASURY_ADDRESS =
  import.meta.env.VITE_TREASURY_ADDRESS ||
  '0:d9ed11eaef8f0ec7b475fe29e293bb721cb6a64dfba3fd069b8e2f9303ff6b36';
/** Ник владельца казначейства — по нему проходят переводы (по адресу AN Wallet просит app id) */
export const TREASURY_NAME = import.meta.env.VITE_TREASURY_NAME || '';

/**
 * Пополнить игровой баланс: сервер ищет в ленте казначейства незачисленный
 * платёж РОВНО amountNackl (отправителя по src не отличить — у всех
 * переводов src = казначейство, поэтому сумма заявки = идентификатор).
 * Платёж идёт несколько секунд — ретраим по retryAfterMs.
 */
export async function depositNackl(
  player: string,
  amountNackl: number,
  maxRetries = 24,
): Promise<{ success: boolean; depositedNackl?: number; balanceNackl?: number; error?: string }> {
  let attempt = 0;
  let retryAfterMs = 5000;
  const expectedNano = BigInt(Math.round(amountNackl * 1e9)).toString();

  while (attempt < maxRetries) {
    attempt += 1;
    try {
      await ensureSession(player);
      const res = await fetch('/api/balance/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getSessionToken()}`,
        },
        body: JSON.stringify({ player, expectedNano }),
      });
      const json = (await res.json()) as {
        success: boolean;
        depositedNano?: string;
        balanceNano?: string;
        error?: string;
        retryAfterMs?: number;
      };

      if (res.ok && json.success) {
        return {
          success: true,
          depositedNackl: json.depositedNano ? Number(json.depositedNano) / 1e9 : 0,
          balanceNackl: json.balanceNano ? Number(json.balanceNano) / 1e9 : 0,
        };
      }
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        return { success: false, error: json.error || 'Ошибка запроса' };
      }
      // 202 (платёж ещё не найден) и 500 (сеть блокчейна) — ждём и пробуем ещё
      retryAfterMs = json.retryAfterMs || retryAfterMs;
      await new Promise((r) => setTimeout(r, retryAfterMs));
    } catch {
      await new Promise((r) => setTimeout(r, retryAfterMs));
    }
  }
  return { success: false, error: 'Таймаут: платёж не найден' };
}

/**
 * Уникальная сумма пополнения: сервер выдаёт базовую сумму с дробным
 * хвостом (напр. 10.37), которую может перевести только этот игрок —
 * платёж гарантированно его (отправителя блокчейн не раскрывает).
 */
export async function fetchDepositQuote(
  player: string,
  wantedNackl = 10,
): Promise<{ amountNackl: number; amountNano: string } | null> {
  try {
    const res = await fetch(`/api/balance/quote?player=${encodeURIComponent(player)}&wanted=${encodeURIComponent(String(wantedNackl))}`);
    const json = (await res.json()) as { success?: boolean; amountNackl?: string; amountNano?: string };
    if (!json.success || !json.amountNackl) return null;
    return { amountNackl: parseFloat(json.amountNackl), amountNano: json.amountNano! };
  } catch {
    return null;
  }
}

/**
 * Текущий игровой баланс в NACKL (0 при ошибке).
 */
export async function getPlayerBalance(player: string): Promise<number> {
  try {
    const res = await fetch(`/api/balance?player=${encodeURIComponent(player)}`);
    const json = (await res.json()) as { success?: boolean; balanceNackl?: number };
    return json?.balanceNackl || 0;
  } catch {
    return 0;
  }
}

/**
 * Купить пак за игровой баланс: сервер атомарно списывает цену
 * (серверная цена пака, клиент не передаёт сумму).
 */
export async function buyWithBalance(
  player: string,
  packId: string,
): Promise<{ success: boolean; balanceNackl?: number; error?: string }> {
  try {
    await ensureSession(player);
    const res = await fetch('/api/shop/buy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getSessionToken()}`,
      },
      body: JSON.stringify({ player, packId }),
    });
    const json = (await res.json()) as {
      success: boolean;
      balanceNano?: string;
      error?: string;
    };
    if (res.ok && json.success) {
      return { success: true, balanceNackl: json.balanceNano ? Number(json.balanceNano) / 1e9 : undefined };
    }
    return { success: false, error: json.error || 'Покупка не удалась' };
  } catch {
    return { success: false, error: 'Сеть недоступна' };
  }
}
