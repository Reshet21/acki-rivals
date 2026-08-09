/**
 * api/auth/register.ts — POST: регистрация токена сессии игрока.
 *
 * Body: { player: "0:hex64" | "p_xxxx", token: "64 hex" }
 *
 * Игрок генерирует случайный токен (клиент, localStorage) и регистрирует
 * его здесь. Хранится только sha256(token). Разрешено несколько токенов
 * на игрока (мультидевайс). API-эндпоинты сверяют токен из заголовка
 * Authorization: Bearer <token> с player из тела запроса.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, sha256Hex, TOKEN_RE } from '../../api-lib/auth.js';
import { isValidAddress } from '../../api-lib/validate.js';

const ANON_ID_RE = /^p_[a-z0-9]{1,16}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const player = String(body.player || '').trim();
  const token = String(body.token || '').trim();

  if (!isValidAddress(player) && !ANON_ID_RE.test(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:hex64" или "p_xxx"' });
  }
  if (!TOKEN_RE.test(token)) {
    return res.status(400).json({ error: 'token: ожидается 64 hex символа' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'База не настроена (SUPABASE_* env)' });
  }

  try {
    const { error } = await supabase.from('player_sessions').insert({
      player,
      token_hash: sha256Hex(token),
    });
    if (error) {
      return res.status(500).json({ error: `player_sessions: ${error.message}` });
    }
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
