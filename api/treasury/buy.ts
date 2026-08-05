/**
 * api/treasury/buy.ts — POST: купить ACKR за NACKL.
 *
 * Body: { player: "0:hex64", nacklAmount: number, clientTxHash?: string }
 *
 * 1) валидирует адрес/сумму,
 * 2) ищет свежий NACKL-платёж игрока на казначейство M (GraphQL),
 * 3) анти-повтор через Supabase (таблица treasury_orders, msgHash UNIQUE),
 * 4) выдаёт ACKR двухфазным TIP-3 переводом,
 * 5) помечает заказ выполненным.
 */
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TREASURY_ADDR, ACKR_PER_NACKL, MIN_NACKL, isDev, ownerKeys } from '../lib/config.js';
import { findPayment, isValidAddress } from '../lib/validate.js';
import { sendAckr } from '../lib/ackr.js';

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

  if (!isValidAddress(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:" + 64 hex' });
  }
  if (!Number.isFinite(nacklAmount) || nacklAmount <= 0) {
    return res.status(400).json({ error: 'nacklAmount: положительное число' });
  }
  if (nacklAmount < MIN_NACKL) {
    return res.status(400).json({ error: `min payment: ${MIN_NACKL} NACKL` });
  }

  if (!ownerKeys()) {
    return res.status(500).json({ error: 'TREASURY_OWNER_PUBLIC/SECRET не заданы на сервере' });
  }

  const ackrAmount = nacklAmount * ACKR_PER_NACKL;

  try {
    // ── 1. Найти платёж на блокчейне ──
    const payment = await findPayment(player, BigInt(nano(nacklAmount)), TREASURY_ADDR);
    if (!payment) {
      return res.status(202).json({ error: 'Платёж не найден или ещё не подтверждён', retryAfterMs: 5000 });
    }

    // ── 2. Анти-повтор ──
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
    let orderId: string | null = null;
    if (supabase) {
      const { data, error } = await supabase
        .from('treasury_orders')
        .insert({ msg_hash: payment.msgHash, player, nackl_amount: payment.amountNano.toString(), ackr_amount: ackrAmount, status: 'processing' })
        .select('id')
        .single();
      if (error && String(error.message || error.code || '').toLowerCase().includes('duplicate')) {
        // уже обрабатывали: если прошлая попытка упала (failed) — даём повторить
        const { data: existing } = await supabase
          .from('treasury_orders')
          .select('id, status')
          .eq('msg_hash', payment.msgHash)
          .maybeSingle();
        if (existing?.status === 'failed') {
          orderId = existing.id;
          await supabase.from('treasury_orders').update({ status: 'processing' }).eq('id', orderId);
        } else {
          return res.status(409).json({ error: 'Платёж уже обработан' });
        }
      } else if (error) {
        return res.status(500).json({ error: `supabase: ${error.message}` });
      } else {
        orderId = data?.id ?? null;
      }
    } else if (!isDev) {
      return res.status(500).json({ error: 'Анти-повтор не настроен (SUPABASE_* env)' });
    }

    // ── 3. Выдача ACKR ──
    try {
      const result = await sendAckr(player, nano(ackrAmount));
      if (supabase && orderId) {
        await supabase.from('treasury_orders').update({ status: 'done' }).eq('id', orderId);
      }
      return res.status(200).json({ success: true, orderId, ackrAmount, ...result });
    } catch (e) {
      if (supabase && orderId) {
        await supabase.from('treasury_orders').update({ status: 'failed' }).eq('id', orderId);
      }
      throw e;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    return res.status(500).json({ error: msg });
  }
}
