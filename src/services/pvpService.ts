/**
 * services/pvpService.ts — клиент PvP API.
 *
 * ВСЕ операции идут через серверные эндпоинты /api/pvp/*:
 * колоды и ходы игроков видит только сервер, исход раундов считает сервер,
 * ставки резервирует/расчитывает сервер. Клиент никогда не знает колоду
 * соперника и не может подменить результат.
 *
 * Аутентификация: устройство хранит случайный 128-битный токен (hex),
 * регистрирует его через /api/auth/register под текущим playerId и шлёт
 * в заголовке Authorization: Bearer <token>.
 */
import type { Card } from '../types';

const TOKEN_KEY = 'acki_session_token';
const REGISTERED_KEY = 'acki_session_registered';

// ─── Types (зеркало ответов сервера) ─────────────────────

export type PvpPhase = 'waiting' | 'select' | 'resolve' | 'ended';

export interface PvpRoundResult {
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
  hostCard?: Card;
  guestCard?: Card;
}

export interface GameState {
  phase: PvpPhase;
  round: number;
  hostHP: number;
  guestHP: number;
  hostPillz: number;
  guestPillz: number;
  lastResolvedRound?: number;
  roundResult?: PvpRoundResult;
}

export interface Game {
  id: string;
  host_id: string;
  guest_id: string | null;
  host_name: string | null;
  guest_name: string | null;
  state: GameState;
  status: string;
  created_at: string;
  stake_nano?: string | null;
}

export interface PlayerEntry {
  id: string;
  name: string;
  wins: number;
  losses: number;
  streak: number;
}

// ─── Session token ────────────────────────────────────────

/** Текущий токен сессии устройства (генерится при первом обращении). */
export function getSessionToken(): string {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

/** Зарегистрировать токен под playerId (идемпотентно на устройство). */
export async function ensureSession(playerId: string): Promise<void> {
  const token = getSessionToken();
  const registered: Record<string, string> = (() => {
    try { return JSON.parse(localStorage.getItem(REGISTERED_KEY) || '{}'); } catch { return {}; }
  })();
  if (registered[playerId] === token) return;

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player: playerId, token }),
  }).catch(() => null);

  // Помечаем только при УСПЕШНОЙ регистрации. Если сервер отказал
  // (например, 403: адрес с активностью требует старый токен) — при
  // следующем вызове попробуем снова и покажем ошибку пользователю.
  if (res && res.ok) {
    registered[playerId] = token;
    localStorage.setItem(REGISTERED_KEY, JSON.stringify(registered));
  }
}

async function api(path: string, options: { method?: string; body?: unknown; player: string; query?: Record<string, string> }): Promise<any> {
  await ensureSession(options.player);
  let url = path;
  if (options.query) {
    const qs = new URLSearchParams(options.query).toString();
    url += `?${qs}`;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getSessionToken()}`,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let json: any = null;
  try { json = await res.json(); } catch { /* пустое тело */ }

  if (!res.ok) {
    const msg = json?.error || `Ошибка ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

// ─── Game actions ─────────────────────────────────────────

export async function createGame(playerId: string, deck: Card[], name?: string, stakeNano?: string): Promise<Game> {
  const json = await api('/api/pvp/create', {
    method: 'POST',
    player: playerId,
    body: { player: playerId, name: name || '', deck, stakeNano: stakeNano || '0' },
  });
  return json.game as Game;
}

export async function joinGame(gameId: string, playerId: string, deck: Card[], name?: string): Promise<Game> {
  const json = await api('/api/pvp/join', {
    method: 'POST',
    player: playerId,
    body: { player: playerId, gameId, name: name || '', deck },
  });
  return json.game as Game;
}

export async function getGame(gameId: string): Promise<Game | null> {
  const json = await api('/api/pvp/game', { player: '', query: { id: gameId } });
  return json.game as Game;
}

export async function getWaitingGames(): Promise<Game[]> {
  const json = await api('/api/pvp/list', { player: '' });
  return (json.games || []) as Game[];
}

export async function getMyGames(playerId: string): Promise<Game[]> {
  const json = await api('/api/pvp/my', { player: playerId, query: { player: playerId } });
  return (json.games || []) as Game[];
}

/** Отправить ход раунда. Сервер резолвит раунд, когда сходили оба. */
export async function submitMove(
  gameId: string,
  playerId: string,
  round: number,
  cardUid: string,
  pillz: number,
): Promise<void> {
  await api('/api/pvp/move', {
    method: 'POST',
    player: playerId,
    body: { player: playerId, gameId, round, cardUid, pillz },
  });
}

/** Сдаться: сервер завершает бой в пользу оппонента. */
export async function surrenderGame(playerId: string, gameId: string): Promise<void> {
  await api('/api/pvp/surrender', {
    method: 'POST',
    player: playerId,
    body: { player: playerId, gameId },
  });
}

/** Объявить оппонента дезертиром (он не сходил в текущем раунде). */
export async function abandonGame(playerId: string, gameId: string): Promise<void> {
  await api('/api/pvp/abandon', {
    method: 'POST',
    player: playerId,
    body: { player: playerId, gameId },
  });
}

// ─── PvP ставки ───────────────────────────────────────────

/** Возврат ставки (только пока комната не началась). */
export async function refundPvpStake(playerId: string, gameId: string): Promise<void> {
  try {
    await api('/api/pvp/refund', {
      method: 'POST',
      player: playerId,
      body: { player: playerId, gameId },
    });
  } catch {
    // возврат — best-effort
  }
}

/** Баланс NACKL (nanoTON) с автоматическим переносом старых накоплений. */
export async function getBalanceNano(playerId: string): Promise<number> {
  try {
    const json = await api('/api/pvp/balance', { player: playerId, query: { player: playerId } });
    return Number(json.balanceNano || 0);
  } catch {
    return 0;
  }
}

// ─── Leaderboard ──────────────────────────────────────────

export async function getLeaderboard(limit = 50): Promise<PlayerEntry[]> {
  try {
    const json = await api('/api/pvp/leaderboard', { player: '', query: { limit: String(limit) } });
    return (json.users || []) as PlayerEntry[];
  } catch {
    return [];
  }
}
