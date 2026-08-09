/**
 * api/marketplace/buy.ts — POST: покупка карты маркетплейса за игровой баланс.
 *
 * Body: { listingId: "uuid", buyer: "0:hex64" }
 *
 * Сервер вызывает атомарную RPC marketplace_purchase:
 * списывает цену с покупателя, зачисляет продавцу, удаляет листинг.
 * Цена берётся из БД (клиент не передаёт сумму).
 *
 * Ответ:
 *   200 — { success: true, card, balanceNano }
 *   402 — недостаточно средств / продавец == покупатель / листинг не найден
 *   500 — ошибка БД
 */
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isDev } from '../../api-lib/config.js';
import { isValidAddress } from '../../api-lib/validate.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const listingId = String(body.listingId || '').trim();
  const buyer = String(body.buyer || '').trim();

  if (!UUID_RE.test(listingId)) {
    return res.status(400).json({ error: 'listingId: ожидается UUID' });
  }
  if (!isValidAddress(buyer)) {
    return res.status(400).json({ error: 'buyer: ожидается "0:" + 64 hex' });
  }

  if (!supabaseUrl || !supabaseKey) {
    if (isDev) {
      // dev без БД: покупка «бесплатна», карту клиент берёт из листинга
      return res.status(200).json({ success: true, card: null, balanceNano: '0', dev: true });
    }
    return res.status(500).json({ error: 'Supabase не настроен' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc('marketplace_purchase', {
      p_listing_id: listingId,
      p_buyer: buyer,
    });

    if (error) {
      return res.status(500).json({ error: `marketplace_purchase RPC: ${error.message}` });
    }

    const result = data as { success?: boolean; card?: unknown; balanceNano?: string; error?: string };
    if (!result?.success) {
      return res.status(402).json({ success: false, error: result?.error || 'Покупка не удалась' });
    }
    return res.status(200).json({ success: true, card: result.card ?? null, balanceNano: result.balanceNano ?? '0' });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
