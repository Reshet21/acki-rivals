import { beforeEach, describe, expect, it, vi } from 'vitest';

const hello = vi.hoisted(() => vi.fn());
vi.mock('@teamgosh/bee-sdk', () => ({
  default: vi.fn().mockResolvedValue(undefined),
  BeeConnect: class {
    create_shared_key_session() {
      return { deep_link: 'https://example.com', session_id: 'id', description: 'description', session_state_json: '{}', client_dh_secret: 'secret', created_at: 123n };
    }
    wait_wallet_hello = hello;
  },
}));

import { createSession, getStoredSession, storeSession, waitWalletHello } from './beeEngine';

describe('wallet connection', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    hello.mockReset();
  });

  it('passes the SDK bigint timestamp and only persists an accepted connection', async () => {
    hello.mockResolvedValue({ wallet_name: 'alice', wallet_address: 'address', profile_address: 'profile', session_state_json: 'state' });
    const session = await createSession();
    const connection = await waitWalletHello(session.sessionId, session.description, session.clientDhSecret, session.createdAt);
    expect(hello).toHaveBeenCalledWith(expect.any(Array), 'id', 'description', 'secret', 123n, 180, 1000);
    expect(getStoredSession()).toBeNull();
    storeSession(connection);
    expect(getStoredSession()).toEqual(connection);
  });
});
