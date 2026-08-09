/**
 * api/pvp/abandon.ts — POST: объявить оппонента дезертиром.
 *
 * Body: { player, gameId }
 *
 * Победа присуждается ТОЛЬКО если оппонент не отправил ход в текущем
 * раунде (state.round) — сервер проверяет по таблице moves. Если ход
 * оппонента есть — 409 (игра продолжается).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from './auth.js';
import { isValidAddress } from './validate.js';
import { getGameRow, isParticipant, isValidGameId, stateOf, opponentOf, finalizeMatch } from './pvp.js';

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
    if (game.status === 'finished' || stateOf(game).phase === 'ended') {
      return res.status(409).json({ error: 'Игра уже завершена' });
    }

    const state = stateOf(game);
    const opp = opponentOf(game, player);
    if (!opp) return res.status(409).json({ error: 'У вас пока нет соперника' });

    // Оппонент не ходил в текущем раунде?
    const { data: oppMoves } = await supabase!.from('moves')
      .select('id').eq('game_id', gameId).eq('round', state.round).eq('player_id', opp).limit(1);
    if (oppMoves && oppMoves.length > 0) {
      return res.status(409).json({ error: 'Оппонент уже сходил — игра продолжается' });
    }

    const isHost = game.host_id === player;
    const newState: Record<string, unknown> = {
      ...state,
      phase: 'ended',
      hostHP: isHost ? state.hostHP : 0,
      guestHP: isHost ? 0 : state.guestHP,
    };

    await finalizeMatch(supabase!, game, newState, player, opp);

    return res.status(200).json({ success: true, ended: true, winner: player });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
