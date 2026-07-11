/**
 * Bee Engine service layer for acki-nacki blockchain integration.
 *
 * Wraps @teamgosh/bee-sdk WASM module.
 * SDK must be built locally: cd bee_sdk && wasm-pack build --target web
 * Then install: npm install ../../../bee_sdk/pkg
 *
 * If SDK is not installed, all functions will throw on first call.
 */

const ENDPOINTS = ['https://mainnet.ackinacki.org'];
const API_URL = 'https://app-backend-dev.ackinacki.org/api';
const APP_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';

export interface WalletConnection {
  walletName: string;
  walletAddress: string;
  profileAddress: string;
  sessionId: string;
  description: string;
  sessionStateJson: string;
}

export interface MiningKeys {
  ownerPublic: string;
  ownerSecret: string;
  minerAddress: string | null;
  areKeysPropagated: boolean;
}

export interface MinerDebugInfo {
  tapSum: string;
  tapSum5m: string;
  epochStart: string;
  epoch5mStart: string;
}

// Lazy-loaded SDK — typed as any to avoid hard dependency on local WASM package
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdkModule: any = null;
let sdkInitPromise: Promise<void> | null = null;

async function loadSdk(): Promise<any> {
  if (sdkModule) return sdkModule;
  if (sdkInitPromise) {
    await sdkInitPromise;
    return sdkModule;
  }

  sdkInitPromise = (async () => {
    const mod = await import('@teamgosh/bee-sdk');
    const wasmUrl = new URL('@teamgosh/bee-sdk/bee_sdk_bg.wasm', import.meta.url);
    await mod.default({ module_or_path: wasmUrl });
    sdkModule = mod;
  })();

  await sdkInitPromise;
  return sdkModule;
}

// ─── Storage helpers ────────────────────────────────────

const SESSION_KEY = 'acki-rivals-wallet-session';
const MINING_KEYS_PREFIX = 'acki-rivals-mining-keys';

function readSession(): WalletConnection | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(conn: WalletConnection | null) {
  if (conn) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(conn));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function readMiningKeys(profileAddress: string): MiningKeys | null {
  try {
    const raw = localStorage.getItem(`${MINING_KEYS_PREFIX}:${profileAddress}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeMiningKeys(profileAddress: string, keys: MiningKeys | null) {
  const key = `${MINING_KEYS_PREFIX}:${profileAddress}`;
  if (keys) {
    localStorage.setItem(key, JSON.stringify(keys));
  } else {
    localStorage.removeItem(key);
  }
}

// ─── Public API ─────────────────────────────────────────

export function getStoredSession(): WalletConnection | null {
  return readSession();
}

export async function createSession(): Promise<{
  deepLink: string;
  sessionId: string;
  description: string;
  sessionStateJson: string;
  clientDhSecret: string;
  createdAt: number;
}> {
  const sdk = await loadSdk();
  const beeConnect = new sdk.BeeConnect();
  const session = beeConnect.create_shared_key_session(APP_ID, 300, null);

  return {
    deepLink: session.deep_link,
    sessionId: session.session_id,
    description: session.description,
    sessionStateJson: session.session_state_json,
    clientDhSecret: session.client_dh_secret,
    createdAt: session.created_at,
  };
}

export async function waitWalletHello(
  sessionId: string,
  description: string,
  clientDhSecret: string,
  createdAt: number,
): Promise<WalletConnection> {
  const sdk = await loadSdk();
  const beeConnect = new sdk.BeeConnect();

  const hello = await beeConnect.wait_wallet_hello(
    ENDPOINTS,
    sessionId,
    description,
    clientDhSecret,
    createdAt,
    120,
    1000,
  );

  const connection: WalletConnection = {
    walletName: hello.wallet_name,
    walletAddress: hello.wallet_address,
    profileAddress: hello.profile_address,
    sessionId,
    description,
    sessionStateJson: hello.session_state_json,
  };

  writeSession(connection);
  return connection;
}

export async function disconnectSession(conn: WalletConnection): Promise<void> {
  const sdk = await loadSdk();
  const beeConnect = new sdk.BeeConnect();

  await beeConnect.disconnect_session(
    ENDPOINTS,
    conn.sessionId,
    conn.description,
    conn.sessionStateJson,
    'user_requested',
    30,
    1000,
  );

  writeMiningKeys(conn.profileAddress, null);
  writeSession(null);
}

export async function requestMiningKeys(conn: WalletConnection): Promise<{
  ownerPublic: string;
  ownerSecret: string;
}> {
  const sdk = await loadSdk();

  const generated = await sdk.gen_mining_keys(APP_ID);

  const beeConnect = new sdk.BeeConnect();
  const request = await beeConnect.request_set_mining_keys(
    ENDPOINTS,
    conn.sessionId,
    conn.description,
    conn.sessionStateJson,
    APP_ID,
    generated.public,
    30,
    1000,
  );

  // Update session state after re-key
  if (request.updated_session_state_json) {
    conn.sessionStateJson = request.updated_session_state_json;
    writeSession(conn);
  }

  return {
    ownerPublic: generated.public,
    ownerSecret: generated.secret,
  };
}

export async function waitForMiningKeysPropagation(
  walletName: string,
  ownerPublic: string,
): Promise<string> {
  const sdk = await loadSdk();

  const minerAddress = await sdk.get_miner_address_by_wallet_name({
    client_config: { network: { endpoints: ENDPOINTS } },
    wallet_name: walletName,
  });

  await sdk.ensure_mining_keys_propagated({
    client_config: { network: { endpoints: ENDPOINTS } },
    miner_address: minerAddress,
    app_id: APP_ID,
    expected_owner_public: ownerPublic,
    max_attempts: 120,
    interval_ms: 2000,
  });

  return minerAddress;
}

export async function getNacklBalance(walletAddress: string): Promise<string> {
  const sdk = await loadSdk();
  const wallet = new sdk.Wallet(ENDPOINTS, null, API_URL, APP_ID);

  try {
    const balances = await wallet.get_multifactor_balances({
      multifactor_address: walletAddress,
    });
    const token1 = balances.ecc['1'] ?? '0';
    return formatNano(token1);
  } finally {
    wallet.free();
  }
}

export async function initMiner(
  minerAddress: string,
  ownerPublic: string,
  ownerSecret: string,
) {
  const sdk = await loadSdk();
  return await sdk.Miner.new(ENDPOINTS, APP_ID, minerAddress, ownerPublic, ownerSecret);
}

export async function checkSessionActive(conn: WalletConnection): Promise<boolean> {
  const sdk = await loadSdk();
  const beeConnect = new sdk.BeeConnect();

  const resolved = await beeConnect.resolve_profile_address(ENDPOINTS, conn.description);
  if (resolved.trim().toLowerCase() !== conn.profileAddress.trim().toLowerCase()) {
    return false;
  }

  return await beeConnect.is_session_profile_deployed(ENDPOINTS, conn.description);
}

export function getStoredMiningKeys(profileAddress: string): MiningKeys | null {
  return readMiningKeys(profileAddress);
}

export function storeMiningKeys(profileAddress: string, keys: MiningKeys) {
  writeMiningKeys(profileAddress, keys);
}

export function clearStoredMiningKeys(profileAddress: string) {
  writeMiningKeys(profileAddress, null);
}

// ─── Helpers ────────────────────────────────────────────

function formatNano(value: string, decimals = 9, fractionDigits = 4): string {
  let amount = 0n;
  try {
    amount = BigInt(value);
  } catch {
    return '0.0000';
  }
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const frac = amount % base;
  const fracScaled = (frac * 10n ** BigInt(fractionDigits)) / base;
  return `${whole}.${fracScaled.toString().padStart(fractionDigits, '0')}`;
}

export { ENDPOINTS, API_URL, APP_ID };
