/**
 * api/balance/deposit.ts — POST: пополнение игрового баланса.
 *
 * Body: { player: "0:hex64", expectedNano: "5000000000" }
 *
 * Игрок заявляет сумму (вводит в игре и переводит ровно эту сумму на ник
 * казначейства). Сервер ищет в ленте казначейства НЕЗАЧИСЛЕННЫЙ платёж
 * РОВНО этой суммы (по src игрока не отличить — у всех переводов на
 * майнете src = адрес казначейства) и зачисляет его первому, кто успел
 * (атомарность — уникальный msg_hash в balance_ledger).
 *
 * 🔒 БЕЗОПАСНОСТЬ (закрыто 09.08): эндпоинт требует валидный токен сессии
 * заявителя (Authorization: Bearer). Раньше любой, зная адрес, мог
 * «заявить» чужой платёж и забрать его на баланс жертвы.
 *
 * Ответ:
 *   200 — { success, depositedNano, balanceNano }
 *   202 — платёж не найден (клиент ретраит)
 *   401 — нет/невалидный токен сессии
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TREASURY_ADDR, isDev } from '../../api-lib/config.js';
import { scanAllPayments, isValidAddress } from '../../api-lib/validate.js';
import { creditDeposit } from '../../api-lib/balance.js';
import { getSupabase, requireAuth, unauthorized } from '../../api-lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const player = String(body.player || '').trim();
  const expectedNano = String(body.expectedNano || '').trim();
  if (!isValidAddress(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:" + 64 hex' });
  }
  if (!/^\d+$/.test(expectedNano)) {
    return res.status(400).json({ error: 'expectedNano: ожидается целое число нано' });
  }
  const amountNano = BigInt(expectedNano);
  if (amountNano <= 0n) {
    return res.status(400).json({ error: 'expectedNano: должно быть больше 0' });
  }

  try {
    const supabase = getSupabase();
    if (!supabase && !isDev) {
      return res.status(500).json({ error: 'База не настроена (SUPABASE_* env)' });
    }
    // ── 0. Только владелец сессии может заявить платёж на свой адрес ──
    if (supabase) {
      const auth = await requireAuth(req, supabase, player);
      if (unauthorized(res, auth)) return;
    }

    // ── 1. Ищем платежи ровно заявленной суммы ──
    let payments: Awaited<ReturnType<typeof scanAllPayments>> | null = null;
    try {
      payments = await scanAllPayments(amountNano, TREASURY_ADDR);
    } catch (e) {
      console.error('[balance/deposit] GraphQL error:', e);
      return res.status(202).json({ error: 'Сеть блокчейна временно недоступна, пробуем ещё раз', retryAfterMs: 5000 });
    }

    if (!payments || payments.length === 0) {
      return res.status(202).json({ error: `Платёж на ${Number(amountNano) / 1e9} NACKL не найден. Убедитесь, что перевели ровно эту сумму`, retryAfterMs: 5000 });
    }

    // ── 2. Зачисляем первый ещё не зачисленный платёж ──
    //    (порядок: от свежих к старым; duplicate = платёж уже забрал другой игрок)
    let depositedNano = 0n;
    let balanceNano = 0n;
    for (const p of payments) {
      if (supabase) {
        const r = await creditDeposit(supabase, player, p.amountNano, p.msgHash);
        if (r.duplicate) continue;
        depositedNano = r.creditedNano;
        balanceNano = r.balanceNano;
        break;
      } else {
        depositedNano = p.amountNano;
        balanceNano += p.amountNano;
        break;
      }
    }
    if (depositedNano === 0n) {
      return res.status(202).json({ error: 'Платёж уже обработан другим игроком', retryAfterMs: 5000 });
    }

    return res.status(200).json({ success: true, depositedNano: depositedNano.toString(), balanceNano: balanceNano.toString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    console.error('[balance/deposit]', msg);
    return res.status(500).json({ error: msg });
  }
}
