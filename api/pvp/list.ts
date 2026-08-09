/**
 * api/pvp/list.ts — GET: открытые комнаты (без колод).
 *
 * Отдаёт только метаданные: id, host_id, host_name, stake_nano, created_at.
 * Колоды хостов скрыты — соперник не может составить контр-колоду.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../../api-lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'База не настроена' });

  try {
    const { data, error } = await supabase
      .from('games')
      .select('id, host_id, host_name, guest_id, stake_nano, status, created_at')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) return res.status(500).json({ error: `games: ${error.message}` });

    return res.status(200).json({ success: true, games: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
