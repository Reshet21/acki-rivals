/**
 * validatePayment.ts — поиск и проверка NACKL-платежа игрока на казначейство M.
 *
 * Ищем входящее сообщение на M от player с ecc idx 1 >= amountNano
 * среди последних транзакций M (fresh = last 10 min, aborted=false).
 *
 * NOTE: shellnet GraphQL ломается на selection-set из 3+ полей без alias
 * ("expected selection"), поэтому все поля псевдонимированы.
 */
import { graphql } from './tvm.js';
import { NACKL_ECC_INDEX } from './config.js';

const FRESH_MS = 10 * 60 * 1000;
/** Для верификации по хешу из кошелька — у пользователя есть время вставить хеш */
const FRESH_TX_HASH_MS = 60 * 60 * 1000;

export interface Payment {
  msgHash: string;
  amountNano: bigint;
  src: string;
  now: number;
}

export function isValidAddress(addr: string): boolean {
  return /^0:[0-9a-fA-F]{64}$/.test(addr);
}

async function messageInfo(hash: string): Promise<{ src: string; dst: string; valueOther: Record<string, string> } | null> {
  const q = `query { blockchain { message(hash: "${hash}") { a: src b: dst c: value_other { value currency } d: status } } }`;
  const json = (await graphql(q)) as any;
  const m = json?.data?.blockchain?.message;
  if (!m) return null;
  const valueOther: Record<string, string> = {};
  for (const c of m.c || []) {
    valueOther[c.currency] = c.value;
  }
  return { src: m.a, dst: m.b, valueOther };
}

/**
 * Сканировать свежие входящие транзакции счёта на предмет NACKL-переводов
 * >= amountNano. Если srcFilter задан — учитывать только платежи от этого
 * отправителя, иначе — любой отправитель.
 */
async function scanPayments(
  amountNano: bigint,
  treasuryAccount: string,
  srcFilter?: string,
): Promise<Payment | null> {
  const accountId = treasuryAccount.split(':').pop()!;
  const q = `query { blockchain { account(account_id: "${accountId}", dapp_id: "${accountId}") { transactions { edges { node { a: now b: aborted c: in_msg } } } } } }`;
  const json = (await graphql(q)) as any;
  const edges = json?.data?.blockchain?.account?.transactions?.edges || [];
  const now = Date.now();

  for (const e of edges) {
    const node = e?.node;
    if (!node?.c || node.b) continue;
    const info = await messageInfo(node.c);
    if (!info) continue;
    if (srcFilter) {
      const srcHex = info.src.split(':').pop()?.toLowerCase();
      const filterHex = srcFilter.split(':').pop()?.toLowerCase();
      if (!srcHex || srcHex !== filterHex) continue;
    }

    const nackl = info.valueOther[NACKL_ECC_INDEX];
    if (!nackl) continue;
    const amount = BigInt(nackl);
    if (amount < amountNano) continue;

    const t = Number(node.a) * 1000;
    if (now - t > FRESH_MS) continue;

    return { msgHash: node.c, amountNano: amount, src: info.src, now: t };
  }
  return null;
}

/**
 * Найти свежий NACKL-платёж от player на M.
 */
export async function findPayment(player: string, amountNano: bigint, treasuryAccount: string): Promise<Payment | null> {
  return scanPayments(amountNano, treasuryAccount, player);
}

/**
 * Найти свежий NACKL-платёж на M от ЛЮБОГО отправителя
 * (игрок может платить с любого своего кошелька).
 */
export async function findAnyPayment(amountNano: bigint, treasuryAccount: string): Promise<Payment | null> {
  return scanPayments(amountNano, treasuryAccount);
}

/**
 * Верификация платежа по хешу ТРАНЗАКЦИИ, который показывает кошелёк
 * при отправке перевода (AN Wallet показывает хеш газовой/анкерной
 * транзакции, а сам NACKL лежит в её out_msgs).
 *
 * Работает даже когда тяжёлый запрос account.transactions нестабилен —
 * точечные transaction(hash)/message(hash) майнет отдаёт охотнее.
 */
export async function findPaymentByTxHash(
  txHash: string,
  amountNano: bigint,
  treasuryAccount: string,
): Promise<Payment | null> {
  const q = `query { blockchain { transaction(hash: "${txHash}") { a: now b: aborted c: out_msgs } } }`;
  const json = (await graphql(q)) as any;
  const tx = json?.data?.blockchain?.transaction;
  if (!tx || tx.b) return null;
  const outMsgs: string[] = tx.c || [];
  const now = Date.now();

  for (const msgHash of outMsgs) {
    if (!/^[0-9a-fA-F]{64}$/.test(msgHash)) continue;
    const info = await messageInfo(msgHash);
    if (!info) continue;

    const nackl = info.valueOther[NACKL_ECC_INDEX];
    if (!nackl) continue;
    const amount = BigInt(nackl);
    if (amount < amountNano) continue;

    const t = Number(tx.a) * 1000;
    if (now - t > FRESH_TX_HASH_MS) continue;

    return { msgHash, amountNano: amount, src: info.src, now: t };
  }
  return null;
}
