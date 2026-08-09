/**
 * api/pvp/refund.ts — POST: возврат ставки.
 *
 * Body: { player, gameId }
 *
 * Возврат возможен ТОЛЬКО пока комната не началась (status='waiting') —
 * после старта боя ставка уходит в банк и расчитывается сервером
 * победителю. Это закрывает «проиграл → отрефанднулся раньше соперника».
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from './auth.js';
import { isValidAddress } from './validate.js';
import { getGameRow, isParticipant, isValidGameId } from './pvp.js';

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
    if (game.status !== 'waiting') {
      return res.status(409).json({ error: 'Комната уже началась — возврат невозможен' });
    }

    const { data, error } = await supabase!.rpc('refund_stake', {
      p_game_id: gameId,
      p_player: player,
    });
    if (error) return res.status(500).json({ error: `refund_stake RPC: ${error.message}` });

    // Хост отменяет пустую комнату — удаляем её из листа открытых
    if (game.host_id === player && !game.guest_id) {
      try { await supabase!.from('games').delete().eq('id', gameId); } catch {}
    }

    return res.status(200).json({ success: true, balanceNano: data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
