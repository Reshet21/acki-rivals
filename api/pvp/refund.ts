/**
 * api/pvp/refund.ts — POST: возврат ставки PvP (отмена комнаты / дезертирство).
 *
 * Body: { player: "0:hex64", gameId: string }
 *
 * Ответ:
 *   200 — { success, balanceNano } (возврат выполнен, либо нечего возвращать)
 */
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidAddress } from '../../api-lib/validate.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const player = String(body.player || '').trim();
  const gameId = String(body.gameId || '').trim();

  if (!isValidAddress(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:" + 64 hex' });
  }
  if (!gameId) {
    return res.status(400).json({ error: 'gameId обязателен' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase не настроен' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc('refund_stake', {
      p_game_id: gameId,
      p_player: player,
    });

    if (error) {
      return res.status(500).json({ error: `refund_stake RPC: ${error.message}` });
    }
    return res.status(200).json({ success: true, balanceNano: data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
