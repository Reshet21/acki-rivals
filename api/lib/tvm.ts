/**
 * tvm.ts — eversdk glue for Vercel serverless (Node ESM).
 *
 * - loads @eversdk/lib-web with a precompiled WebAssembly.Module
 *   (embedded as base64 ESM module — see scripts/embed-wasm.mjs,
 *   ships via npm postinstall so nft never has to trace the .wasm),
 * - provides encodeMessage / sendMessage (POST /v2/messages) / GraphQL helpers
 *   for the Acki Nacki Shellnet relay.
 *
 * Requires scripts/patch-eversdk.mjs to have run (npm postinstall).
 */
import { createRequire } from 'node:module';
import { TonClient } from '@eversdk/core';
import wasmBase64 from './eversdk-wasm-b64.js';

const nodeRequire = createRequire(import.meta.url);
(globalThis as unknown as { __tvmRequire: (n: string) => unknown }).__tvmRequire = (name: string) => nodeRequire(name);

const NETWORK = process.env.TREASURY_NETWORK || 'https://shellnet.ackinacki.org';

let _client: TonClient | null = null;

type LibWebMod = {
  libWeb: unknown;
  libWebSetup: (opts: { disableSeparateWorker?: boolean; binaryURL?: string }) => void;
};

function getLibWeb(): LibWebMod {
  return nodeRequire('@eversdk/lib-web') as LibWebMod;
}

function getClient(): TonClient {
  if (_client) return _client;
  // NOTE: options.loadModule сломан в lib-web 1.48 (init вызывается до объявления);
  // binaryURL через data: URL работает и не требует http-сервер (Vercel-совместимо).
  const libWebMod = getLibWeb();
  libWebMod.libWebSetup({
    disableSeparateWorker: true,
    binaryURL: `data:application/wasm;base64,${wasmBase64}`,
  });
  TonClient.useBinaryLibrary(libWebMod.libWeb as unknown as (() => Promise<import('@eversdk/core/dist/bin').BinaryLibrary>));
  _client = new TonClient({ abi: { message_expiration_timeout: 120000 } });
  return _client;
}

function closeClient(): void {
  if (_client) {
    try {
      _client.close();
    } catch {
      // ignore
    }
    _client = null;
  }
}

export interface EncodedMessage {
  message: string;
  message_id: string;
  address: string;
}

export interface EncodeOptions {
  abi: object;
  functionName: string;
  input?: Record<string, unknown>;
  address?: string;
  tvc?: string;
  initialData?: Record<string, unknown>;
  keys: { public: string; secret: string } | null;
}

export async function encodeMessage(opts: EncodeOptions): Promise<EncodedMessage> {
  const client = getClient();
  const signer = opts.keys
    ? { type: 'Keys' as const, keys: opts.keys }
    : { type: 'None' as const };
  const res = await client.abi.encode_message({
    abi: { type: 'Contract', value: opts.abi },
    signer,
    ...(opts.address ? { address: opts.address } : {}),
    ...(opts.tvc
      ? { deploy_set: { tvc: opts.tvc, initial_data: opts.initialData || {} } }
      : {}),
    call_set: { function_name: opts.functionName, input: opts.input || {} },
  });
  return { message: res.message, message_id: res.message_id, address: res.address };
}

export async function sendMessage(opts: {
  body: string;
  accountId: string;
  dappId: string;
}): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${NETWORK}/v2/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      {
        id: `msg-${Date.now()}`,
        body: opts.body,
        account_id: opts.accountId,
        dapp_id: opts.dappId,
      },
    ]),
  });
  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: res.status, json };
}

export async function graphql(query: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${NETWORK}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors).slice(0, 300)}`);
  }
  return json;
}

export { NETWORK, closeClient };
