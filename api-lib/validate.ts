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
  for (let attempt = 0; attempt < 2; attempt++) {
    let json: Record<string, unknown> | null = null;
    try {
      json = (await graphql(q)) as any;
    } catch {
      // retry ниже
    }
    const m = (json as any)?.data?.blockchain?.message;
    if (m) {
      const valueOther: Record<string, string> = {};
      for (const c of m.c || []) {
        valueOther[String(c.currency)] = String(c.value);
      }
      return { src: m.a, dst: m.b, valueOther };
    }
    await new Promise((r) => setTimeout(r, 800));
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
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      json = (await graphql(q)) as any;
    } catch {
      json = null;
    }
    const acc = json?.data?.blockchain?.account;
    if (acc) break;
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  const edges = json?.data?.blockchain?.account?.transactions?.edges || [];

  // edges идут от старых к свежим — идём с конца, чтобы первым подобрался
  // самый свежий подходящий платёж.
  // ⚠️ НЕ отбрасываем aborted=true: на майнете все NACKL-переводы проходят
  //    aborted-транзакцией (контракт кидает исключение на currency-перевод,
  //    но NACKL доставляется, сообщение имеет статус processed). Проверяем
  //    само сообщение (value_other + src).
  const nodes = edges.slice().reverse().map((e: any) => e?.node).filter((n: any) => n?.c);
  const infos = await Promise.all(nodes.map((n: any) => messageInfo(n.c)));
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const info = infos[i];
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
 * Все NACKL-платежи на казначейство РОВНО amountNano (без фильтра по src:
 * на майнете у ВСЕХ переводов на казначейство src = адрес казначейства,
 * отправителя по src не отличить). Идентификация игрока — точная сумма
 * заявки + первый незачисленный платёж (msg_hash UNIQUE в ledger).
 */
export async function scanAllPayments(
  amountNano: bigint,
  treasuryAccount: string,
): Promise<Payment[]> {
  const accountId = treasuryAccount.split(':').pop()!;
  const dappId = TREASURY_DAPP_ID || accountId;
  const q = `query { blockchain { account(account_id: "${accountId}", dapp_id: "${dappId}") { transactions { edges { node { a: now b: aborted c: in_msg } } } } } }`;
  let json: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      json = (await graphql(q)) as any;
    } catch {
      json = null;
    }
    const acc = json?.data?.blockchain?.account;
    if (acc) break;
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  const edges = json?.data?.blockchain?.account?.transactions?.edges || [];

  // Все messageInfo-запросы параллельно (иначе депозит не влезает
  // в таймаут serverless-функции при ленте в десятки транзакций).
  const nodes = edges.slice().reverse().map((e: any) => e?.node).filter((n: any) => n?.c);
  const infos = await Promise.all(nodes.map((n: any) => messageInfo(n.c)));

  const found: Payment[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const info = infos[i];
    if (!info) continue;

    const nackl = info.valueOther[NACKL_ECC_INDEX];
    if (!nackl) continue;
    const amount = BigInt(nackl);
    if (amount !== amountNano) continue;

    found.push({ msgHash: node.c, amountNano: amount, src: info.src, now: Number(node.a) * 1000 });
  }
  return found;
}

/**
 * Найти свежий NACKL-платёж от player на M.
 */
export async function findPayment(player: string, amountNano: bigint, treasuryAccount: string): Promise<Payment | null> {
  return scanPayments(amountNano, treasuryAccount, player);
}
