/**
 * api/pvp/surrender.ts — POST: сдаться в PvP.
 *
 * Body: { player, gameId }
 *
 * Сервер завершает игру в пользу оппонента, расчитывает ставку
 * (банк — победителю) и обновляет лидерборд. Игрок не может «сдаться
 * в свою пользу» — исход всегда честный.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from '../../api-lib/auth.js';
import { isValidAddress } from '../../api-lib/validate.js';
import { getGameRow, isParticipant, isValidGameId, stateOf, finalizeMatch } from '../../api-lib/pvp.js';

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
  const auth = await requireAuth(req, res, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    const game = await getGameRow(supabase!, gameId);
    if (!game) return res.status(404).json({ error: 'Игра не найдена' });
    if (!isParticipant(game, player)) return res.status(403).json({ error: 'Вы не участник этой игры' });
    if (game.status === 'finished' || stateOf(game).phase === 'ended') {
      return res.status(409).json({ error: 'Игра уже завершена' });
    }

    const state = stateOf(game);
    const isHost = game.host_id === player;
    const newState: Record<string, unknown> = {
      ...state,
      phase: 'ended',
      // Сдавшийся проигрывает: его HP = 0
      hostHP: isHost ? 0 : state.hostHP,
      guestHP: isHost ? state.guestHP : 0,
    };

    const winner = isHost ? game.guest_id! : game.host_id;
    await finalizeMatch(supabase!, game, newState, winner, player);

    return res.status(200).json({ success: true, ended: true, winner });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
