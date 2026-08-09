/**
 * api/pvp/reserve.ts — POST: резерв ставки PvP с игрового баланса.
 *
 * Body: { player: "0:hex64", gameId: string, stakeNano: string }
 *
 * Ответ:
 *   200 — { success, balanceNano } (ставка зарезервирована)
 *   402 — недостаточно средств
 *   400 — невалидный запрос
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
  const stakeNano = String(body.stakeNano || '').trim();

  if (!isValidAddress(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:" + 64 hex' });
  }
  if (!gameId) {
    return res.status(400).json({ error: 'gameId обязателен' });
  }
  if (!/^\d+$/.test(stakeNano)) {
    return res.status(400).json({ error: 'stakeNano: ожидается целое число нано' });
  }
  if (BigInt(stakeNano) <= 0n) {
    return res.status(400).json({ error: 'stakeNano должен быть > 0' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase не настроен' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc('reserve_stake', {
      p_game_id: gameId,
      p_player: player,
      p_amount_nano: stakeNano,
    });

    if (error) {
      return res.status(500).json({ error: `reserve_stake RPC: ${error.message}` });
    }
    if (data === null) {
      return res.status(402).json({ error: 'Недостаточно средств на игровом балансе', success: false });
    }
    return res.status(200).json({ success: true, balanceNano: data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
