/**
 * api/auth/register.ts — POST: регистрация токена сессии игрока.
 *
 * Body: { player: "0:hex64" | "p_xxxx", token: "64 hex" }
 *
 * Игрок генерирует случайный токен (клиент, localStorage) и регистрирует
 * его здесь. Хранится только sha256(token). Разрешено несколько токенов
 * на игрока (мультидевайс).
 *
 * 🔒 БЕЗОПАСНОСТЬ (закрыто 09.08): токен НЕЛЬЗЯ зарегистрировать на чужой
 * адрес с активностью (баланс/игры/листинги):
 *   - Если у player УЖЕ есть токен(ы) И есть игровая активность (баланс > 0,
 *     активные PvP-игры, листинги) — новая регистрация принимается ТОЛЬКО
 *     с валидным старым токеном (Authorization: Bearer). Иначе 403.
 *   - Пустой аккаунт (нет баланса и активности) можно свободно
 *     перерегистрировать — это сценарий «сменил устройство».
 * Это закрывает угон: раньше любой, зная адрес жертвы, мог добавить свой
 * токен и потратить её баланс.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, sha256Hex, TOKEN_RE } from '../../api-lib/auth.js';
import { isValidAddress } from '../../api-lib/validate.js';

const ANON_ID_RE = /^p_[a-z0-9]{1,16}$/;
const MAX_TOKENS_PER_PLAYER = 5;

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
    // ── 1. Существующие токены игрока ──
    const { data: existing, error: existingErr } = await supabase
      .from('player_sessions')
      .select('token_hash')
      .eq('player', player)
      .limit(MAX_TOKENS_PER_PLAYER + 1);
    if (existingErr) {
      return res.status(500).json({ error: `player_sessions: ${existingErr.message}` });
    }

    // ── 2. Есть ли игровая активность (деньги/игры/листинги)? ──
    let hasActivity = false;
    try {
      const [bal, games, listings] = await Promise.all([
        supabase.from('player_balances').select('balance_nano').eq('player', player).maybeSingle(),
        supabase.from('games').select('id').or(`host_id.eq.${player},guest_id.eq.${player}`).in('status', ['waiting', 'active']).limit(1),
        supabase.from('marketplace_listings').select('id').eq('seller_id', player).limit(1),
      ]);
      const balNano = BigInt(bal.data?.balance_nano || '0');
      hasActivity = balNano > 0n || (games.data?.length ?? 0) > 0 || (listings.data?.length ?? 0) > 0;
    } catch (e) {
      // активность проверить не смогли — считаем, что есть (безопаснее)
      hasActivity = true;
    }

    // ── 3. Активный аккаунт: новый токен только со старым (подтверждение владения) ──
    if ((existing?.length ?? 0) > 0 && hasActivity) {
      const auth = await requireAuth(req, supabase, player);
      if (!auth.ok) {
        return res.status(403).json({
          error: 'У этого адреса уже есть активная сессия. Подтвердите владение старым токеном (Authorization: Bearer). Если это вы — войдите с устройства, где уже зарегистрирован токен.',
        });
      }
    }

    // ── 4. Лимит токенов на игрока ──
    if ((existing?.length ?? 0) >= MAX_TOKENS_PER_PLAYER) {
      return res.status(429).json({ error: `Лимит токенов для игрока: ${MAX_TOKENS_PER_PLAYER}. Очистите старые сессии.` });
    }

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
