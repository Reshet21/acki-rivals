/**
 * api/pvp/game.ts — GET: состояние PvP-игры (без колод соперников!).
 *
 * ?id=<uuid>
 *
 * Колоды НЕ отдаются: сервер хранит их и использует при резолве раундов.
 * Клиент видит только state (HP, pillz, результаты раундов) — заглянуть
 * в руку оппонента или подменить ход нельзя.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../auth.js';
import { getGameRow, isValidGameId } from '../pvp.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const gameId = String(req.query.id || '').trim();
  if (!isValidGameId(gameId)) return res.status(400).json({ error: 'id: ожидается UUID' });

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'База не настроена' });

  try {
    const game = await getGameRow(supabase, gameId);
    if (!game) return res.status(404).json({ error: 'Игра не найдена' });

    return res.status(200).json({
      success: true,
      game: {
        id: game.id,
        host_id: game.host_id,
        guest_id: game.guest_id,
        host_name: game.host_name,
        guest_name: game.guest_name,
        state: game.state,
        status: game.status,
        stake_nano: game.stake_nano,
        created_at: game.created_at,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
