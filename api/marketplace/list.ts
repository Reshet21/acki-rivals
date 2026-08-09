/**
 * api/marketplace/list.ts — POST: выставить карту на продажу.
 *
 * Body: { seller: "0:hex64", card: Card, priceNackl: number }
 *
 * 🔒 БЕЗОПАСНОСТЬ (закрыто 09.08): эндпоинт требует валидный токен сессии
 * продавца (Authorization: Bearer). Раньше клиент писал листинги напрямую
 * в Supabase с anon-ключом — любой мог выставить карту от чужого имени.
 *
 * Сервер валидирует цену (0.01..100000) и нормализует карту против
 * каталога (клиент не может подделать статы).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from '../../api-lib/auth.js';
import { isValidAddress } from '../../api-lib/validate.js';
import { normalizeCard, isValidPrice } from '../../api-lib/deck.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const seller = String(body.seller || '').trim();
  const priceNackl = Number(body.priceNackl);
  const rawCard = body.card;

  if (!isValidAddress(seller)) {
    return res.status(400).json({ error: 'seller: ожидается "0:" + 64 hex' });
  }
  if (!isValidPrice(priceNackl)) {
    return res.status(400).json({ error: 'priceNackl: 0.01 .. 100000' });
  }
  const card = normalizeCard(rawCard);
  if (!card || !card.uid) {
    return res.status(400).json({ error: 'card: невалидная карта каталога' });
  }

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, seller);
  if (unauthorized(res, auth)) return;

  try {
    const { data, error } = await supabase!.from('marketplace_listings')
      .insert({
        card,
        price_nackl: priceNackl,
        seller_id: seller,
        seller_name: String(body.sellerName || '').trim().slice(0, 40) || null,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: `list: ${error.message}` });
    return res.status(200).json({ success: true, listing: data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
