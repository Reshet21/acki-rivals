/**
 * api/pvp/my.ts — GET: мои активные PvP-игры (для восстановления экрана).
 *
 * ?player=<addr>
 *
 * Отдаёт только метаданные (без колод) + state, по которому клиент
 * решает: показать «ждём соперника» или «бой идёт».
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from '../../api-lib/auth.js';
import { isValidAddress } from '../../api-lib/validate.js';

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
    const { data, error } = await supabase!.from('games')
      .select('id, host_id, guest_id, host_name, guest_name, state, status, stake_nano, created_at')
      .or(`host_id.eq.${player},guest_id.eq.${player}`)
      .in('status', ['active'])
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) return res.status(500).json({ error: `games: ${error.message}` });

    return res.status(200).json({ success: true, games: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
