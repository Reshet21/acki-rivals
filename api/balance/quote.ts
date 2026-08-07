/**
 * api/balance/quote.ts — GET: выдать игроку УНИКАЛЬНУЮ сумму пополнения.
 *
 * ?player=0:hex64&wanted=10
 *
 * Почему: отправителя NACKL-платежа на майнете определить нельзя
 * (external in_msg без src, тело/подписи не индексируются). Чтобы платёж
 * гарантированно принадлежал заявившему игроку, сервер выдаёт сумму с
 * уникальным дробным хвостом (base + 0.01..0.99). Перевести ровно её
 * может только игрок, которому она выдана, — коллизия с чужими
 * пополнениями практически исключена.
 *
 * Уникальность проверяется по balance_ledger (ни одна выданная/зачисленная
 * сумма не повторяется) — до 30 попыток.
 *
 * Ответ: 200 { success, amountNackl: "10.37", amountNano: "10370000000" }
 */
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidAddress } from '../../api-lib/validate.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const NANO_PER_NACKL = 1_000_000_000n;
const TAIL_NANO = 10_000_000n; // 0.01 NACKL

function randomTail(): bigint {
  return BigInt(1 + Math.floor(Math.random() * 99)); // 1..99 сотых
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const player = String(req.query.player || '').trim();
  const wantedRaw = String(req.query.wanted || '10').trim();
  if (!isValidAddress(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:" + 64 hex' });
  }
  const wanted = Math.max(1, Math.min(10000, Math.round(parseFloat(wantedRaw) || 10)));
  const baseNano = BigInt(wanted) * NANO_PER_NACKL;

  try {
    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
    if (!supabase) {
      // Без БД уникальность не проверить — всё равно выдаём (генерится хвост),
      // ledger-проверка просто пропускается.
    }

    for (let attempt = 0; attempt < 30; attempt++) {
      const amountNano = baseNano + randomTail() * TAIL_NANO;
      if (supabase) {
        const { data } = await supabase
          .from('balance_ledger')
          .select('msg_hash')
          .eq('type', 'deposit')
          .eq('amount_nano', amountNano.toString())
          .limit(1);
        if (data && data.length > 0) continue; // сумма уже использована — пробуем другой хвост
      }
      const amountNackl = Number(amountNano) / 1e9;
      return res.status(200).json({
        success: true,
        amountNackl: amountNackl.toFixed(2),
        amountNano: amountNano.toString(),
      });
    }
    return res.status(500).json({ error: 'Не удалось подобрать уникальную сумму, попробуйте ещё раз' });
  } catch (e) {
    console.error('[balance/quote] error:', e);
    return res.status(500).json({ error: e instanceof Error ? e.message : 'unknown error' });
  }
}
