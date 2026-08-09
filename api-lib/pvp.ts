/**
 * api-lib/pvp.ts — общая серверная логика PvP: загрузка игры, проверка
 * участников, завершение матча (расчёт ставок + лидерборд).
 *
 * ВАЖНО: резолв раунда и определение победителя — только здесь (сервер),
 * клиент не участвует. Все изменения состояния пишутся через service role.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface GameRow {
  id: string;
  host_id: string;
  guest_id: string | null;
  host_name: string | null;
  guest_name: string | null;
  host_deck: unknown;
  guest_deck: unknown;
  state: Record<string, unknown>;
  status: string;
  stake_nano: string | null;
  created_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidGameId(id: string): boolean {
  return UUID_RE.test(id);
}

export async function getGameRow(client: SupabaseClient, gameId: string): Promise<GameRow | null> {
  const { data, error } = await client.from('games').select('*').eq('id', gameId).maybeSingle();
  if (error) throw new Error(`games: ${error.message}`);
  return (data as GameRow | null) ?? null;
}

export function isParticipant(game: GameRow, player: string): boolean {
  return game.host_id === player || game.guest_id === player;
}

export function opponentOf(game: GameRow, player: string): string | null {
  if (game.host_id === player) return game.guest_id;
  if (game.guest_id === player) return game.host_id;
  return null;
}

export function stateOf(game: GameRow): Record<string, any> {
  return (game.state || {}) as Record<string, any>;
}

/**
 * Завершить матч: обновить status/state, расчитать ставку (если есть),
 * обновить лидерборд. Вызывается ТОЛЬКО сервером после честного исхода.
 * Возвращает ошибку, если расчёт ставки не удался (для логирования).
 */
export async function finalizeMatch(
  client: SupabaseClient,
  game: GameRow,
  state: Record<string, unknown>,
  winner: string,
  loser: string,
): Promise<{ settleError?: string }> {
  const { error: updateErr } = await client
    .from('games')
    .update({ status: 'finished', state })
    .eq('id', game.id);
  if (updateErr) throw new Error(`finalize/games: ${updateErr.message}`);

  let settleError: string | undefined;

  const stake = Number(game.stake_nano || '0');
  if (stake > 0) {
    const { data: settleData, error: settleErr } = await client.rpc('settle_stake', {
      p_game_id: game.id,
      p_winner: winner,
    });
    if (settleErr) {
      settleError = `settle_stake: ${settleErr.message}`;
      console.error('[pvp] settle failed:', settleError);
    } else if (settleData === null) {
      console.warn('[pvp] settle_stake returned null (no stakes)');
    }
  }

  // Лидерборд — только серверный RPC (публичный доступ закрыт в миграции).
  const winnerName = (winner === game.host_id ? game.host_name : game.guest_name) || 'Игрок';
  const loserName = (loser === game.host_id ? game.host_name : game.guest_name) || 'Игрок';
  await client.rpc('upsert_player_stats', { p_player_id: winner, p_player_name: winnerName, p_is_win: true }).catch(() => {});
  await client.rpc('upsert_player_stats', { p_player_id: loser, p_player_name: loserName, p_is_win: false }).catch(() => {});

  return { settleError };
}
