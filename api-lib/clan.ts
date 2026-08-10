/**
 * api-lib/clan.ts — кланы: create, list, my, join, leave, kick.
 *
 * Все эндпоинты требуют токен сессии (requireAuth). Чат-сообщения и
 * листинги клана — в chat.ts. Рейтинг клана = сумма rating участников
 * (считается на лету, вычисляется в computeClanStats).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from './auth.js';

const CLAN_MEMBER_LIMIT = 20;

interface ClanWithStats {
  id: string;
  name: string;
  tag: string;
  owner: string;
  created_at: string;
  members: number;
  rating: number;
}

/**
 * Посчитать members/rating для списка кланов (общий код для list и top).
 */
export async function computeClanStats(clans: any[]): Promise<ClanWithStats[]> {
  const supabase = getSupabase();
  if (!supabase || clans.length === 0) return [];

  const ids = clans.map((c: any) => c.id);
  const { data: members, error: mErr } = await supabase
    .from('clan_members')
    .select('clan_id, player')
    .in('clan_id', ids);
  if (mErr) return [];

  const playerIds = [...new Set((members || []).map((m: any) => m.player))];
  const { data: ratings } = playerIds.length > 0
    ? await supabase.from('players').select('player_id, rating').in('player_id', playerIds)
    : { data: [] };

  const ratingByPlayer = new Map((ratings || []).map((p: any) => [p.player_id, p.rating || 0]));
  const membersByClan = new Map<string, number>();
  const ratingByClan = new Map<string, number>();
  for (const m of members || []) {
    membersByClan.set(m.clan_id, (membersByClan.get(m.clan_id) || 0) + 1);
    ratingByClan.set(m.clan_id, (ratingByClan.get(m.clan_id) || 0) + (ratingByPlayer.get(m.player) || 0));
  }

  return clans.map((c: any) => ({
    id: c.id,
    name: c.name,
    tag: c.tag,
    owner: c.owner,
    created_at: c.created_at,
    members: membersByClan.get(c.id) || 0,
    rating: ratingByClan.get(c.id) || 0,
  }));
}

async function getMyClanId(supabase: any, player: string): Promise<string | null> {
  const { data } = await supabase
    .from('clan_members')
    .select('clan_id')
    .eq('player', player)
    .limit(1);
  return data && data.length > 0 ? (data[0].clan_id as string) : null;
}

// ─── POST /api/clan/create ──────────────────────────────
export async function createClan(req: VercelRequest, res: VercelResponse) {
  const body = req.body || {};
  const player = String(body.player || '').trim();
  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  const tag = String(body.tag || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (name.length < 2 || name.length > 24) {
    return res.status(400).json({ error: 'name: 2..24 символа' });
  }
  if (tag.length < 2 || tag.length > 5) {
    return res.status(400).json({ error: 'tag: 2..5 символов (A-Z, 0-9)' });
  }

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    const existing = await getMyClanId(supabase, player);
    if (existing) return res.status(409).json({ error: 'Вы уже в клане' });

    const { data: clan, error: clanErr } = await supabase!
      .from('clans')
      .insert({ name, tag, owner: player })
      .select()
      .single();
    if (clanErr) {
      if (clanErr.code === '23505') {
        return res.status(409).json({ error: 'Клан с таким именем или тегом уже существует' });
      }
      return res.status(500).json({ error: `clans: ${clanErr.message}` });
    }

    const { error: memberErr } = await supabase!
      .from('clan_members')
      .insert({ clan_id: clan.id, player, role: 'owner' });
    if (memberErr) {
      await supabase!.from('clans').delete().eq('id', clan.id);
      return res.status(500).json({ error: `clan_members: ${memberErr.message}` });
    }

    return res.status(200).json({ success: true, clan });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}

// ─── POST /api/clan/list ────────────────────────────────
export async function listClans(req: VercelRequest, res: VercelResponse) {
  const body = req.body || {};
  const player = String(body.player || '').trim();

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    const { data: clans, error } = await supabase!
      .from('clans')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(50);
    if (error) return res.status(500).json({ error: `clans: ${error.message}` });

    const withStats = await computeClanStats(clans || []);
    withStats.sort((a, b) => b.rating - a.rating || a.created_at.localeCompare(b.created_at));

    const myClanId = await getMyClanId(supabase, player);
    return res.status(200).json({ success: true, clans: withStats, myClanId });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}

// ─── POST /api/clan/my ──────────────────────────────────
export async function myClan(req: VercelRequest, res: VercelResponse) {
  const body = req.body || {};
  const player = String(body.player || '').trim();

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    const myClanId = await getMyClanId(supabase, player);
    if (!myClanId) return res.status(200).json({ success: true, clan: null });

    const { data: clan, error: clanErr } = await supabase!
      .from('clans')
      .select('*')
      .eq('id', myClanId)
      .single();
    if (clanErr) return res.status(500).json({ error: `clans: ${clanErr.message}` });

    const { data: members, error: mErr } = await supabase!
      .from('clan_members')
      .select('player, role, joined_at')
      .eq('clan_id', myClanId);
    if (mErr) return res.status(500).json({ error: `clan_members: ${mErr.message}` });

    const playerIds = (members || []).map((m: any) => m.player);
    const { data: playerRows } = playerIds.length > 0
      ? await supabase!.from('players').select('player_id, player_name, rating, wins, losses').in('player_id', playerIds)
      : { data: [] };
    const nameByPlayer = new Map((playerRows || []).map((p: any) => [p.player_id, p]));

    const membersFull = (members || []).map((m: any) => {
      const p = nameByPlayer.get(m.player) || {};
      return {
        player: m.player,
        role: m.role,
        joined_at: m.joined_at,
        name: p.player_name || 'Игрок',
        rating: p.rating || 0,
        wins: p.wins || 0,
        losses: p.losses || 0,
      };
    });
    membersFull.sort((a: any, b: any) => (a.role === 'owner' ? -1 : 0) - (b.role === 'owner' ? -1 : 0));

    const myRole = (members || []).find((m: any) => m.player === player)?.role || 'member';

    return res.status(200).json({ success: true, clan, members: membersFull, myRole });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}

// ─── POST /api/clan/join ────────────────────────────────
export async function joinClan(req: VercelRequest, res: VercelResponse) {
  const body = req.body || {};
  const player = String(body.player || '').trim();
  const clanId = String(body.clanId || '').trim();

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    const existing = await getMyClanId(supabase, player);
    if (existing) return res.status(409).json({ error: 'Вы уже в клане' });

    const { data: clan, error: clanErr } = await supabase!
      .from('clans')
      .select('id')
      .eq('id', clanId)
      .single();
    if (clanErr || !clan) return res.status(404).json({ error: 'Клан не найден' });

    const { count } = await supabase!
      .from('clan_members')
      .select('player', { count: 'exact', head: true })
      .eq('clan_id', clanId);
    if ((count || 0) >= CLAN_MEMBER_LIMIT) {
      return res.status(409).json({ error: `Клан заполнен (${CLAN_MEMBER_LIMIT} участников)` });
    }

    const { error: joinErr } = await supabase!
      .from('clan_members')
      .insert({ clan_id: clanId, player, role: 'member' });
    if (joinErr) {
      if (joinErr.code === '23505') return res.status(409).json({ error: 'Вы уже в клане' });
      return res.status(500).json({ error: `clan_members: ${joinErr.message}` });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}

// ─── POST /api/clan/leave ───────────────────────────────
export async function leaveClan(req: VercelRequest, res: VercelResponse) {
  const body = req.body || {};
  const player = String(body.player || '').trim();

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    const { data: me } = await supabase!
      .from('clan_members')
      .select('clan_id, role')
      .eq('player', player)
      .limit(1);
    if (!me || me.length === 0) return res.status(404).json({ error: 'Вы не состоите в клане' });

    if (me[0].role === 'owner') {
      // Расформировать клан (члены удаляются каскадом)
      const { error } = await supabase!.from('clans').delete().eq('id', me[0].clan_id);
      if (error) return res.status(500).json({ error: `clans: ${error.message}` });
      return res.status(200).json({ success: true, disbanded: true });
    }

    const { error } = await supabase!
      .from('clan_members')
      .delete()
      .eq('clan_id', me[0].clan_id)
      .eq('player', player);
    if (error) return res.status(500).json({ error: `clan_members: ${error.message}` });

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}

// ─── POST /api/clan/kick ────────────────────────────────
export async function kickFromClan(req: VercelRequest, res: VercelResponse) {
  const body = req.body || {};
  const player = String(body.player || '').trim();
  const target = String(body.targetPlayer || '').trim();

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    const { data: me } = await supabase!
      .from('clan_members')
      .select('clan_id, role')
      .eq('player', player)
      .limit(1);
    if (!me || me.length === 0) return res.status(403).json({ error: 'Вы не состоите в клане' });
    if (me[0].role !== 'owner' && me[0].role !== 'admin') {
      return res.status(403).json({ error: 'Кикать может только владелец или админ' });
    }

    const { data: targetRow } = await supabase!
      .from('clan_members')
      .select('clan_id, role')
      .eq('player', target)
      .eq('clan_id', me[0].clan_id)
      .limit(1);
    if (!targetRow || targetRow.length === 0) {
      return res.status(404).json({ error: 'Игрок не в вашем клане' });
    }
    if (targetRow[0].role === 'owner') {
      return res.status(403).json({ error: 'Нельзя кикнуть владельца' });
    }
    if (me[0].role !== 'owner' && targetRow[0].role === 'admin') {
      return res.status(403).json({ error: 'Админа может кикнуть только владелец' });
    }

    const { error } = await supabase!
      .from('clan_members')
      .delete()
      .eq('clan_id', me[0].clan_id)
      .eq('player', target);
    if (error) return res.status(500).json({ error: `clan_members: ${error.message}` });

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
