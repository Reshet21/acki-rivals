/**
 * api/pvp/leaderboard.ts — GET: топ игроков.
 *
 * ?limit=10
 *
 * Рейтинг (players.rating) начисляет сервер в finalizeMatch.
 * Колоды и приватные данные не раскрываются.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './auth.js';
import { computeClanStats } from './clan.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'База не настроена' });

  try {
    const { data, error } = await supabase!
      .from('players')
      .select('player_id, player_name, wins, losses, streak')
      .order('rating', { ascending: false })
      .limit(limit);
    if (error) return res.status(500).json({ error: `players: ${error.message}` });

    // Клиент ждёт { id, name, wins, losses, streak }
    const users = (data || []).map((p: any) => ({
      id: p.player_id,
      name: p.player_name || 'Игрок',
      wins: p.wins,
      losses: p.losses,
      streak: p.streak,
    }));

    // Топ кланов: сумма rating участников
    const { data: clans } = await supabase!
      .from('clans')
      .select('*')
      .limit(100);
    const topClans = await computeClanStats(clans || []);
    topClans.sort((a, b) => b.rating - a.rating || a.created_at.localeCompare(b.created_at));

    return res.status(200).json({ success: true, users, topClans: topClans.slice(0, 10) });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}