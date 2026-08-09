/**
 * api/pvp/marketplace.ts — GET: NFT-карты игрока для маркетплейса.
 *
 * ?player=<addr>
 *
 * Отдаёт список карт с рыночными листингами (где листинг есть) и без.
 * Колоды НЕ раскрываются: для маркетплейса не нужен deck игрока.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from '../auth.js';
import { isValidAddress } from '../validate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const player = String(req.query.player || '').trim();
  if (!isValidAddress(player)) return res.status(400).json({ error: 'player: ожидается "0:hex64"' });

  const supabase = getSupabase();
  const auth = await requireAuth(req, res, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    const { data: cards, error: cardsErr } = await supabase!
      .from('cards')
      .select('id, owner_address, name, rarity, attack, defense, health, attributes, created_at, listed_price_nano')
      .eq('owner_address', player)
      .order('created_at', { ascending: false });
    if (cardsErr) return res.status(500).json({ error: `cards: ${cardsErr.message}` });

    return res.status(200).json({ success: true, cards: cards || [] });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
