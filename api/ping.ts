import { TOKEN_RE } from './api-lib/auth.js';
import { isValidAddress } from './api-lib/validate.js';
import createHandler from './api-lib/create.js';
import { getGameRow } from './api-lib/pvp.js';
import { resolvePvpRound } from './api-lib/battle-resolve.js';

export default function handler(req: any, res: any) {
  res.json({
    ok: true,
    hasAuth: typeof TOKEN_RE !== 'undefined',
    hasVal: typeof isValidAddress === 'function',
    hasCreate: typeof createHandler === 'function',
    hasPvp: typeof getGameRow === 'function',
    hasResolve: typeof resolvePvpRound === 'function',
  });
}
