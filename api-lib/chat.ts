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
// Body: { player, text?, clanId?, listingId? }
// Канал определяется сервером: listingId -> trade, clanId -> clan,
// текст -> global. Торговую позицию в глобальный чат отправить нельзя.
export async function postChat(req: VercelRequest, res: VercelResponse) {
  const body = req.body || {};
  const player = String(body.player || '').trim();
  const clanId = String(body.clanId || '').trim() || null;
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const listingId = String(body.listingId || '').trim() || null;

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
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: `chat_messages: ${error.message}` });

    return res.status(200).json({ success: true, message });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
