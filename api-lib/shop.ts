/**
 * api/pvp/shop.ts — магазин PvP-предметов за NACKL (nanoTON).
 *
 * GET /shop → список предметов (id, имя, описание, цена, иконка)
 * POST /shop { player, itemId } → покупка: сервер списывает баланс
 *   (player_balances.balance_nano) и начисляет предмет.
 *
 * Предметы сейчас: 'pvp_pillz_1' — запас маны +1 (постоянно).
 * ШТРАФ: цены заданы в SHOP_ITEMS (api-lib/constants.ts) — сервер
 * НЕ доверяет ценам от клиента.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from './auth.js';
import { isValidAddress } from './validate.js';
import { SHOP_ITEMS } from './constants.js';

const ANON_ID_RE = /^p_[a-z0-9]{1,16}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabase();

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, items: SHOP_ITEMS });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const player = String(body.player || '').trim();
  const itemId = String(body.itemId || '').trim();

  if (!isValidAddress(player) && !ANON_ID_RE.test(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:hex64" или "p_xxx"' });
  }

  const auth = await requireAuth(req, supabase, player);
  if (unauthorized(res, auth)) return;

  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return res.status(404).json({ error: 'Предмет не найден' });

  try {
    const { data: user } = await supabase!
      .from('player_balances')
      .select('balance_nano, pillz_boost')
      .eq('player', player)
      .maybeSingle();
    if (!user) return res.status(404).json({ error: 'Игрок не найден' });

    const balance = Number(user.balance_nano ?? 0);
    if (balance < item.priceNano) {
      return res.status(400).json({ error: 'Недостаточно NACKL' });
    }

    const { error: updateErr } = await supabase!
      .from('player_balances')
      .update({
        balance_nano: (balance - item.priceNano).toString(),
        pillz_boost: Number(user.pillz_boost ?? 0) + (item.pillzBoost ?? 0),
      })
      .eq('player', player);
    if (updateErr) return res.status(500).json({ error: `player_balances: ${updateErr.message}` });

    return res.status(200).json({
      success: true,
      balanceNano: String(balance - item.priceNano),
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
