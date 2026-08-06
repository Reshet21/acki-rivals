/**
 * api/balance/deposit.ts — POST: пополнение игрового баланса.
 *
 * Body: { player: "0:hex64" }
 *
 * Сканирует блокчейн на ВСЕ NACKL-платежи от player на казначейство,
 * которых ещё нет в balance_ledger (анти-повтор по msg_hash), и зачисляет
 * их на игровой баланс. Возвращает зачисленное и новый баланс.
 *
 * Ответ: { success: true, depositedNano, balanceNano, pending: number }
 *   200 — есть новые зачисления (или всё уже зачислено)
 *   202 — блокчейн недоступен/платежей пока нет (клиент ретраит)
 */
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TREASURY_ADDR, isDev } from '../lib/config.js';
import { scanAllPayments, isValidAddress } from '../lib/validate.js';
import { creditDeposit, getBalance } from '../lib/balance.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const MIN_DEPOSIT_NANO = 1n; // любой платёж с NACKL >= 1 нано

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const player = String(body.player || '').trim();
  if (!isValidAddress(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:" + 64 hex' });
  }

  try {
    // ── 1. Найти все платежи игрока на казначейство ──
    let payments: Awaited<ReturnType<typeof scanAllPayments>> | null = null;
    try {
      payments = await scanAllPayments(MIN_DEPOSIT_NANO, TREASURY_ADDR, player);
    } catch (e) {
      console.error('[balance/deposit] GraphQL error:', e);
      return res.status(202).json({ error: 'Сеть блокчейна временно недоступна, пробуем ещё раз', retryAfterMs: 5000 });
    }

    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
    if (!supabase && !isDev) {
      return res.status(500).json({ error: 'База не настроена (SUPABASE_* env)' });
    }

    if (!payments || payments.length === 0) {
      return res.status(202).json({ error: 'Платёж не найден или ещё не подтверждён', retryAfterMs: 5000 });
    }

    // ── 2. Зачислить каждый необработанный платёж ──
    let depositedNano = 0n;
    let duplicates = 0;
    let balanceNano = 0n;
    for (const p of payments) {
      if (supabase) {
        const r = await creditDeposit(supabase, player, p.amountNano, p.msgHash);
        if (r.duplicate) {
          duplicates++;
          continue;
        }
        depositedNano += r.creditedNano;
        balanceNano = r.balanceNano;
      } else {
        // dev: без БД просто считаем сумму
        depositedNano += p.amountNano;
        balanceNano += p.amountNano;
      }
    }
    if (supabase && duplicates === payments.length) {
      // все платежи уже были зачислены ранее
      balanceNano = await getBalance(supabase, player);
    }

    return res.status(200).json({ success: true, depositedNano: depositedNano.toString(), balanceNano: balanceNano.toString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    console.error('[balance/deposit]', msg);
    return res.status(500).json({ error: msg });
  }
}
