/**
 * api/pvp/join.ts — POST: вступить в PvP-комнату.
 *
 * Body: { player, name?, gameId, deck: Card[] }
 *
 * Сервер:
 *  1. проверяет токен сессии
 *  2. валидирует колоду гостя по каталогу
 *  3. комната должна быть в status waiting; хост — НЕ сам игрок
 *  4. гость резервирует ставку РОВНО из БД (games.stake_nano), а не из
 *     запроса — подменить сумму нельзя (анти-чит К-3)
 *  5. комната → status active, записывается гость и его колода
 *
 * Ответ: 200 { success, game } | 402 | 400 | 401 | 409 (занято) | 500
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from '../../api-lib/auth.js';
import { isValidAddress } from '../../api-lib/validate.js';
import { validateDeck } from '../../api-lib/deck.js';
import { getGameRow, isValidGameId } from '../../api-lib/pvp.js';

const ANON_ID_RE = /^p_[a-z0-9]{1,16}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const player = String(body.player || '').trim();
  const name = String(body.name || '').trim().slice(0, 40);
  const gameId = String(body.gameId || '').trim();

  if (!isValidAddress(player) && !ANON_ID_RE.test(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:hex64" или "p_xxx"' });
  }
  if (!isValidGameId(gameId)) return res.status(400).json({ error: 'gameId: ожидается UUID' });

  const deck = validateDeck(body.deck);
  if (!deck) return res.status(400).json({ error: 'deck: ровно 10 валидных карт из каталога с уникальными uid' });

  const supabase = getSupabase();
  const auth = await requireAuth(req, res, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    const game = await getGameRow(supabase!, gameId);
    if (!game) return res.status(404).json({ error: 'Комната не найдена' });
    if (game.status !== 'waiting') return res.status(409).json({ error: 'Комната уже занята или завершена' });
    if (game.host_id === player) return res.status(409).json({ error: 'Нельзя вступить в свою комнату' });

    const stake = BigInt(game.stake_nano || '0');
    if (stake > 0n) {
      const { data: newBalance, error: reserveErr } = await supabase!.rpc('reserve_stake', {
        p_game_id: gameId,
        p_player: player,
        p_amount_nano: game.stake_nano,
      });
      if (reserveErr) return res.status(500).json({ error: `reserve_stake: ${reserveErr.message}` });
      if (newBalance === null) {
        return res.status(402).json({ success: false, error: 'Недостаточно средств на игровом балансе' });
      }
    }

    const { data: updated, error: joinErr } = await supabase!.from('games')
      .update({
        guest_id: player,
        guest_name: name || null,
        guest_deck: deck,
        status: 'active',
        state: { ...(game.state as object), phase: 'select', round: 1 },
      })
      .eq('id', gameId)
      .eq('status', 'waiting')
      .select()
      .single();
    if (joinErr) return res.status(500).json({ error: `join game: ${joinErr.message}` });
    if (!updated) {
      // Гонка: кто-то успел раньше — отменяем ставку
      if (stake > 0n) {
        await supabase!.rpc('refund_stake', { p_game_id: gameId, p_player: player }).catch(() => {});
      }
      return res.status(409).json({ error: 'Комната уже занята' });
    }

    return res.status(200).json({ success: true, game: updated });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
