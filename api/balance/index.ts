/**
 * api/balance/index.ts — GET: текущий игровой баланс.
 *
 * Query: ?player=0:hex64
 * Ответ: { success: true, balanceNano: "123", balanceNackl: 5.5 }
 */
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isDev } from '../../api-lib/config.js';
import { isValidAddress } from '../../api-lib/validate.js';
import { getBalance } from '../../api-lib/balance.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const player = String(req.query.player || '').trim();
  if (!isValidAddress(player)) {
    return res.status(400).json({ error: 'player: ожидается "0:" + 64 hex' });
  }

  try {
    if (!(supabaseUrl && supabaseKey)) {
      if (isDev) return res.status(200).json({ success: true, balanceNano: '0', balanceNackl: 0 });
      return res.status(500).json({ error: 'База не настроена (SUPABASE_* env)' });
    }
    const client = createClient(supabaseUrl, supabaseKey);
    const balanceNano = await getBalance(client, player);
    return res
      .status(200)
      .json({ success: true, balanceNano: balanceNano.toString(), balanceNackl: Number(balanceNano) / 1e9 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    return res.status(500).json({ error: msg });
  }
}
