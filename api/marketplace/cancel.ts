/**
 * api/marketplace/cancel.ts — POST: снять свою карту с продажи.
 *
 * Body: { seller: "0:hex64", listingId: "uuid" }
 *
 * 🔒 БЕЗОПАСНОСТЬ (закрыто 09.08): эндпоинт требует валидный токен сессии
 * продавца. Сервер удаляет листинг ТОЛЬКО если seller_id == продавец
 * (раньше клиент мог удалить ЛЮБОЙ чужой листинг напрямую в Supabase).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from '../../api-lib/auth.js';
import { isValidAddress } from '../../api-lib/validate.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const seller = String(body.seller || '').trim();
  const listingId = String(body.listingId || '').trim();

  if (!isValidAddress(seller)) {
    return res.status(400).json({ error: 'seller: ожидается "0:" + 64 hex' });
  }
  if (!UUID_RE.test(listingId)) {
    return res.status(400).json({ error: 'listingId: ожидается UUID' });
  }

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, seller);
  if (unauthorized(res, auth)) return;

  try {
    // Проверяем владельца листинга
    const { data: listing } = await supabase!
      .from('marketplace_listings')
      .select('seller_id')
      .eq('id', listingId)
      .maybeSingle();
    if (!listing) return res.status(404).json({ error: 'Листинг не найден' });
    if (listing.seller_id !== seller) {
      return res.status(403).json({ error: 'Нельзя отменить чужой листинг' });
    }

    const { data: deleted, error } = await supabase!
      .from('marketplace_listings')
      .delete()
      .eq('id', listingId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: `cancel: ${error.message}` });
    return res.status(200).json({ success: true, card: deleted?.card ?? null });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
