/**
 * chatService.ts
 *
 * Чат (глобальный/клановый) и кланы. Все запросы — через серверные
 * эндпоинты с токеном сессии (Authorization: Bearer), как PvP.
 * Листинги в чате: карта выставляется на маркетплейс (marketplaceService),
 * в чат публикуется только ссылка на листинг.
 */

import { getSessionToken, ensureSession } from './pvpService';

export interface ChatMessage {
  id: number;
  player: string;
  player_name: string;
  text: string | null;
  clan_id: string | null;
  channel: 'global' | 'trade' | 'clan';
  listing_id: string | null;
  card: any;
  price_nackl: string | null;
  created_at: string;
  sold?: boolean;
  reply_to: number | null;
  reply_player_name: string | null;
  reply_text: string | null;
}

export interface ClanSummary {
  id: string;
  name: string;
  tag: string;
  owner: string;
  created_at: string;
  members: number;
  rating: number;
}

export interface ClanMember {
  player: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
}

export interface MyClanInfo {
  clan: ClanSummary | null;
  members?: ClanMember[];
  myRole?: 'owner' | 'admin' | 'member';
}

async function apiCall<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getSessionToken()}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok || json.error) {
    throw new Error(json.error || `Ошибка ${res.status}`);
  }
  return json;
}

// ─── Чат ────────────────────────────────────────────────

// Канал чата: глобальный, торговый или клановый.
export type ChatChannel = 'global' | 'trade' | 'clan';

export interface ChatQuery {
  channel: ChatChannel;
  clanId?: string | null;
}

export async function fetchMessages(
  playerId: string,
  query: ChatQuery,
  afterId = 0,
): Promise<ChatMessage[]> {
  try {
    await ensureSession(playerId);
    const json = await apiCall<{ success: boolean; messages: ChatMessage[] }>('/api/chat/list', {
      player: playerId,
      channel: query.channel === 'clan' ? undefined : query.channel,
      clanId: query.channel === 'clan' ? query.clanId || undefined : undefined,
      afterId: afterId > 0 ? afterId : undefined,
    });
    return json.messages || [];
  } catch (e) {
    console.error('[chatService] fetchMessages:', e);
    return [];
  }
}

export async function sendText(
  playerId: string,
  text: string,
  query: ChatQuery,
  replyToId?: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSession(playerId);
    await apiCall<{ success: boolean }>('/api/chat/post', {
      player: playerId,
      text,
      clanId: query.channel === 'clan' ? query.clanId || undefined : undefined,
      replyToId: replyToId || undefined,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendListing(
  playerId: string,
  listingId: string,
  query: ChatQuery,
  replyToId?: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSession(playerId);
    await apiCall<{ success: boolean }>('/api/chat/post', {
      player: playerId,
      listingId,
      clanId: query.channel === 'clan' ? query.clanId || undefined : undefined,
      replyToId: replyToId || undefined,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Кланы ──────────────────────────────────────────────

export async function listClans(playerId: string): Promise<{ clans: ClanSummary[]; myClanId: string | null }> {
  try {
    await ensureSession(playerId);
    const json = await apiCall<{ success: boolean; clans: ClanSummary[]; myClanId: string | null }>('/api/clan/list', {
      player: playerId,
    });
    return { clans: json.clans || [], myClanId: json.myClanId || null };
  } catch (e) {
    console.error('[chatService] listClans:', e);
    return { clans: [], myClanId: null };
  }
}

export async function fetchMyClan(playerId: string): Promise<MyClanInfo> {
  try {
    await ensureSession(playerId);
    const json = await apiCall<{ success: boolean; clan: ClanSummary | null; members?: ClanMember[]; myRole?: MyClanInfo['myRole'] }>('/api/clan/my', {
      player: playerId,
    });
    return { clan: json.clan || null, members: json.members || [], myRole: json.myRole };
  } catch (e) {
    console.error('[chatService] fetchMyClan:', e);
    return { clan: null, members: [], myRole: 'member' };
  }
}

export async function createClan(
  playerId: string,
  name: string,
  tag: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSession(playerId);
    await apiCall<{ success: boolean }>('/api/clan/create', { player: playerId, name, tag });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function joinClan(
  playerId: string,
  clanId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSession(playerId);
    await apiCall<{ success: boolean }>('/api/clan/join', { player: playerId, clanId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function leaveClan(playerId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSession(playerId);
    await apiCall<{ success: boolean }>('/api/clan/leave', { player: playerId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function kickMember(
  playerId: string,
  targetPlayer: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSession(playerId);
    await apiCall<{ success: boolean }>('/api/clan/kick', { player: playerId, targetPlayer });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Приглашения в клан ─────────────────────────────────

export interface ClanInvite {
  id: string;
  clan_id: string;
  inviter: string;
  invitee: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  clan_name?: string;
  clan_tag?: string;
  inviter_name?: string;
}

export async function inviteToClan(
  playerId: string,
  targetPlayer: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSession(playerId);
    await apiCall<{ success: boolean }>('/api/clan/invite', { player: playerId, targetPlayer });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchInvites(
  playerId: string,
): Promise<{ incoming: ClanInvite[]; outgoing: ClanInvite[] }> {
  try {
    await ensureSession(playerId);
    const json = await apiCall<{ success: boolean; incoming: ClanInvite[]; outgoing: ClanInvite[] }>('/api/clan/invites', {
      player: playerId,
    });
    return { incoming: json.incoming || [], outgoing: json.outgoing || [] };
  } catch (e) {
    console.error('[chatService] fetchInvites:', e);
    return { incoming: [], outgoing: [] };
  }
}

export async function acceptInvite(
  playerId: string,
  inviteId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSession(playerId);
    await apiCall<{ success: boolean }>('/api/clan/invite_accept', { player: playerId, inviteId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function declineInvite(
  playerId: string,
  inviteId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSession(playerId);
    await apiCall<{ success: boolean }>('/api/clan/invite_decline', { player: playerId, inviteId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function cancelInvite(
  playerId: string,
  inviteId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSession(playerId);
    await apiCall<{ success: boolean }>('/api/clan/invite_cancel', { player: playerId, inviteId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Личные сообщения ───────────────────────────────────

export interface PmMessage {
  id: number;
  sender: string;
  recipient: string;
  text: string;
  read_at: string | null;
  created_at: string;
}

export interface Conversation {
  player: string;
  name: string;
  last_text: string;
  last_at: string;
  unread: number;
}

export async function sendPm(
  playerId: string,
  recipient: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSession(playerId);
    await apiCall<{ success: boolean }>('/api/pm/send', { player: playerId, recipient, text });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchPmHistory(
  playerId: string,
  withPlayer: string,
  afterId = 0,
): Promise<PmMessage[]> {
  try {
    await ensureSession(playerId);
    const json = await apiCall<{ success: boolean; messages: PmMessage[] }>('/api/pm/list', {
      player: playerId,
      with: withPlayer,
      afterId: afterId > 0 ? afterId : undefined,
    });
    return json.messages || [];
  } catch (e) {
    console.error('[chatService] fetchPmHistory:', e);
    return [];
  }
}

export async function fetchConversations(playerId: string): Promise<Conversation[]> {
  try {
    await ensureSession(playerId);
    const json = await apiCall<{ success: boolean; conversations: Conversation[] }>('/api/pm/conversations', {
      player: playerId,
    });
    return json.conversations || [];
  } catch (e) {
    console.error('[chatService] fetchConversations:', e);
    return [];
  }
}

export interface PmUnreadInfo {
  unread: number;
  latest: { id: number; player: string; name: string | null; text: string; created_at: string } | null;
}

export async function fetchPmUnread(playerId: string): Promise<PmUnreadInfo> {
  try {
    await ensureSession(playerId);
    const json = await apiCall<{ success: boolean; unread: number; latest: PmUnreadInfo['latest'] }>('/api/pm/summary', {
      player: playerId,
    });
    return { unread: json.unread || 0, latest: json.latest || null };
  } catch (e) {
    return { unread: 0, latest: null };
  }
}
