/**
 * api-lib/auth.ts — аутентификация игроков через токен-сессии.
 *
 * Клиент хранит случайный 128-битный токен (hex) в localStorage и
 * регистрирует его на сервере (POST /api/auth/register). Все денежные и
 * игровые API требуют `Authorization: Bearer <token>` + player в теле —
 * сервер сверяет sha256(token) с БД. Это закрывает подстановку чужого
 * адреса: действовать за игрока может только владелец его токена.
 */
import { createHash } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const TOKEN_RE = /^[0-9a-f]{64}$/;

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface AuthResult {
  ok: boolean;
  player?: string;
  status: number;
  error?: string;
}

/**
 * Проверить Authorization-заголовок и привязанный к нему player.
 * body должен содержать player (адрес "0:hex64" или анонимный p_xxx id).
 */
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
  client: SupabaseClient | null,
  player: string,
): Promise<AuthResult> {
  if (!player) {
    return { ok: false, status: 400, error: 'player обязателен' };
  }
  if (!client) {
    return { ok: false, status: 500, error: 'База не настроена' };
  }

  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!TOKEN_RE.test(token)) {
    return { ok: false, status: 401, error: 'Отсутствует или невалидный токен сессии' };
  }

  const tokenHash = sha256Hex(token);
  const { data, error } = await client
    .from('player_sessions')
    .select('token_hash')
    .eq('player', player)
    .eq('token_hash', tokenHash)
    .limit(1);
  if (error) {
    return { ok: false, status: 500, error: `player_sessions: ${error.message}` };
  }
  if (!data || data.length === 0) {
    return { ok: false, status: 401, error: 'Сессия не найдена. Перерегистрируйте токен (POST /api/auth/register)' };
  }

  return { ok: true, player };
}

export function unauthorized(res: VercelResponse, result: AuthResult): boolean {
  if (result.ok) return false;
  res.status(result.status).json({ error: result.error });
  return true;
}

export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
