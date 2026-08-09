/**
 * api/pvp/settle.ts — POST: расчёт ставки PvP. Победитель забирает банк.
 *
 * Body: { gameId: string, winner: "0:hex64" } (winner — адрес игрока-победителя)
 *
 * Ответ:
 *   200 — { success, balanceNano } (банк переведён победителю)
 *   400 — невалидный запрос / нечего расчитывать
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
  const gameId = String(body.gameId || '').trim();
  const winner = String(body.winner || '').trim();

  if (!gameId) {
    return res.status(400).json({ error: 'gameId обязателен' });
  }
  if (!isValidAddress(winner)) {
    return res.status(400).json({ error: 'winner: ожидается "0:" + 64 hex' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase не настроен' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // Ставку может расчитать только игрок-участник (не посторонний).
    const { data: stake, error: stakeError } = await supabase
      .from('pvp_stakes')
      .select('player')
      .eq('game_id', gameId)
      .eq('player', winner)
      .maybeSingle();
    if (stakeError) {
      return res.status(500).json({ error: `pvp_stakes: ${stakeError.message}` });
    }
    if (!stake) {
      return res.status(403).json({ error: 'Победитель не участник этой комнаты' });
    }

    const { data, error } = await supabase.rpc('settle_stake', {
      p_game_id: gameId,
      p_winner: winner,
    });

    if (error) {
      return res.status(500).json({ error: `settle_stake RPC: ${error.message}` });
    }
    if (data === null) {
      return res.status(400).json({ error: 'Нечего расчитывать (ставок нет или уже расчитано)' });
    }
    return res.status(200).json({ success: true, balanceNano: data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
