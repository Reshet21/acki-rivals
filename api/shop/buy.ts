/**
 * api/shop/buy.ts — POST: покупка пака за игровой баланс (NACKL).
 *
 * Body: { player: "0:hex64", packId: "basic|standard|advanced" }
 *
 * Пополнение баланса — отдельно: api/balance/deposit.ts (блокчейн-перевод
 * на казначейство). Здесь — атомарное списание с баланса игрока
 * (debit_balance RPC: списывает только если средств хватает).
 * Цена берётся СЕРВЕРНАЯ (не доверяем клиенту).
 * Паки открывает клиент — сервер только списывает и подтверждает.
 *
 * Ответ:
 *   200 — { success: true, packId, priceNano, balanceNano }
 *   400 — невалидные параметры
 *   402 — недостаточно средств на балансе
 *   500 — ошибка БД
 */
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isDev } from '../lib/config.js';
import { isValidAddress } from '../lib/validate.js';
import { debitSpend } from '../lib/balance.js';

/** Цены паков в NACKL (дублируются из src/data/packs.ts) */
const PACK_PRICES: Record<string, number> = {
  basic: 5,
  standard: 7,
  advanced: 10,
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

function nano(value: number): bigint {
  return BigInt(Math.round(value * 1e9));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const player = String(body.player || '').trim();
  const packId = String(body.packId || '').trim();

  const price = PACK_PRICES[packId];
  if (!price) {
    return res.status(400).json({ error: 'packId: ожидается basic | standard | advanced' });
  }
  if (!isValidAddress(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:" + 64 hex' });
  }

  try {
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
    if (!supabase) {
      if (isDev) {
        // dev: без БД считаем покупку успешной (анти-повтор не нужен)
        return res.status(200).json({ success: true, packId, priceNano: nano(price).toString(), balanceNano: '0' });
      }
      return res.status(500).json({ error: 'База не настроена (SUPABASE_* env)' });
    }

    // ── 1. Атомарное списание с баланса ──
    const debit = await debitSpend(supabase, player, nano(price), packId);
    if (!debit.success) {
      return res.status(402).json({ error: 'Недостаточно NACKL на игровом балансе', balanceNano: debit.balanceNano.toString() });
    }

    return res.status(200).json({ success: true, packId, priceNano: nano(price).toString(), balanceNano: debit.balanceNano.toString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    console.error('[shop/buy]', msg);
    return res.status(500).json({ error: msg });
  }
}
