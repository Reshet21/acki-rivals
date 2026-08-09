/**
 * api/pvp-router.ts — ЕДИНАЯ функция для всех PvP-эндпоинтов.
 *
 * Vercel Hobby лимит — 12 serverless-функций; отдельный файл на каждый
 * эндпоинт превышал лимит. Handler'ы живут ПЛОСКО в api-lib/*.ts (Vercel
 * компилирует api-lib/*.ts, но НЕ подпапки вроде api-lib/pvp-handlers/),
 * а URL сохраняются прежними через rewrite в vercel.json:
 * /api/pvp/<slug> -> /api/pvp-router.
 *
 * Slug: create, join, move, game, list, my, surrender, abandon,
 *       settle, refund, balance, shop, leaderboard, marketplace
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import createHandler from '../api-lib/create.js';
import joinHandler from '../api-lib/join.js';
import moveHandler from '../api-lib/move.js';
import gameHandler from '../api-lib/game.js';
import listHandler from '../api-lib/list.js';
import myHandler from '../api-lib/my.js';
import surrenderHandler from '../api-lib/surrender.js';
import abandonHandler from '../api-lib/abandon.js';
import settleHandler from '../api-lib/settle.js';
import refundHandler from '../api-lib/refund.js';
import balanceHandler from '../api-lib/pvp-balance.js';
import shopHandler from '../api-lib/shop.js';
import leaderboardHandler from '../api-lib/leaderboard.js';
import marketplaceHandler from '../api-lib/marketplace.js';

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
  const parts = String(req.url || '').split('?')[0].split('/');
  const slug = parts[parts.length - 1] || '';
  const route = ROUTES[slug];
  if (!route) {
    return res.status(404).json({ error: `Неизвестный PvP-эндпоинт: ${slug}` });
  }
  return route(req, res);
}
