/**
 * validatePayment.ts — поиск и проверка NACKL-платежа игрока на казначейство M.
 *
 * Ищем входящее сообщение на M от player с ecc idx 1 >= amountNano
 * среди транзакций M (безлимитное окно: любой платёж от player,
 * защита от повтора — уникальный msg_hash в БД treasury_orders).
 *
 * NOTE: shellnet GraphQL ломается на selection-set из 3+ полей без alias
 * ("expected selection"), поэтому все поля псевдонимированы.
 */
import { graphql } from './tvm.js';
import { NACKL_ECC_INDEX, TREASURY_DAPP_ID } from './config.js';

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
  // Майнет периодически отвечает валидным JSON, но с message:null, либо
  // отдаёт 502/HTML — ретраим, чтобы отличать «индекс не отдал» от
  // «сообщения нет».
  let last: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    let json: Record<string, unknown> | null = null;
    try {
      json = (await graphql(q)) as any;
    } catch (e) {
      last = { error: e instanceof Error ? e.message : String(e) };
    }
    const m = (json as any)?.data?.blockchain?.message;
    if (m) {
      const valueOther: Record<string, string> = {};
      for (const c of m.c || []) {
        valueOther[String(c.currency)] = String(c.value);
      }
      return { src: m.a, dst: m.b, valueOther };
    }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  return null;
}

/**
 * Сканировать свежие входящие транзакции счёта на предмет NACKL-переводов
 * >= amountNano. Если srcFilter задан — учитывать только платежи от этого
 * отправителя, иначе — любой отправитель.
 *
 * dapp_id: контекст приложения (TREASURY_DAPP_ID из env); пусто = self-вью.
 * Майнет отдаёт одну и ту же ленту для self и app-контекста, но приложение
 * регистрирует свои платежи в своём dapp — поэтому приоритет у app id.
 */
async function scanPayments(
  amountNano: bigint,
  treasuryAccount: string,
  srcFilter?: string,
): Promise<Payment | null> {
  const accountId = treasuryAccount.split(':').pop()!;
  const dappId = TREASURY_DAPP_ID || accountId;
  const q = `query { blockchain { account(account_id: "${accountId}", dapp_id: "${dappId}") { transactions { edges { node { a: now b: aborted c: in_msg } } } } } }`;
  // Майнет периодически отвечает валидным JSON с account:null — ретраим,
  // чтобы отличать «не отдал» от «платежей нет».
  let json: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      json = (await graphql(q)) as any;
    } catch (e) {
      json = null;
    }
    const acc = json?.data?.blockchain?.account;
    if (acc) break;
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  const edges = json?.data?.blockchain?.account?.transactions?.edges || [];

  // edges идут от старых к свежим — идём с конца, чтобы первым подобрался
  // самый свежий подходящий платёж.
  // ⚠️ НЕ отбрасываем aborted=true: на майнете все NACKL-переводы проходят
  //    aborted-транзакцией (контракт кидает исключение на currency-перевод,
  //    но NACKL доставляется, сообщение имеет статус processed). Проверяем
  //    само сообщение (value_other + src).
  for (const e of edges.slice().reverse()) {
    const node = e?.node;
    if (!node?.c) continue;
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

    return { msgHash: node.c, amountNano: amount, src: info.src, now: Number(node.a) * 1000 };
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
  let tx: any = null;
  for (let attempt = 0; attempt < 5 && !tx; attempt++) {
    const json = (await graphql(q)) as any;
    tx = json?.data?.blockchain?.transaction;
    if (!tx) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  if (!tx || tx.b) return null;
  const outMsgs: string[] = tx.c || [];

  for (const msgHash of outMsgs) {
    if (!/^[0-9a-fA-F]{64}$/.test(msgHash)) continue;
    const info = await messageInfo(msgHash);
    if (!info) continue;

    const nackl = info.valueOther[NACKL_ECC_INDEX];
    if (!nackl) continue;
    const amount = BigInt(nackl);
    if (amount < amountNano) continue;

    return { msgHash, amountNano: amount, src: info.src, now: Number(tx.a) * 1000 };
  }
  return null;
}
