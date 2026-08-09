import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Card } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

// ─── Types ──────────────────────────────────────────────

export interface GameState {
  phase: 'waiting' | 'select' | 'resolve' | 'ended';
  round: number;
  hostHP: number;
  guestHP: number;
  hostPillz: number;
  guestPillz: number;
  lastResolvedRound?: number;
  roundResult?: {
    hostCardId: number;
    guestCardId: number;
    hostPillzUsed: number;
    guestPillzUsed: number;
    hostAttack: number;
    guestAttack: number;
    hostBasePower: number;
    hostFinalPower: number;
    guestBasePower: number;
    guestFinalPower: number;
    winner: 'host' | 'guest' | 'draw';
    damage: number;
    healAmount: number;
    poisonAmount: number;
    lifeStealAmount: number;
    opponentDamageReduction: number;
  };
  currentRound?: {
    hostCard?: Card;
    hostPillz: number;
    guestCard?: Card;
    guestPillz: number;
    result?: { winner: 'host' | 'guest' | 'draw'; damage: number; hostAttack: number; guestAttack: number };
  };
}

export interface Game {
  id: string;
  host_id: string;
  guest_id: string | null;
  host_name: string | null;
  guest_name: string | null;
  host_deck: Card[];
  guest_deck: Card[] | null;
  state: GameState;
  status: string;
  created_at: string;
  stake_nano?: string | null;
}

export interface Move {
  id: string;
  game_id: string;
  player_id: string;
  round: number;
  card_id: number;
  pillz: number;
}

export interface PlayerEntry {
  id: string;
  player_id: string;
  player_name: string;
  wins: number;
  losses: number;
  rating: number;
  last_active: string;
  created_at: string;
}

// ─── Game actions ────────────────────────────────────────

export async function createGame(hostId: string, hostDeck: Card[], hostName?: string, stakeNano?: string): Promise<Game | null> {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');

  const { data, error } = await client
    .from('games')
    .insert({
      host_id: hostId,
      host_name: hostName || null,
      host_deck: hostDeck,
      status: 'waiting',
      stake_nano: stakeNano || '0',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function joinGame(gameId: string, guestId: string, guestDeck: Card[], guestName?: string): Promise<Game | null> {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('games')
    .update({
      guest_id: guestId,
      guest_name: guestName || null,
      guest_deck: guestDeck,
      status: 'active',
    })
    .eq('id', gameId)
    .eq('status', 'waiting')
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getGame(gameId: string): Promise<Game | null> {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (error) throw error;
  return data;
}

export async function getWaitingGames(): Promise<Game[]> {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('games')
    .select('*')
    .eq('status', 'waiting')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
}

export async function getMyGames(playerId: string): Promise<Game[]> {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('games')
    .select('*')
    .or(`host_id.eq.${playerId},guest_id.eq.${playerId}`)
    .in('status', ['active', 'waiting'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function submitMove(
  gameId: string,
  playerId: string,
  round: number,
  cardId: number,
  pillz: number,
): Promise<Move | null> {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('moves')
    .insert({
      game_id: gameId,
      player_id: playerId,
      round,
      card_id: cardId,
      pillz,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getRoundMoves(gameId: string, round: number): Promise<Move[]> {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('moves')
    .select('*')
    .eq('game_id', gameId)
    .eq('round', round)
    .order('created_at');

  if (error) throw error;
  return data || [];
}

export async function updateGameState(gameId: string, state: GameState): Promise<void> {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('games')
    .update({ state, status: state.phase === 'ended' ? 'finished' : 'active' })
    .eq('id', gameId);

  if (error) throw error;
}

export async function finishGame(gameId: string): Promise<void> {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('games')
    .update({ status: 'finished' })
    .eq('id', gameId);

  if (error) throw error;
}

export async function abandonGame(gameId: string): Promise<void> {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('games')
    .update({ status: 'finished' })
    .eq('id', gameId);

  if (error) throw error;
}

export async function cancelGame(gameId: string): Promise<void> {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured');

  // Physically delete a waiting room so it does not stay in the open rooms list
  const { error } = await client
    .from('games')
    .delete()
    .eq('id', gameId)
    .eq('status', 'waiting');

  if (error) throw error;
}

// ─── PvP ставки (игровой баланс) ─────────────────────────

export async function reservePvpStake(
  player: string,
  gameId: string,
  stakeNackl: number,
): Promise<{ success: boolean; balanceNackl?: number; error?: string }> {
  if (stakeNackl <= 0) return { success: true };
  try {
    const res = await fetch('/api/pvp/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player, gameId, stakeNano: BigInt(Math.round(stakeNackl * 1e9)).toString() }),
    });
    const json = (await res.json()) as { success: boolean; balanceNano?: string; error?: string };
    if (res.status === 402) {
      return { success: false, error: json.error || 'Недостаточно средств' };
    }
    if (res.ok && json.success) {
      return { success: true, balanceNackl: json.balanceNano ? Number(json.balanceNano) / 1e9 : undefined };
    }
    return { success: false, error: json.error || 'Ошибка резерва ставки' };
  } catch {
    return { success: false, error: 'Сеть недоступна' };
  }
}

export async function refundPvpStake(player: string, gameId: string): Promise<void> {
  try {
    await fetch('/api/pvp/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player, gameId }),
    });
  } catch {
    // возврат — best-effort
  }
}

export async function settlePvpStake(
  winner: string,
  gameId: string,
): Promise<{ success: boolean; balanceNackl?: number; error?: string }> {
  try {
    const res = await fetch('/api/pvp/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winner, gameId }),
    });
    const json = (await res.json()) as { success: boolean; balanceNano?: string; error?: string };
    if (res.ok && json.success) {
      return { success: true, balanceNackl: json.balanceNano ? Number(json.balanceNano) / 1e9 : undefined };
    }
    return { success: false, error: json.error || 'Ошибка расчёта ставки' };
  } catch {
    return { success: false, error: 'Сеть недоступна' };
  }
}

// ─── Leaderboard ─────────────────────────────────────────

export async function updatePlayerStats(
  playerId: string,
  playerName: string,
  isWin: boolean,
): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { error } = await client.rpc('upsert_player_stats', {
    p_player_id: playerId,
    p_player_name: playerName,
    p_is_win: isWin,
  });

  if (error) {
    console.warn('[pvpService] updatePlayerStats failed:', error);
  }
}

export async function getLeaderboard(limit = 50): Promise<PlayerEntry[]> {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from('players')
    .select('*')
    .order('rating', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[pvpService] getLeaderboard failed:', error);
    return [];
  }
  return data || [];
}

/**
 * Склеить анонимную запись игрока (device-bound p_xxx id) с его кошельком.
 *
 * Раньше player_id хранился в localStorage и мог дублироваться при сбросе;
 * теперь с кошельком id = адрес кошелька. При подключении переносим
 * старую статистику на адрес: если запись под адресом уже есть —
 * суммируем и удаляем анонимную.
 */
export async function mergePlayerRows(
  anonId: string,
  walletAddress: string,
): Promise<void> {
  if (!anonId || !walletAddress || anonId === walletAddress) return;
  const client = getClient();
  if (!client) return;

  try {
    const { data: anonRow } = await client
      .from('players')
      .select('wins,losses,rating')
      .eq('player_id', anonId)
      .maybeSingle();

    if (!anonRow) return;

    const { data: walletRow } = await client
      .from('players')
      .select('wins,losses,rating')
      .eq('player_id', walletAddress)
      .maybeSingle();

    if (walletRow) {
      // Оба существуют — суммируем в запись кошелька, анонимную удаляем
      await client.from('players')
        .update({
          wins: walletRow.wins + anonRow.wins,
          losses: walletRow.losses + anonRow.losses,
          rating: walletRow.rating + anonRow.rating,
          last_active: new Date().toISOString(),
        })
        .eq('player_id', walletAddress);
      await client.from('players').delete().eq('player_id', anonId);
    } else {
      // Переносим анонимную запись на адрес кошелька
      await client.from('players')
        .update({
          player_id: walletAddress,
          last_active: new Date().toISOString(),
        })
        .eq('player_id', anonId);
    }
    console.log('[pvpService] merged player rows:', anonId, '->', walletAddress);
  } catch (e) {
    console.warn('[pvpService] mergePlayerRows failed:', e);
  }
}

// ─── Real-time subscriptions ─────────────────────────────

export function subscribeToGame(
  gameId: string,
  onMove: (move: Move) => void,
  onStateChange: (game: Game) => void,
) {
  const client = getClient();
  if (!client) return () => {};

  const movesSub = client
    .channel(`moves:${gameId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moves', filter: `game_id=eq.${gameId}` }, (payload) => {
      onMove(payload.new as Move);
    })
    .subscribe();

  const gamesSub = client
    .channel(`games:${gameId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
      onStateChange(payload.new as Game);
    })
    .subscribe();

  return () => {
    movesSub.unsubscribe();
    gamesSub.unsubscribe();
  };
}
