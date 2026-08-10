/**
 * api/chat-router.ts — ЕДИНАЯ функция для чата, кланов и ЛС.
 *
 * Rewrites в vercel.json:
 *   /api/chat/<slug> -> /api/chat-router
 *   /api/clan/<slug> -> /api/chat-router
 *   /api/pm/<slug>   -> /api/chat-router
 *
 * Slug чата: list, post.
 * Slug клана: create, list, my, join, leave, kick, invite, invites,
 *             invite_accept, invite_decline, invite_cancel.
 * Slug ЛС: send, list, conversations, summary.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listChat, postChat } from '../api-lib/chat.js';
import {
  createClan, listClans, myClan, joinClan, leaveClan, kickFromClan,
  inviteToClan, listInvites, acceptInvite, declineInvite, cancelInvite,
} from '../api-lib/clan.js';
import { sendPm, listPm, listConversations, pmSummary } from '../api-lib/pm.js';

const CHAT_ROUTES: Record<string, (req: VercelRequest, res: VercelResponse) => unknown> = {
  list: listChat,
  post: postChat,
};

const CLAN_ROUTES: Record<string, (req: VercelRequest, res: VercelResponse) => unknown> = {
  create: createClan,
  list: listClans,
  my: myClan,
  join: joinClan,
  leave: leaveClan,
  kick: kickFromClan,
  invite: inviteToClan,
  invites: listInvites,
  invite_accept: acceptInvite,
  invite_decline: declineInvite,
  invite_cancel: cancelInvite,
};

const PM_ROUTES: Record<string, (req: VercelRequest, res: VercelResponse) => unknown> = {
  send: sendPm,
  list: listPm,
  conversations: listConversations,
  summary: pmSummary,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const parts = String(req.url || '').split('?')[0].split('/');
  const slug = parts[parts.length - 1] || '';
  const url = String(req.url || '');

  let routes = CHAT_ROUTES;
  if (url.includes('/api/clan/')) routes = CLAN_ROUTES;
  else if (url.includes('/api/pm/')) routes = PM_ROUTES;

  const route = routes[slug];
  if (!route) {
    return res.status(404).json({ error: `Неизвестный эндпоинт: ${slug}` });
  }
  return route(req, res);
}
