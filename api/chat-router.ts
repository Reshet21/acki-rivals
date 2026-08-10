/**
 * api/chat-router.ts — ЕДИНАЯ функция для чата и кланов.
 *
 * Rewrites в vercel.json:
 *   /api/chat/<slug> -> /api/chat-router
 *   /api/clan/<slug> -> /api/chat-router
 *
 * Slug чата: list, post.
 * Slug клана: create, list, my, join, leave, kick.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listChat, postChat } from '../api-lib/chat.js';
import { createClan, listClans, myClan, joinClan, leaveClan, kickFromClan } from '../api-lib/clan.js';

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
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const parts = String(req.url || '').split('?')[0].split('/');
  const slug = parts[parts.length - 1] || '';
  const isClan = String(req.url || '').includes('/api/clan/');

  const routes = isClan ? CLAN_ROUTES : CHAT_ROUTES;
  const route = routes[slug];
  if (!route) {
    return res.status(404).json({ error: `Неизвестный эндпоинт: ${slug}` });
  }
  return route(req, res);
}
