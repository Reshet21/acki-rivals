/**
 * api/treasury/status.ts — GET: статус казначейства/заказов игрока.
 * ?player=0:hex → история заказов
 */
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidAddress } from '../lib/validate.js';
import { ACKR_PER_NACKL, MIN_NACKL, TREASURY_ADDR } from '../lib/config.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const player = String(req.query.player || '').trim();
  const orders = [];

  if (player && isValidAddress(player) && supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('treasury_orders')
      .select('id,status,nackl_amount,ackr_amount,created_at')
      .eq('player', player)
      .order('created_at', { ascending: false })
      .limit(20);
    if (!error && data) orders.push(...data);
  }

  return res.status(200).json({
    treasury: TREASURY_ADDR,
    ackrPerNackl: ACKR_PER_NACKL,
    minNackl: MIN_NACKL,
    orders,
  });
}
