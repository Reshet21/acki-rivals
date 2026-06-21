declare module '@teamgosh/bee-sdk' {
  export default function init(config: { module_or_path: URL | string | Request }): Promise<void>;

  export class BeeConnect {
    create_shared_key_session(appId: string, timeout: number, nonce: string | null): {
      deep_link: string;
      session_id: string;
      description: string;
      session_state_json: string;
      client_dh_secret: string;
      created_at: number;
    };
    wait_wallet_hello(
      endpoints: string[],
      sessionId: string,
      description: string,
      clientDhSecret: string,
      createdAt: number,
      maxAttempts: number,
      intervalMs: number,
    ): Promise<{
      wallet_name: string;
      wallet_address: string;
      profile_address: string;
      session_state_json: string;
      nonce?: string;
      signature?: string;
      epk_public?: string;
    }>;
    request_set_mining_keys(
      endpoints: string[],
      sessionId: string,
      description: string,
      sessionStateJson: string,
      appId: string,
      ownerPublic: string,
      timeout: number,
      intervalMs: number,
    ): Promise<{ message_id?: string; updated_session_state_json?: string }>;
    disconnect_session(
      endpoints: string[],
      sessionId: string,
      description: string,
      sessionStateJson: string,
      reason: string,
      timeout: number,
      intervalMs: number,
    ): Promise<void>;
    resolve_profile_address(endpoints: string[], description: string): Promise<string>;
    is_session_profile_deployed(endpoints: string[], description: string): Promise<boolean>;
    request_sign_challenge(
      endpoints: string[],
      sessionId: string,
      description: string,
      sessionStateJson: string,
      nonce: string,
      timeout: number,
      intervalMs: number,
    ): Promise<{ sent_at: number; message_id: string; updated_session_state_json: string }>;
    wait_challenge_response(
      endpoints: string[],
      sessionId: string,
      description: string,
      sessionStateJson: string,
      sentAt: number,
      maxAttempts: number,
      intervalMs: number,
    ): Promise<{
      nonce: string;
      signature: string;
      wallet_address: string;
      updated_session_state_json?: string;
    }>;
  }

  export function gen_mining_keys(appId: string): Promise<{ public: string; secret: string }>;
  export function get_miner_address_by_wallet_name(config: {
    client_config: { network: { endpoints: string[] } };
    wallet_name: string;
  }): Promise<string>;
  export function ensure_mining_keys_propagated(config: {
    client_config: { network: { endpoints: string[] } };
    miner_address: string;
    app_id: string;
    expected_owner_public: string;
    max_attempts: number;
    interval_ms: number;
  }): Promise<void>;

  export class Miner {
    static new(
      endpoints: string[],
      appId: string,
      minerAddress: string,
      ownerPublic: string,
      ownerSecret: string,
    ): Promise<Miner>;
    can_start(): boolean;
    start(intervalMs: number, callback: (message: string) => void): void;
    stop(): void;
    add_tap(a: number, b: number): void;
    get_reward(): Promise<void>;
    get_miner_data(): Promise<{
      tap_sum: bigint;
      tap_sum_5m: bigint;
      epoch_start: bigint;
      epoch_5m_start: bigint;
      free(): void;
    }>;
    free(): void;
  }

  export class Wallet {
    constructor(endpoints: string[], a: null, apiUrl: string, appId: string);
    get_multifactor_balances(config: {
      multifactor_address: string;
    }): Promise<{ ecc: Record<string, string> }>;
    free(): void;
  }
}
