/**
 * api/pvp/settle.ts — POST: расчёт ставки после честного завершения боя.
 *
 * Body: { player, gameId }
 *
 * Победитель НЕ присылается — сервер определяет его из state игры
 * (hostHP/guestHP при status=finished). Это закрывает самопровозглашённые
 * победы и кражу банка посторонними (только участник, только finished).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from './auth.js';
import { isValidAddress } from './validate.js';
import { getGameRow, isParticipant, isValidGameId, stateOf } from './pvp.js';

const ANON_ID_RE = /^p_[a-z0-9]{1,16}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const player = String(body.player || '').trim();
  const gameId = String(body.gameId || '').trim();

  if (!isValidAddress(player) && !ANON_ID_RE.test(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:hex64" или "p_xxx"' });
  }
  if (!isValidGameId(gameId)) return res.status(400).json({ error: 'gameId: ожидается UUID' });

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    const game = await getGameRow(supabase!, gameId);
    if (!game) return res.status(404).json({ error: 'Игра не найдена' });
    if (!isParticipant(game, player)) return res.status(403).json({ error: 'Вы не участник этой игры' });
    if (game.status !== 'finished' || stateOf(game).phase !== 'ended') {
      return res.status(409).json({ error: 'Игра ещё не завершена' });
    }

    const state = stateOf(game);
    let winner: string | null = null;
    if (Number(state.hostHP) > Number(state.guestHP)) winner = game.host_id;
    else if (Number(state.guestHP) > Number(state.hostHP)) winner = game.guest_id;

    if (!winner) {
      return res.status(400).json({ error: 'Ничья — расчитывать нечего (ставки возвращены)' });
    }

    const { data, error } = await supabase!.rpc('settle_stake', {
      p_game_id: gameId,
      p_winner: winner,
    });
    if (error) return res.status(500).json({ error: `settle_stake RPC: ${error.message}` });
    if (data === null) {
      return res.status(400).json({ error: 'Нечего расчитывать (ставок нет или уже расчитано)' });
    }

    return res.status(200).json({ success: true, winner, balanceNano: data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
