/**
 * api-lib/balance.ts — игровой баланс игрока в нано NACKL.
 *
 * Баланс = sum(deposits) - sum(spends). Пополнение идёт из блокчейна
 * (deposit.ts), трата — атомарный debit внутри покупки/ставки.
 *
 * Атомарность: через RPC-функции Postgres (credit_balance / debit_balance),
 * каждая операция — один стетмент; дебет с проверкой остатка.
 * Анти-повтор депозита — уникальный msg_hash в balance_ledger.
 */
import { SupabaseClient } from '@supabase/supabase-js';

/** Баланс игрока в нано (0, если записи нет). */
export async function getBalance(client: SupabaseClient, player: string): Promise<bigint> {
  const { data, error } = await client
    .from('player_balances')
    .select('balance_nano')
    .eq('player', player)
    .maybeSingle();
  if (error) throw new Error(`getBalance: ${error.message}`);
  return BigInt(data?.balance_nano || '0');
}

export interface CreditResult {
  creditedNano: bigint;
  balanceNano: bigint;
  duplicate: boolean;
}

/**
 * Зачислить депозит. Если msgHash уже был зачислен (в ledger) — ничего
 * не меняем, возвращаем duplicate: true (анти-повтор).
 */
export async function creditDeposit(
  client: SupabaseClient,
  player: string,
  amountNano: bigint,
  msgHash: string,
): Promise<CreditResult> {
  const { error: ledgerErr } = await client
    .from('balance_ledger')
    .insert({ player, type: 'deposit', amount_nano: amountNano.toString(), msg_hash: msgHash })
    .select('id')
    .single();
  if (ledgerErr && String(ledgerErr.message || ledgerErr.code || '').toLowerCase().includes('duplicate')) {
    return { creditedNano: 0n, balanceNano: await getBalance(client, player), duplicate: true };
  }
  if (ledgerErr) throw new Error(`creditDeposit/ledger: ${ledgerErr.message}`);

  const { data, error } = await client.rpc('credit_balance', {
    p_player: player,
    p_amount_nano: amountNano.toString(),
  });
  if (error) throw new Error(`creditDeposit/credit_balance: ${error.message}`);

  return { creditedNano: amountNano, balanceNano: BigInt(data), duplicate: false };
}

export interface DebitResult {
  success: boolean;
  balanceNano: bigint;
}

/**
 * Атомарно списать amountNano с баланса игрока.
 * Недостаточно средств — success: false (баланс не меняется).
 */
export async function debitSpend(
  client: SupabaseClient,
  player: string,
  amountNano: bigint,
  packId?: string,
): Promise<DebitResult> {
  const { data, error } = await client.rpc('debit_balance', {
    p_player: player,
    p_amount_nano: amountNano.toString(),
  });
  if (error) throw new Error(`debitSpend/debit_balance: ${error.message}`);
  if (data === null) return { success: false, balanceNano: await getBalance(client, player) };

  if (packId) {
    const { error: ledgerErr } = await client.from('balance_ledger').insert({
      player,
      type: 'spend',
      amount_nano: amountNano.toString(),
      pack_id: packId,
    });
    if (ledgerErr) console.error('[balance] ledger spend insert:', ledgerErr.message);
  }

  return { success: true, balanceNano: BigInt(data) };
}
