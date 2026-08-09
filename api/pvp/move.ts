/**
 * api/pvp/move.ts — POST: отправить ход раунда. СЕРВЕРНЫЙ РЕЗОЛВ.
 *
 * Body: { player, gameId, round, cardUid, pillz }
 *
 * Сервер:
 *  1. проверяет токен сессии, участие в игре, статус 'active'
 *  2. валидирует ход: round == state.round, pillz 0..min(12, мой запас),
 *     карта (uid) реально в МОЕЙ колоде и ещё не использовалась
 *  3. сохраняет ход (unique game+round+player — повторный ход 409)
 *  4. когда ходы обоих игроков получены — СЕРВЕР считает раунд
 *     (resolvePvpRound из api-lib/battle), применяет HP, пишет state.
 *     При KO/окончании — завершает матч: расчёт ставки + лидерборд.
 *
 * Клиент НИКОГДА не присылает результат раунда — только свой ход.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from '../../api-lib/auth.js';
import { isValidAddress } from '../../api-lib/validate.js';
import { getGameRow, isParticipant, isValidGameId, stateOf, finalizeMatch, type GameRow } from '../../api-lib/pvp.js';
import { resolvePvpRound, applyRoundDamageToState } from '../../api-lib/battle/resolve.js';
import type { Card } from '../../api-lib/battle/types.js';

const ANON_ID_RE = /^p_[a-z0-9]{1,16}$/;
const UID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_PILLZ = 99;
const TOTAL_HP = 50;
const TOTAL_ROUNDS = 5;
const STARTING_PILLZ = 12;
const FREE_PILLZ_PER_ROUND = 1;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const player = String(body.player || '').trim();
  const gameId = String(body.gameId || '').trim();
  const round = Number(body.round);
  const cardUid = String(body.cardUid || '').trim();
  const pillz = Number(body.pillz);

  if (!isValidAddress(player) && !ANON_ID_RE.test(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:hex64" или "p_xxx"' });
  }
  if (!isValidGameId(gameId)) return res.status(400).json({ error: 'gameId: ожидается UUID' });
  if (!Number.isInteger(round) || round < 1) return res.status(400).json({ error: 'round: целое >= 1' });
  if (!UID_RE.test(cardUid)) return res.status(400).json({ error: 'cardUid: ожидается uid карты' });
  if (!Number.isInteger(pillz) || pillz < 0) return res.status(400).json({ error: 'pillz: целое >= 0' });

  const supabase = getSupabase();
  const auth = await requireAuth(req, res, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    const game = await getGameRow(supabase!, gameId);
    if (!game) return res.status(404).json({ error: 'Игра не найдена' });
    if (!isParticipant(game, player)) return res.status(403).json({ error: 'Вы не участник этой игры' });
    if (game.status !== 'active') return res.status(409).json({ error: 'Игра уже завершена' });

    const state = stateOf(game);
    if (state.phase === 'ended') return res.status(409).json({ error: 'Игра уже завершена' });
    if (state.round !== round) return res.status(409).json({ error: `Неверный раунд: ожидается ${state.round}` });

    const isHost = game.host_id === player;
    const myDeck = (isHost ? game.host_deck : game.guest_deck) as Card[];
    const myPillz = Number(isHost ? state.hostPillz : state.guestPillz);

    // Буст маны (магазин): кап = 12 + pillz_boost
    const { data: myBal } = await supabase!.from('player_balances').select('pillz_boost').eq('player', player).maybeSingle();
    const myCap = STARTING_PILLZ + Number(myBal?.pillz_boost ?? 0);

    if (pillz > Math.min(myCap, myPillz)) {
      return res.status(400).json({ error: `pillz: максимум ${Math.min(myCap, myPillz)}` });
    }

    const card = myDeck.find((c) => c.uid === cardUid);
    if (!card) return res.status(400).json({ error: 'Карта не найдена в вашей колоде' });

    // Карта уже ходила в этой игре?
    const { data: usedMoves } = await supabase!.from('moves')
      .select('id').eq('game_id', gameId).eq('card_uid', cardUid).limit(1);
    if (usedMoves && usedMoves.length > 0) {
      return res.status(409).json({ error: 'Эта карта уже использована в бою' });
    }

    // Сохраняем ход (повторный ход того же игрока в раунде — 409 от unique)
    const { error: insertErr } = await supabase!.from('moves').insert({
      game_id: gameId,
      player_id: player,
      round,
      card_id: card.id,
      card_uid: cardUid,
      pillz,
    });
    if (insertErr) {
      const msg = String(insertErr.message || insertErr.code || '');
      if (msg.toLowerCase().includes('duplicate') || String(insertErr.code) === '23505') {
        // Гонка: ход уже записан. Если это ТОТ ЖЕ ход — успех (идемпотентность).
        const { data: mine } = await supabase!.from('moves')
          .select('card_uid, pillz').eq('game_id', gameId).eq('round', round).eq('player_id', player).maybeSingle();
        if (mine && mine.card_uid === cardUid && Number(mine.pillz) === pillz) {
          // дальше резолв: падаем вниз как обычно
        } else {
          return res.status(409).json({ error: 'Ход уже отправлен' });
        }
      } else {
        return res.status(500).json({ error: `moves: ${insertErr.message}` });
      }
    }

    // Ждём ход оппонента
    const { data: moves } = await supabase!.from('moves')
      .select('*').eq('game_id', gameId).eq('round', round).order('created_at');
    if (!moves || moves.length < 2) {
      return res.status(200).json({ success: true, waitingOpponent: true, state });
    }

    // ── Оба хода получены: серверный резолв ──
    const hostMove = moves.find((m: any) => m.player_id === game.host_id);
    const guestMove = moves.find((m: any) => m.player_id === game.guest_id);
    if (!hostMove || !guestMove) return res.status(500).json({ error: 'Ходы оппонентов не совпадают' });

    const hostCard = (game.host_deck as Card[]).find((c) => c.uid === hostMove.card_uid);
    const guestCard = (game.guest_deck as Card[]).find((c) => c.uid === guestMove.card_uid);
    if (!hostCard || !guestCard) return res.status(500).json({ error: 'Карты раунда не найдены в колодах' });

    // Буст маны из магазина (+N к стартовому запасу)
    const { data: hostBal } = await supabase!.from('player_balances').select('pillz_boost').eq('player', game.host_id).maybeSingle();
    const { data: guestBal } = await supabase!.from('player_balances').select('pillz_boost').eq('player', game.guest_id).maybeSingle();
    const hostCap = STARTING_PILLZ + Number(hostBal?.pillz_boost ?? 0);
    const guestCap = STARTING_PILLZ + Number(guestBal?.pillz_boost ?? 0);

    const rr = resolvePvpRound({
      hostCard, hostPillz: Number(hostMove.pillz),
      guestCard, guestPillz: Number(guestMove.pillz),
      hostDeck: game.host_deck as Card[],
      guestDeck: game.guest_deck as Card[],
    });

    const outcome = applyRoundDamageToState(Number(state.hostHP), Number(state.guestHP), rr, TOTAL_HP);

    const nextHostPillz = Math.min(hostCap, Number(state.hostPillz) - Number(hostMove.pillz) + FREE_PILLZ_PER_ROUND);
    const nextGuestPillz = Math.min(guestCap, Number(state.guestPillz) - Number(guestMove.pillz) + FREE_PILLZ_PER_ROUND);

    const newState: Record<string, unknown> = {
      phase: 'ended',
      round,
      hostHP: outcome.hostHP,
      guestHP: outcome.guestHP,
      hostPillz: Math.max(0, nextHostPillz),
      guestPillz: Math.max(0, nextGuestPillz),
      lastResolvedRound: round,
      roundResult: {
        hostCardId: rr.hostCardId,
        guestCardId: rr.guestCardId,
        hostPillzUsed: rr.hostPillzUsed,
        guestPillzUsed: rr.guestPillzUsed,
        hostAttack: rr.hostAttack,
        guestAttack: rr.guestAttack,
        hostBasePower: rr.hostBasePower,
        hostFinalPower: rr.hostFinalPower,
        guestBasePower: rr.guestBasePower,
        guestFinalPower: rr.guestFinalPower,
        winner: rr.winner,
        damage: rr.damage,
        healAmount: rr.healAmount,
        poisonAmount: rr.poisonAmount,
        lifeStealAmount: rr.lifeStealAmount,
        opponentDamageReduction: rr.opponentDamageReduction,
        hostCard: { ...hostCard, uid: undefined },
        guestCard: { ...guestCard, uid: undefined },
      },
    };

    const matchOver = outcome.ended || round >= TOTAL_ROUNDS;
    if (!matchOver) {
      newState.phase = 'select';
      newState.round = round + 1;
    }

    if (!matchOver) {
      const { error: updateErr } = await supabase!.from('games').update({ state: newState }).eq('id', gameId);
      if (updateErr) return res.status(500).json({ error: `state update: ${updateErr.message}` });
      return res.status(200).json({ success: true, state: newState });
    }

    // ── Матч завершён: определяем победителя по HP ──
    let winner: string | null = null;
    let loser: string | null = null;
    let draw = false;
    if (outcome.hostHP > outcome.guestHP) { winner = game.host_id; loser = game.guest_id!; }
    else if (outcome.guestHP > outcome.hostHP) { winner = game.guest_id!; loser = game.host_id; }
    else draw = true;

    newState.phase = 'ended';
    const fin = await finalizeMatch(supabase!, game, newState, winner || '', loser || '');

    if (draw && Number(game.stake_nano || '0') > 0) {
      await supabase!.rpc('refund_stake', { p_game_id: gameId, p_player: game.host_id }).catch(() => {});
      await supabase!.rpc('refund_stake', { p_game_id: gameId, p_player: game.guest_id }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      state: newState,
      ended: true,
      winner,
      draw,
      settleError: fin.settleError,
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
