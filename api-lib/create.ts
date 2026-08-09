/**
 * api/pvp/create.ts — POST: создать PvP-комнату.
 *
 * Body: { player: "0:hex64"|"p_xxx", name?: string, deck: Card[], stakeNano: "0"|"nano" }
 *
 * Сервер:
 *  1. проверяет токен сессии (player из тела должен совпадать с токеном)
 *  2. валидирует колоду по каталогу (ровно 10 карт, статы из каталога)
 *  3. создаёт комнату (status waiting) со ставкой из ЗАПРОСА (хост сам её
 *     платит) — гость позже платит ТУ ЖЕ ставку из БД (см. join.ts)
 *  4. резервирует ставку хоста; при неудаче — откатывает комнату
 *
 * Ответ: 200 { success, game } | 402 (не хватает средств) | 400 | 401 | 500
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from './auth.js';
import { isValidAddress } from './validate.js';
import { validateDeck } from './deck.js';

const ANON_ID_RE = /^p_[a-z0-9]{1,16}$/;
const NANO_RE = /^\d+$/;
const MAX_STAKE_NANO = 1_000_000n * 1_000_000_000n; // 1 000 000 NACKL

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const player = String(body.player || '').trim();
  const name = String(body.name || '').trim().slice(0, 40);
  const stakeNano = String(body.stakeNano || '0').trim();

  if (!isValidAddress(player) && !ANON_ID_RE.test(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:hex64" или "p_xxx"' });
  }
  if (!NANO_RE.test(stakeNano)) return res.status(400).json({ error: 'stakeNano: целое число нано' });
  const stake = BigInt(stakeNano);
  if (stake < 0n || stake > MAX_STAKE_NANO) return res.status(400).json({ error: 'stakeNano вне допустимого диапазона' });

  const deck = validateDeck(body.deck);
  if (!deck) return res.status(400).json({ error: 'deck: ровно 10 валидных карт из каталога с уникальными uid' });

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    const { data: game, error: createErr } = await supabase!.from('games')
      .insert({
        host_id: player,
        host_name: name || null,
        host_deck: deck,
        status: 'waiting',
        stake_nano: stakeNano,
        state: { phase: 'waiting', round: 1, hostHP: 50, guestHP: 50, hostPillz: 12, guestPillz: 12 },
      })
      .select()
      .single();
    if (createErr) return res.status(500).json({ error: `create game: ${createErr.message}` });

    // Резерв ставки хоста (то, что он заявил). Если не хватает — откат комнаты.
    if (stake > 0n) {
      const { data: newBalance, error: reserveErr } = await supabase!.rpc('reserve_stake', {
        p_game_id: game.id,
        p_player: player,
        p_amount_nano: stakeNano,
      });
      if (reserveErr) {
        await supabase!.from('games').delete().eq('id', game.id);
        return res.status(500).json({ error: `reserve_stake: ${reserveErr.message}` });
      }
      if (newBalance === null) {
        await supabase!.from('games').delete().eq('id', game.id);
        return res.status(402).json({ success: false, error: 'Недостаточно средств на игровом балансе' });
      }
    }

    return res.status(200).json({ success: true, game });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
