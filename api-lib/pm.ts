/**
 * api-lib/pm.ts — личные сообщения (ЛС).
 *
 * Эндпоинты: send, list, conversations, summary.
 * Все требуют токен сессии (requireAuth) и получателя/собеседника,
 * зарегистрированного в players (или члена клана — имя резолвится через players).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from './auth.js';

const PM_TEXT_MAX = 500;

interface ConversationRow {
  sender: string;
  recipient: string;
  text: string;
  created_at: string;
}

// ─── POST /api/pm/send ──────────────────────────────────
export async function sendPm(req: VercelRequest, res: VercelResponse) {
  const body = req.body || {};
  const player = String(body.player || '').trim();
  const recipient = String(body.recipient || '').trim();
  const text = String(body.text || '').trim().slice(0, PM_TEXT_MAX);

  if (!recipient) return res.status(400).json({ error: 'recipient обязателен' });
  if (!text) return res.status(400).json({ error: 'text обязателен' });
  if (text.length > PM_TEXT_MAX) return res.status(400).json({ error: `text: не более ${PM_TEXT_MAX} символов` });
  if (recipient === player) return res.status(400).json({ error: 'Нельзя писать самому себе' });

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    // Получатель должен существовать: в players, в clan_members или хоть раз
    // писал в чат (анонимы без кошелька до первого PvP-матча не в players).
    const { data: p } = await supabase!
      .from('players')
      .select('player_id')
      .eq('player_id', recipient)
      .limit(1);
    const { data: cm } = await supabase!
      .from('clan_members')
      .select('player')
      .eq('player', recipient)
      .limit(1);
    const { data: cmRow } = await supabase!
      .from('chat_messages')
      .select('player')
      .eq('player', recipient)
      .limit(1);
    if ((!p || p.length === 0) && (!cm || cm.length === 0) && (!cmRow || cmRow.length === 0)) {
      return res.status(404).json({ error: 'Игрок не найден' });
    }

    const { data: message, error: mErr } = await supabase!
      .from('private_messages')
      .insert({ sender: player, recipient, text })
      .select('id, sender, recipient, text, read_at, created_at')
      .single();
    if (mErr) return res.status(500).json({ error: `private_messages: ${mErr.message}` });

    return res.status(200).json({ success: true, message });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}

// ─── POST /api/pm/list ──────────────────────────────────
// Переписка с конкретным игроком. Помечает входящие как прочитанные.
export async function listPm(req: VercelRequest, res: VercelResponse) {
  const body = req.body || {};
  const player = String(body.player || '').trim();
  const withPlayer = String(body.with || '').trim();
  const afterId = Number(body.afterId) || 0;

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    if (!withPlayer) return res.status(400).json({ error: 'with обязателен' });

    const { data: messages, error } = await supabase!
      .from('private_messages')
      .select('id, sender, recipient, text, read_at, created_at')
      .or(`and(sender.eq.${player},recipient.eq.${withPlayer}),and(sender.eq.${withPlayer},recipient.eq.${player})`)
      .gt('id', afterId)
      .order('id', { ascending: true })
      .limit(100);
    if (error) return res.status(500).json({ error: `private_messages: ${error.message}` });

    // Пометить прочитанными входящие
    const incoming = (messages || []).filter((m: any) => m.sender === withPlayer && !m.read_at);
    if (incoming.length > 0) {
      const ids = incoming.map((m: any) => m.id);
      await supabase!.from('private_messages').update({ read_at: new Date().toISOString() }).in('id', ids);
      (messages || []).forEach((m: any) => {
        if (ids.includes(m.id)) m.read_at = new Date().toISOString();
      });
    }

    return res.status(200).json({ success: true, messages: messages || [] });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}

// ─── POST /api/pm/conversations ─────────────────────────
export async function listConversations(req: VercelRequest, res: VercelResponse) {
  const body = req.body || {};
  const player = String(body.player || '').trim();

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    const { data: messages, error } = await supabase!
      .from('private_messages')
      .select('id, sender, recipient, text, read_at, created_at')
      .or(`sender.eq.${player},recipient.eq.${player}`)
      .order('id', { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ error: `private_messages: ${error.message}` });

    // Последнее сообщение на пару + непрочитанные
    const lastByPair = new Map<string, ConversationRow>();
    const unreadByPair = new Map<string, number>();
    for (const m of messages || []) {
      const other = m.sender === player ? m.recipient : m.sender;
      if (!lastByPair.has(other)) lastByPair.set(other, m);
      if (m.sender !== player && !m.read_at) {
        unreadByPair.set(other, (unreadByPair.get(other) || 0) + 1);
      }
    }

    const others = [...lastByPair.keys()];
    const { data: playerRows } = others.length > 0
      ? await supabase!.from('players').select('player_id, player_name').in('player_id', others)
      : { data: [] };
    const nameByPlayer = new Map((playerRows || []).map((p: any) => [p.player_id, p.player_name]));

    const conversations = others.map((other) => {
      const last = lastByPair.get(other)!;
      return {
        player: other,
        name: nameByPlayer.get(other) || 'Игрок',
        last_text: last.text,
        last_at: last.created_at,
        unread: unreadByPair.get(other) || 0,
      };
    });
    conversations.sort((a, b) => String(b.last_at).localeCompare(String(a.last_at)));

    return res.status(200).json({ success: true, conversations });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}

// ─── POST /api/pm/summary ───────────────────────────────
export async function pmSummary(req: VercelRequest, res: VercelResponse) {
  const body = req.body || {};
  const player = String(body.player || '').trim();

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    const { count, error } = await supabase!
      .from('private_messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient', player)
      .is('read_at', null);
    if (error) return res.status(500).json({ error: `private_messages: ${error.message}` });

    return res.status(200).json({ success: true, unread: count || 0 });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
