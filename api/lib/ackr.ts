/**
 * ackr.ts — выдача ACKR из казначейства (двухфазный TIP-3 перевод).
 *
 * Флоу (проверен 04.08 в Shellnet, перепроверен 05.08):
 *  1. C.deployTransaction(TRANSFER=1, amount, dest=player) — владелец
 *     → создаёт Transaction-контракт T (детерминированный адрес)
 *  2. M.sendTransaction(T, value, payload="") — оплата газа T:
 *     T.receive() видит msg.sender == владелец (M) и САМ вызывает
 *     C.acceptTransaction(transactionType, data) внутренним сообщением
 *     → списание ACKR с C, авто-деплой TIP-3 кошелька игрока
 *     (50 VMSHELL) + acceptTransfer; T самоуничтожается (flag 161)
 */
import { TOKEN_WALLET_ABI, MSIG_ABI, OWNER_WALLET_ADDR, TREASURY_ADDR, ownerKeys, isDev } from './config';
import { encodeMessage, sendMessage, graphql, NETWORK } from './tvm';

export const EMPTY_CELL = 'te6ccgEBAQEAAgAAAA==';
export const TRANSFER = 1;

function hexToDapp(addr: string): string {
  const hex = addr.split(':').pop()!;
  return hex;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Адрес Transaction-контракта: dst первого out-сообщения из ПОСЛЕДНЕЙ (свежей) транзакции C */
export async function findTransactionAddress(senderAccount: string): Promise<string | null> {
  const accountId = hexToDapp(senderAccount);
  const q = `query { blockchain { account(account_id: "${accountId}", dapp_id: "${accountId}") { transactions { edges { node { a: now out_msgs } } } } } }`;
  const json = (await graphql(q)) as any;
  const edges = json?.data?.blockchain?.account?.transactions?.edges || [];
  const sorted = edges.slice().sort((x: any, y: any) => Number(y?.node?.a) - Number(x?.node?.a));
  for (const e of sorted) {
    const out = e?.node?.out_msgs?.[0];
    if (!out) continue;
    const mq = `query { blockchain { message(hash: "${out}") { dst } } }`;
    const mj = (await graphql(mq)) as any;
    const dst = mj?.data?.blockchain?.message?.dst;
    if (dst) return dst;
  }
  return null;
}

/**
 * Полный перевод ACKR игроку.
 * @param playerWallet адрес игрока "0:hex"
 * @param ackrNano сумма ACKR в nano (9 decimals)
 * @returns хэши шагов
 */
export async function sendAckr(playerWallet: string, ackrNano: string): Promise<{ deployTx?: string; tAddr?: string }> {
  const keys = ownerKeys();
  if (!keys) throw new Error('TREASURY_OWNER_PUBLIC/SECRET не заданы');

  // ── Шаг 1: deployTransaction на кошельке владельца ──
  const step1 = await encodeMessage({
    abi: TOKEN_WALLET_ABI,
    address: OWNER_WALLET_ADDR,
    functionName: 'deployTransaction',
    input: {
      transactionType: TRANSFER,
      value: ackrNano,
      destinationOwner: playerWallet,
      toWithdraw: null,
    },
    keys,
  });
  const r1 = await sendMessage({ body: step1.message, accountId: hexToDapp(OWNER_WALLET_ADDR), dappId: hexToDapp(OWNER_WALLET_ADDR) });
  if (r1.json?.error) throw new Error(`deployTransaction: ${JSON.stringify(r1.json.error).slice(0, 200)}`);
  if ((r1.json as any)?.result?.aborted) throw new Error('deployTransaction aborted');

  // ── Шаг 2: найти T и оплатить газ с казначейства: T.receive() сам
  //     вызовет C.acceptTransaction (msg.sender == M == владелец C) ──
  await sleep(4000);
  const tAddr = await findTransactionAddress(OWNER_WALLET_ADDR);
  if (!tAddr) throw new Error('Не найден адрес Transaction-контракта');

  const step2 = await encodeMessage({
    abi: MSIG_ABI,
    address: TREASURY_ADDR,
    functionName: 'sendTransaction',
    input: {
      dest: tAddr,
      value: '1000000000',
      cc: {},
      bounce: false,
      flags: 0,
      payload: EMPTY_CELL,
    },
    keys,
  });
  const r2 = await sendMessage({ body: step2.message, accountId: hexToDapp(TREASURY_ADDR), dappId: hexToDapp(TREASURY_ADDR) });
  if (r2.json?.error) throw new Error(`sendTransaction: ${JSON.stringify(r2.json.error).slice(0, 200)}`);
  if ((r2.json as any)?.result?.aborted) throw new Error('sendTransaction aborted');

  return {
    deployTx: (r1.json as any)?.result?.tx_hash,
    tAddr,
  };
}

export { isDev, NETWORK };
