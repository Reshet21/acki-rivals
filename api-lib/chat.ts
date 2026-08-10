/**
 * api-lib/chat.ts — чат: list, post.
 *
 * Глобальный чат (clan_id IS NULL) виден всем; клановый чат — только
 * членам клана (проверка по clan_members). Листинг в сообщении — это
 * ссылка на marketplace_listings.id: сервер копирует карту/цену из
 * листинга, покупка идёт существующим RPC marketplace_purchase.
 *
 * Лимиты: длина текста ≤ 300, не чаще 1 сообщения в 2 секунды.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase, requireAuth, unauthorized } from './auth.js';

const MAX_TEXT = 300;
const RATE_LIMIT_SECONDS = 2;

export interface ChatMessage {
  id: number;
  player: string;
  player_name: string;
  text: string | null;
  clan_id: string | null;
  channel: string;
  listing_id: string | null;
  card: any;
  price_nackl: string | null;
  created_at: string;
  reply_to: number | null;
  reply_player_name: string | null;
  reply_text: string | null;
}

async function getPlayerName(supabase: any, player: string): Promise<string> {
  const { data } = await supabase
    .from('players')
    .select('player_name')
    .eq('player_id', player)
    .limit(1);
  return (data && data.length > 0 && data[0].player_name) || 'Игрок';
}

// ─── POST /api/chat/list ────────────────────────────────
// Body: { player, channel?: "global" | "trade", clanId?: string, afterId?: number }
export async function listChat(req: VercelRequest, res: VercelResponse) {
  const body = req.body || {};
  const player = String(body.player || '').trim();
  const clanId = String(body.clanId || '').trim() || null;
  const channel = clanId ? 'clan' : (body.channel === 'trade' ? 'trade' : 'global');
  const afterId = Number(body.afterId) || 0;

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    if (channel === 'clan') {
      const { data: member } = await supabase!
        .from('clan_members')
        .select('clan_id')
        .eq('clan_id', clanId)
        .eq('player', player)
        .limit(1);
      if (!member || member.length === 0) {
        return res.status(403).json({ error: 'Чат клана доступен только его членам' });
      }
    }

    let query = supabase!.from('chat_messages').select('*');
    query = query.eq('channel', channel);
    if (channel === 'clan') query = query.eq('clan_id', clanId);
    query = afterId > 0 ? query.gt('id', afterId) : query.limit(100).order('id', { ascending: false });

    const { data: rows, error } = afterId > 0
      ? await query.order('id', { ascending: true }).limit(200)
      : await query;
    if (error) return res.status(500).json({ error: `chat_messages: ${error.message}` });

    let messages: ChatMessage[] = rows || [];

    // Продано/снято: листинг исчез из marketplace_listings
    const listingIds = messages
      .map((m: any) => m.listing_id)
      .filter((id: string | null): id is string => Boolean(id));
    const soldIds = new Set<string>();
    if (listingIds.length > 0) {
      const { data: active } = await supabase!
        .from('marketplace_listings')
        .select('id')
        .in('id', listingIds);
      const activeIds = new Set((active || []).map((l: any) => l.id));
      for (const id of listingIds) {
        if (!activeIds.has(id)) soldIds.add(id);
      }
    }

    return res.status(200).json({
      success: true,
      messages: messages.map((m: any) => {
        // Карточка без активного listing_id (обнулён при продаже/отмене) = продано
        const isCardMsg = Boolean(m.card);
        const sold = isCardMsg ? (m.listing_id ? soldIds.has(m.listing_id) : true) : false;
        return { ...m, sold };
      }),
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}

// ─── POST /api/chat/post ────────────────────────────────
// Body: { player, text?, clanId?, listingId?, replyToId? }
// Канал определяется сервером: listingId -> trade, clanId -> clan,
// текст -> global. Торговую позицию в глобальный чат отправить нельзя.
export async function postChat(req: VercelRequest, res: VercelResponse) {
  const body = req.body || {};
  const player = String(body.player || '').trim();
  const clanId = String(body.clanId || '').trim() || null;
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const listingId = String(body.listingId || '').trim() || null;
  const replyToId = Number(body.replyToId) || 0;

  if (!text && !listingId) {
    return res.status(400).json({ error: 'text или listingId обязательны' });
  }
  if (text.length > MAX_TEXT) {
    return res.status(400).json({ error: `text: максимум ${MAX_TEXT} символов` });
  }

  const channel = listingId ? (clanId ? 'clan' : 'trade') : (clanId ? 'clan' : 'global');

  const supabase = getSupabase();
  const auth = await requireAuth(req, supabase, player);
  if (unauthorized(res, auth)) return;

  try {
    if (channel === 'clan') {
      const { data: member } = await supabase!
        .from('clan_members')
        .select('clan_id')
        .eq('clan_id', clanId)
        .eq('player', player)
        .limit(1);
      if (!member || member.length === 0) {
        return res.status(403).json({ error: 'Чат клана доступен только его членам' });
      }
    }

    // Rate-limit: не чаще 1 сообщения в 2 секунды
    const { data: recent } = await supabase!
      .from('chat_messages')
      .select('id')
      .eq('player', player)
      .gte('created_at', new Date(Date.now() - RATE_LIMIT_SECONDS * 1000).toISOString())
      .limit(1);
    if (recent && recent.length > 0) {
      return res.status(429).json({ error: 'Слишком часто. Подождите пару секунд' });
    }

    const playerName = await getPlayerName(supabase, player);

    // Снапшот ответа: оригинал должен быть в том же канале (clan — тот же клан)
    let replyPlayerName: string | null = null;
    let replyText: string | null = null;
    if (replyToId > 0) {
      const { data: orig, error: rErr } = await supabase!
        .from('chat_messages')
        .select('id, player_name, text, card, channel, clan_id')
        .eq('id', replyToId)
        .single();
      if (rErr || !orig) {
        return res.status(404).json({ error: 'Сообщение, на которое отвечаете, не найдено' });
      }
      if (orig.channel !== channel || (channel === 'clan' && orig.clan_id !== clanId)) {
        return res.status(400).json({ error: 'Нельзя ответить на сообщение из другого канала' });
      }
      replyPlayerName = orig.player_name || 'Игрок';
      replyText = orig.text || (orig.card ? `Карта: ${orig.card.name || ''}`.trim() : '');
      if (!replyText) replyText = '…';
    }

    let card: any = null;
    let priceNackl: string | null = null;
    if (listingId) {
      const { data: listing, error: lErr } = await supabase!
        .from('marketplace_listings')
        .select('id, card, price_nackl, seller_id')
        .eq('id', listingId)
        .single();
      if (lErr || !listing) {
        return res.status(404).json({ error: 'Листинг не найден' });
      }
      if (listing.seller_id !== player) {
        return res.status(403).json({ error: 'В чат можно публиковать только свои листинги' });
      }
      card = listing.card;
      priceNackl = listing.price_nackl;
    }

    const { data: message, error } = await supabase!
      .from('chat_messages')
      .insert({
        player,
        player_name: playerName,
        text: text || null,
        clan_id: clanId,
        channel,
        listing_id: listingId,
        card,
        price_nackl: priceNackl,
        reply_to: replyToId > 0 ? replyToId : null,
        reply_player_name: replyPlayerName,
        reply_text: replyText,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: `chat_messages: ${error.message}` });

    return res.status(200).json({ success: true, message });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
