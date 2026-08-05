/**
 * config.ts — адреса и параметры казначейства (Shellnet).
 * Все значения можно переопределить env-переменными на Vercel.
 */
import rootAbi from './abi/RootToken.abi.json';
import msigAbi from './abi/UpdateCustodianMultisigWallet.abi.json';

export const ROOT_TOKEN_ABI = rootAbi;
export const MSIG_ABI = msigAbi;
// TokenWallet ABI (deployTransaction/acceptTransaction) — временно лежит
// только в /root/token-deploy; для сервера ABI кошелька зашит ниже по сигнатурам.
export const TOKEN_WALLET_ABI = {
  'ABI version': 2,
  version: '2.4',
  header: ['pubkey', 'time', 'expire'],
  functions: [
    { name: 'deployTransaction', inputs: [
      { name: 'transactionType', type: 'uint8' },
      { name: 'value', type: 'optional(uint128)' },
      { name: 'destinationOwner', type: 'optional(address)' },
      { name: 'toWithdraw', type: 'optional(uint256)' },
    ], outputs: [] },
    { name: 'acceptTransaction', inputs: [{ name: 'transactionType', type: 'uint8' }, { name: 'data', type: 'cell' }], outputs: [] },
    { name: 'acceptTransfer', inputs: [{ name: 'amount', type: 'uint128' }, { name: 'from', type: 'address' }, { name: 'value', type: 'uint128' }, { name: 'flag', type: 'uint8' }, { name: 'payload', type: 'cell' }], outputs: [] },
    { name: 'getWalletAddress', inputs: [{ name: 'root_', type: 'address' }, { name: 'owner_', type: 'address' }, { name: 'pubkey_', type: 'uint256' }], outputs: [{ name: 'value0', type: 'address' }] },
    { name: 'getDetails', inputs: [], outputs: [] },
  ],
} as const;

/** RootToken (TIP-3 root, self-rooted) */
export const ROOT_ADDR = process.env.TREASURY_ROOT_ADDR || '0:09c28a5d676dfda349d1dbd0db0ae22d61ca08f569a6b8e2e17c2894620d3250';

/** TIP-3 кошелёк владельца (откуда уходят ACKR) */
export const OWNER_WALLET_ADDR =
  process.env.TREASURY_OWNER_WALLET_ADDR ||
  '0:e8f3f6be4da8754d8bb72240187453f06485c8b090bb4f10766167af2dd7e125';

/** Казначейство M (мультисиг; сюда игроки шлют NACKL) */
export const TREASURY_ADDR =
  process.env.TREASURY_ADDR ||
  '0:badc33121c6284f5dbf1ec829edbd1d97f5fc7fae5f15461acdd74d77c341d85';

export const NACKL_ECC_INDEX = '1';

/** Сколько ACKR выдаём за 1 NACKL (nano = ACKR * 1e9) */
export const ACKR_PER_NACKL = Number(process.env.TREASURY_ACKR_PER_NACKL || 1);
/** Минимальный платёж в NACKL */
export const MIN_NACKL = Number(process.env.TREASURY_MIN_NACKL || 1);

export function ownerKeys(): { public: string; secret: string } | null {
  const pub = process.env.TREASURY_OWNER_PUBLIC;
  const sec = process.env.TREASURY_OWNER_SECRET;
  if (!pub || !sec) return null;
  return { public: pub, secret: sec };
}

export const isDev =
  (process.env.TREASURY_MODE || 'dev') !== 'live';
