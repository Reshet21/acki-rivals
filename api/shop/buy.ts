/**
 * api/shop/buy.ts — POST: подтверждение покупки пака за NACKL прямым переводом.
 *
 * Body: { player: "0:hex64", nacklAmount: number, packId: string }
 *
 * Игрок отправляет NACKL обычным переводом на казначейство M со своего
 * кошелька (не обязательно игрового — подходит любой, где есть NACKL),
 * затем клиент опрашивает этот эндпоинт:
 *
 * 1) ищется свежий входящий NACKL-платёж на M:
 *    сначала от игрового адреса (player), затем любой (по сумме+времени);
 * 2) анти-повтор через Supabase (treasury_orders, msgHash UNIQUE);
 * 3) паки открывает клиент — сервер только подтверждает платёж.
 *
 * Ответ 202 — платёж ещё не найден на блокчейне (клиент ретраит).
 */
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TREASURY_ADDR, isDev } from '../lib/config.js';
import { findAnyPayment, findPayment, isValidAddress } from '../lib/validate.js';

/** Цены паков в NACKL (дублируются из src/data/packs.ts) */
const PACK_PRICES: Record<string, number> = {
  basic: 5,
  standard: 7,
  advanced: 10,
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

function nano(value: number): string {
  return BigInt(Math.round(value * 1e9)).toString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const player = String(body.player || '').trim();
  const nacklAmount = Number(body.nacklAmount);
  const packId = String(body.packId || '').trim();

  const price = PACK_PRICES[packId];
  if (!price) {
    return res.status(400).json({ error: 'packId: ожидается basic | standard | advanced' });
  }
  if (!isValidAddress(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:" + 64 hex' });
  }
  if (!Number.isFinite(nacklAmount) || nacklAmount < price) {
    return res.status(400).json({ error: `nacklAmount: не менее ${price} NACKL` });
  }

  try {
    // ── 1. Найти платёж: сначала от игрового адреса, затем с любого кошелька ──
    let payment: Awaited<ReturnType<typeof findPayment>> = null;
    try {
      const amountNano = BigInt(nano(price));
      payment =
        (await findPayment(player, amountNano, TREASURY_ADDR)) ||
        (await findAnyPayment(amountNano, TREASURY_ADDR));
    } catch (e) {
      // сеть/GraphQL нестабильны (майнет отдаёт HTML/502) — клиент продолжит опрос
      console.error('[shop/buy] GraphQL error:', e);
      return res.status(202).json({ error: 'Сеть блокчейна временно недоступна, пробуем ещё раз', retryAfterMs: 5000 });
    }
    if (!payment) {
      return res.status(202).json({ error: 'Платёж не найден или ещё не подтверждён', retryAfterMs: 5000 });
    }

    // ── 2. Анти-повтор ──
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
    if (supabase) {
      const { error } = await supabase
        .from('treasury_orders')
        .insert({ msg_hash: payment.msgHash, player, nackl_amount: payment.amountNano.toString(), ackr_amount: 0, status: 'done' })
        .select('id')
        .single();
      if (error && String(error.message || error.code || '').toLowerCase().includes('duplicate')) {
        return res.status(409).json({ error: 'Платёж уже обработан' });
      }
      if (error) {
        return res.status(500).json({ error: `supabase: ${error.message}` });
      }
    } else if (!isDev) {
      return res.status(500).json({ error: 'Анти-повтор не настроен (SUPABASE_* env)' });
    }

    return res.status(200).json({ success: true, packId, price });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    return res.status(500).json({ error: msg });
  }
}
