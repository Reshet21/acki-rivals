/**
 * api/pvp/[slug].ts — ЕДИНАЯ функция для всех PvP-эндпоинтов.
 *
 * Vercel Hobby лимит — 12 serverless-функций; отдельный файл на каждый
 * эндпоинт превышал лимит. Роутер сохраняет ПРЕЖНИЕ URL (/api/pvp/create
 * и т.д.) — клиент не меняется.
 *
 * Список slug: create, join, move, game, list, my, surrender, abandon,
 *               settle, refund, balance, shop, leaderboard, marketplace
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import createHandler from './create.js';
import joinHandler from './join.js';
import moveHandler from './move.js';
import gameHandler from './game.js';
import listHandler from './list.js';
import myHandler from './my.js';
import surrenderHandler from './surrender.js';
import abandonHandler from './abandon.js';
import settleHandler from './settle.js';
import refundHandler from './refund.js';
import balanceHandler from './balance.js';
import shopHandler from './shop.js';
import leaderboardHandler from './leaderboard.js';
import marketplaceHandler from './marketplace.js';

const ROUTES: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<void> | void> = {
  create: createHandler,
  join: joinHandler,
  move: moveHandler,
  game: gameHandler,
  list: listHandler,
  my: myHandler,
  surrender: surrenderHandler,
  abandon: abandonHandler,
  settle: settleHandler,
  refund: refundHandler,
  balance: balanceHandler,
  shop: shopHandler,
  leaderboard: leaderboardHandler,
  marketplace: marketplaceHandler,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = String(req.query.slug || '');
  const route = ROUTES[slug];
  if (!route) {
    return res.status(404).json({ error: `Неизвестный PvP-эндпоинт: ${slug}` });
  }
  return route(req, res);
}
