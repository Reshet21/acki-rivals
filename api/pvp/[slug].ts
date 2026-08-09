/**
 * api/pvp/[slug].ts — ЕДИНАЯ функция для всех PvP-эндпоинтов.
 *
 * Vercel Hobby лимит — 12 serverless-функций; отдельный файл на каждый
 * эндпоинт превышал лимит. Handler'ы живут в api-lib/pvp-handlers/
 * (не в api/, поэтому функций НЕ создают), роутер сохраняет прежние URL
 * (/api/pvp/create и т.д.) — клиент не меняется.
 *
 * Список slug: create, join, move, game, list, my, surrender, abandon,
 *               settle, refund, balance, shop, leaderboard, marketplace
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import createHandler from '../api-lib/pvp-handlers/create.js';
import joinHandler from '../api-lib/pvp-handlers/join.js';
import moveHandler from '../api-lib/pvp-handlers/move.js';
import gameHandler from '../api-lib/pvp-handlers/game.js';
import listHandler from '../api-lib/pvp-handlers/list.js';
import myHandler from '../api-lib/pvp-handlers/my.js';
import surrenderHandler from '../api-lib/pvp-handlers/surrender.js';
import abandonHandler from '../api-lib/pvp-handlers/abandon.js';
import settleHandler from '../api-lib/pvp-handlers/settle.js';
import refundHandler from '../api-lib/pvp-handlers/refund.js';
import balanceHandler from '../api-lib/pvp-handlers/balance.js';
import shopHandler from '../api-lib/pvp-handlers/shop.js';
import leaderboardHandler from '../api-lib/pvp-handlers/leaderboard.js';
import marketplaceHandler from '../api-lib/pvp-handlers/marketplace.js';

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
