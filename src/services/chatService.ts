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
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSession(playerId);
    await apiCall<{ success: boolean }>('/api/chat/post', {
      player: playerId,
      text,
      clanId: query.channel === 'clan' ? query.clanId || undefined : undefined,
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
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSession(playerId);
    await apiCall<{ success: boolean }>('/api/chat/post', {
      player: playerId,
      listingId,
      clanId: query.channel === 'clan' ? query.clanId || undefined : undefined,
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
