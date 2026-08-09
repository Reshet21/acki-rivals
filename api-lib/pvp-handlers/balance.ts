/**
 * api/pvp/balance.ts — GET: баланс NACKL (nanoTON).
 *
 * ?player=<addr>
 *
 * Баланс читается из player_balances (та же таблица, что используют
 * депозиты и маркетплейс). Анонимные (p_xxx) и кошельки — единообразно.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from '../auth.js';
import { isValidAddress } from '../validate.js';

const ANON_ID_RE = /^p_[a-z0-9]{1,16}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const player = String(req.query.player || '').trim();
  if (!isValidAddress(player) && !ANON_ID_RE.test(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:hex64" или "p_xxx"' });
  }

  const supabase = getSupabase();
  const auth = await requireAuth(req, res, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    const { data, error } = await supabase!
      .from('player_balances')
      .select('balance_nano')
      .eq('player', player)
      .maybeSingle();
    if (error) return res.status(500).json({ error: `player_balances: ${error.message}` });

    return res.status(200).json({
      success: true,
      balanceNano: data ? String(data.balance_nano ?? 0) : '0',
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}