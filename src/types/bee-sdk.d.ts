/* tslint:disable */
/* eslint-disable */
// Type declarations for @teamgosh/bee-sdk WASM module
// Based on actual bee_sdk.d.ts from npm package (v3.x)

declare module '@teamgosh/bee-sdk' {
  export default function init(config: { module_or_path: URL | string | Request }): Promise<void>;

  // ── Type aliases ──

  export type TKeyPair = { public: string; secret: string };

  export type TConnectSessionState = {
    encryption_root: string;
    my_dh_secret: string;
    peer_dh_public: string;
    signing_public: string;
    signing_secret: string;
    created_at: number;
    expires_at: number;
  };

  export type TZkLoginTempData = {
    maxEpoch: number;
    randomness: string;
    ephemeralPrivateKey: string;
  };

  export type TZkLoginCompleteWithProverParams = {
    savedData: TZkLoginTempData;
    jwt: string;
    jwtSub: string;
    jwtAud: string;
    userPassword: string;
    proverUrl: string;
  };

  export type TParamsOfAddZKPFactor = {
    wallet_name: string;
    proof: string;
    epk: string;
    esk: string;
    header_base_64: string;
    epk_expire_at: number;
    jwk_expires_at: number;
    kid: string;
    sub: string;
    password: string;
    zkid: string;
  };

  export type TSendTokensDirectReq = {
    multifactor_address: string;
    destination_address: string;
    token_root: string;
    amount_raw: string | number;
    flags: number;
    signer_keys: TKeyPair;
    bounce?: boolean;
    value?: number;
    payload?: string;
  };

  export type TGetEPKExpireReq = {
    epk: string;
    multifactor_address: string;
  };

  export type TParamsOfDeployMultifactor = {
    wallet_name: string;
    zkid: string;
    password: string;
    proof: string;
    epk: string;
    esk: string;
    jwk_modulus: string;
    jwk_modulus_expire_at: number;
    index_mod_4: number;
    iss_base_64: string;
    header_base_64: string;
    epk_expire_at: number;
    kid: string;
    sub: string;
  };

  export type TParamsOfGetMultifactorBalances = {
    multifactor_address: string;
  };

  export type TParamsOfGetHistory = {
    multifactor_address: string;
    token_id: string;
    page_size?: number;
    cursor?: string;
    mining_cursor?: string;
  };

  export type TParamsOfGetMultifactorInfo = {
    address: string;
  };

  export type TParamsOfPrepareDeploy = {
    zkid: string;
    password: string;
    proof: string;
    epk: string;
    esk: string;
    jwk_modulus: string;
    jwk_modulus_expire_at: number;
    index_mod_4: number;
    iss_base_64: string;
    header_base_64: string;
    epk_expire_at: number;
    keys: TKeyPair;
    kid: string;
    wallet_name: string;
    multifactor_address: string;
    sub: string;
  };

  export type TParamsOfEnsureMiningKeysPropagated = {
    client_config: Record<string, unknown>;
    miner_address: string;
    app_id: string;
    expected_owner_public: string;
    max_attempts?: number;
    interval_ms?: number;
  };

  export type TParamsOfGetMinerAddressByWalletName = {
    client_config: Record<string, unknown>;
    wallet_name: string;
  };

  export type TParamsOfDeployMiner = {
    multifactor_address: string;
    signer_keys: TKeyPair;
  };

  export type TParamsOfSetMiningKeys = {
    multifactor_address: string;
    signer_keys: TKeyPair;
    mining_pubkey: string;
    app_id?: string;
    epk_expire_at?: number;
  };

  export type TParamsOfDelMiningKey = {
    multifactor_address: string;
    signer_keys: TKeyPair;
    app_id?: string;
    epk_expire_at?: number;
    and_wait?: boolean;
  };

  export type TParamsOfChangeSeedPhrase = {
    password: string;
    signer_keys: TKeyPair;
    new_owner_keys: TKeyPair;
    multifactor_address: string;
  };

  export type TParamsOfGetTokensBalances = {
    multifactor_address: string;
    token_roots: { token_root: string; token_dapp: string }[];
  };

  export type TParamsOfGetMinerAddress = {
    multifactor_address: string;
  };

  export type TBuyShellsReq = {
    multifactor_address: string;
    usdc_amount: number;
    signer_keys: TKeyPair;
    bounce?: boolean;
  };

  export type TRedeemNacklReq = {
    multifactor_address: string;
    nackl_amount: number;
    signer_keys: TKeyPair;
    bounce?: boolean;
  };

  export type TDeleteZkpFactorByItselfReq = {
    multifactor_address: string;
    signer_keys: TKeyPair;
  };

  export type TUpdateMultifactorZkIdReq = {
    address: string;
    zkid: string;
    password: string;
    proof: string;
    epk: string;
    esk: string;
    jwk_modulus: string;
    jwk_modulus_expire_at: number;
    index_mod_4: number;
    iss_base_64: string;
    header_base_64: string;
    epk_expire_at: number;
    pubkey: string;
    secretkey: string;
    kid: string;
    sub: string;
  };

  export type TParamsOfQueryConnectSessionMessages = {
    session_id: string;
    description: string;
    session_state?: TConnectSessionState;
    created_at_from?: number;
    before?: string;
    limit?: number;
  };

  // ── Result classes ──

  export class ResultOfGetKeys {
    private constructor();
    free(): void;
    readonly public: string;
    readonly secret: string;
  }

  export class ZkLoginPrepareResult {
    private constructor();
    free(): void;
    readonly ephemeral_private_key: string;
    readonly max_epoch: bigint;
    readonly nonce: string;
    readonly randomness: string;
  }

  export class ZkLoginCompleteWithProverResult {
    private constructor();
    free(): void;
    readonly ephemeral_private_key: string;
    readonly ephemeral_public_key_in_hex: string;
    readonly ephemeral_secret_key_in_hex: string;
    readonly header_base64: string;
    readonly iss_base64_details: IssBase64Details;
    readonly max_epoch: bigint;
    readonly zk_proof_compressed: string;
    readonly zkid: string;
  }

  export class IssBase64Details {
    private constructor();
    free(): void;
    readonly index_mod4: number;
    readonly value: string;
  }

  export class ResultOfAddZKPFactor {
    private constructor();
    free(): void;
    readonly address: string;
    readonly message_id: string | undefined;
    readonly message_ids: string[];
    readonly name: string;
    readonly password_hash: string;
    readonly pubkey: string;
    readonly signing_keys: ResultOfGetKeys;
  }

  export class ResultOfBlockchainWrite {
    private constructor();
    free(): void;
    readonly message_ids: string[];
    readonly pending_reason: string | undefined;
    readonly pending_stage: string | undefined;
  }

  export class ResultOfGetEPKExpireAt {
    private constructor();
    free(): void;
    readonly epk_expire_at: bigint;
  }

  export class ResultOfGetNativeBalances {
    private constructor();
    free(): void;
    readonly ecc: Record<string, string>;
    readonly popitgame: Record<string, string>;
  }

  export class ResultOfGetMultifactorInfo {
    private constructor();
    free(): void;
    readonly data: MultifactorAccountData | undefined;
  }

  export class MultifactorAccountData {
    private constructor();
    free(): void;
    readonly name: string;
    readonly zkid: string;
    readonly iss_base_64: string;
    readonly owner_pubkey: string;
    readonly factors_len: string;
    readonly use_security_card: boolean;
    readonly factors_ordered_by_timestamp: Record<string, string>;
    readonly jwk_modulus_data: Record<string, { modulus: string; modulus_expire_at: string }>;
    readonly jwk_modulus_data_len: string;
    readonly min_value: string;
    readonly white_list_of_address: Record<string, boolean>;
    readonly m_security_cards_len: string;
    readonly m_transactions_len: string;
    readonly max_cleanup_txns: string;
    readonly force_remove_oldest: boolean;
    readonly index_mod_4: string;
    readonly candidate_new_owner_pubkey_and_expiration: Record<string, string>;
    readonly pub_recovery_key: string;
    readonly root: string;
    readonly wasm_hash: string;
    readonly jwk_update_key: string;
  }

  export class ResultOfGetHistory {
    private constructor();
    free(): void;
    readonly data: TxData[];
    readonly has_next_page: boolean;
    readonly next_cursor: string | undefined;
    readonly next_mining_cursor: string | undefined;
  }

  export class TxData {
    private constructor();
    free(): void;
    readonly created_at: string;
    readonly id: string;
    readonly src_name: string | undefined;
    readonly tx_type: string;
    readonly value: string;
  }

  export class ResultOfGetMvMultifactorAddress {
    private constructor();
    free(): void;
    readonly address: string;
  }

  export class ResultOfGetMinerDetails {
    private constructor();
    free(): void;
    readonly address: string;
    readonly owner_address: string;
    readonly owner_public: Record<string, string>;
  }

  export class ResultOfGetMultifactorDetails {
    private constructor();
    free(): void;
    readonly address: string;
  }

  export class ResultOfCreateSharedKeySession {
    private constructor();
    free(): void;
    readonly app_id: string;
    readonly client_dh_public: string;
    readonly client_dh_secret: string;
    readonly created_at: bigint;
    readonly deep_link: string;
    readonly description: string;
    readonly expires_at: bigint;
    readonly payload_b64url: string;
    readonly payload_json: string;
    readonly session_id: string;
  }

  export class ResultOfDeployMultifactor {
    private constructor();
    free(): void;
    readonly address: string;
    readonly message_id: string | undefined;
    readonly message_ids: string[];
    readonly name: string;
    readonly password_hash: string;
    readonly pending_reason: string | undefined;
    readonly pending_stage: string | undefined;
    readonly phrase: string;
    readonly pubkey: string;
    readonly signing_keys: ResultOfGetKeys;
  }

  export class ResultOfGenMiningKeys {
    private constructor();
    free(): void;
    readonly deep_link: string;
    readonly public: string;
    readonly secret: string;
  }

  export class ResultOfSendMessage {
    private constructor();
    free(): void;
    readonly aborted: boolean | undefined;
    readonly block_hash: string | undefined;
    readonly current_time: string | undefined;
    readonly exit_code: number | undefined;
    readonly message_hash: string | undefined;
    readonly producers: string[];
    readonly thread_id: string | undefined;
    readonly tx_hash: string | undefined;
  }

  export class PreparedDeployParams {
    private constructor();
    free(): void;
    readonly epk: string;
    readonly epk_expire_at: bigint;
    readonly epk_sig: string;
    readonly header_base_64: string;
    readonly index_mod_4: number;
    readonly iss_base_64: string;
    readonly jwk_modulus: string;
    readonly jwk_modulus_expire_at: bigint;
    readonly jwk_update_key: string;
    readonly jwk_update_key_sig: string;
    readonly kid: string;
    readonly name: string;
    readonly proof: string;
    readonly provider: string;
    readonly pub_recovery_key: string;
    readonly pub_recovery_key_sig: string;
    readonly root_provider_certificates: Record<string, string>;
    readonly zkid: string;
  }

  export class ResultGetMirrorAddress {
    private constructor();
    free(): void;
    readonly address: string;
  }

  export class MultifactorAccountData {
    private constructor();
    free(): void;
    readonly name: string;
    readonly zkid: string;
  }

  export class ResultOfCheckNameAvailability {
    private constructor();
    free(): void;
    readonly is_available: boolean;
    readonly multifactor_address: string | undefined;
  }

  export class ResultOfValidateWalletName {
    private constructor();
    free(): void;
    readonly error_code: number | undefined;
    readonly is_valid: boolean;
  }

  // ── Main classes ──

  export class BeeConnect {
    free(): void;
    constructor(max_rps?: number | null);
    ping(): string;
    create_shared_key_session(app_id: string, ttl_secs?: number | null, nonce?: string | null): ResultOfCreateSharedKeySession;
    decode_connect_payload_b64url(payload_b64url: string): any;
    disconnect_session(
      endpoints: string[],
      session_id: string,
      description: string,
      session_state_json: string,
      reason?: string | null,
      max_attempts?: number | null,
      interval_ms?: number | null,
    ): Promise<ResultOfDisconnectSession>;
    is_session_profile_deployed(endpoints: string[], description: string): Promise<boolean>;
    query_active_sessions_by_multifactor(
      endpoints: string[],
      multifactor_address: string,
      app_id?: string | null,
      created_at_from?: bigint | null,
      before?: string | null,
    ): Promise<any>;
    request_set_mining_keys(
      endpoints: string[],
      session_id: string,
      description: string,
      session_state_json: string,
      app_id: string,
      owner_public: string,
      max_attempts?: number | null,
      interval_ms?: number | null,
    ): Promise<ResultOfRequestSetMiningKeys>;
    request_sign_challenge(
      endpoints: string[],
      session_id: string,
      description: string,
      session_state_json: string,
      nonce: string,
      max_attempts?: number | null,
      interval_ms?: number | null,
    ): Promise<ResultOfRequestSignChallenge>;
    resolve_profile_address(endpoints: string[], description: string): Promise<string>;
    wait_challenge_response(
      endpoints: string[],
      session_id: string,
      description: string,
      session_state_json?: string | null,
      created_at_from?: bigint | null,
      max_attempts?: number | null,
      interval_ms?: number | null,
    ): Promise<ResultOfWaitChallengeResponse>;
    wait_wallet_hello(
      endpoints: string[],
      session_id: string,
      description: string,
      client_dh_secret: string,
      created_at_from?: bigint | null,
      max_attempts?: number | null,
      interval_ms?: number | null,
    ): Promise<ResultOfWaitWalletHello>;
    wait_set_mining_keys_request(
      endpoints: string[],
      session_id: string,
      description: string,
      created_at_from?: bigint | null,
      max_attempts?: number | null,
      interval_ms?: number | null,
      session_state_json?: string | null,
    ): Promise<ResultOfWaitSetMiningKeysRequest>;
  }

  export class ResultOfWaitWalletHello {
    private constructor();
    free(): void;
    readonly wallet_name: string;
    readonly wallet_address: string;
    readonly profile_address: string;
    readonly session_state_json: string;
    readonly nonce: string | undefined;
    readonly signature: string | undefined;
    readonly epk_public: string | undefined;
    readonly event_created_at: bigint;
    readonly event_id: string;
    readonly raw_message_json: string;
  }

  export class ResultOfDisconnectSession {
    private constructor();
    free(): void;
    readonly message_id: string | undefined;
    readonly profile_address: string;
    readonly raw_message_json: string;
    readonly updated_session_state_json: string;
  }

  export class ResultOfRequestSetMiningKeys {
    private constructor();
    free(): void;
    readonly app_id: string;
    readonly message_id: string | undefined;
    readonly owner_public: string;
    readonly profile_address: string;
    readonly raw_message_json: string;
    readonly updated_session_state_json: string;
  }

  export class ResultOfRequestSignChallenge {
    private constructor();
    free(): void;
    readonly message_id: string | undefined;
    readonly nonce: string;
    readonly profile_address: string;
    readonly raw_message_json: string;
    readonly sent_at: bigint;
    readonly updated_session_state_json: string;
  }

  export class ResultOfWaitChallengeResponse {
    private constructor();
    free(): void;
    readonly nonce: string;
    readonly signature: string;
    readonly wallet_address: string;
    readonly updated_session_state_json: string | undefined;
    readonly epk_public: string | undefined;
    readonly event_created_at: bigint;
    readonly event_id: string;
    readonly profile_address: string;
    readonly raw_message_json: string;
  }

  export class ResultOfWaitSetMiningKeysRequest {
    private constructor();
    free(): void;
    readonly app_id: string;
    readonly event_created_at: bigint;
    readonly event_id: string;
    readonly owner_public: string;
    readonly profile_address: string;
    readonly raw_message_json: string;
    readonly updated_session_state_json: string | undefined;
  }

  export class Wallet {
    free(): void;
    constructor(
      endpoints: string[],
      archive_endpoints: string[] | null | undefined,
      api_url: string,
      app_id: string,
      api_token?: string | null,
      max_rps?: number | null,
    );

    // ── zkLogin methods ──
    prepare_zk_login_v1(): ZkLoginPrepareResult;
    complete_zk_login_with_prover_v1(params: TZkLoginCompleteWithProverParams): Promise<ZkLoginCompleteWithProverResult>;
    complete_zk_login_with_prover_v1_with_progress(
      params: TZkLoginCompleteWithProverParams,
      on_progress: Function,
    ): Promise<ZkLoginCompleteWithProverResult>;
    add_zkp_factor(params: TParamsOfAddZKPFactor): Promise<ResultOfAddZKPFactor>;
    add_zkp_factor_with_progress(
      params: TParamsOfAddZKPFactor,
      on_progress: Function,
    ): Promise<ResultOfAddZKPFactor>;
    get_epk_expire_at(params: TGetEPKExpireReq): Promise<ResultOfGetEPKExpireAt>;
    delete_zkp_factor_by_itself(params: TDeleteZkpFactorByItselfReq): Promise<ResultOfSendMessage>;
    update_zk_id(params: TUpdateMultifactorZkIdReq): Promise<ResultOfSendMessage>;

    // ── Token methods ──
    send_tokens_direct(params: TSendTokensDirectReq): Promise<ResultOfBlockchainWrite>;
    get_multifactor_balances(params: TParamsOfGetMultifactorBalances): Promise<ResultOfGetNativeBalances>;
    get_tokens_balances(params: TParamsOfGetTokensBalances): Promise<ResultOfGetTokensBalances>;
    buy_shells(params: TBuyShellsReq): Promise<ResultOfBlockchainWrite>;
    redeem_nackl(params: TRedeemNacklReq): Promise<ResultOfBlockchainWrite>;
    sell_shells(params: any): Promise<any>;
    get_nackl_redeem_rate(): Promise<any>;
    get_my_sell_orders(params: any): Promise<any>;
    claim_usdc(params: any): Promise<any>;
    migrate_tip3_usdc(params: any): Promise<ResultOfBlockchainWrite>;

    // ── Wallet methods ──
    deploy_wallet(params: TParamsOfDeployMultifactor): Promise<ResultOfDeployMultifactor>;
    deploy_wallet_with_progress(
      params: TParamsOfDeployMultifactor,
      on_progress: Function,
    ): Promise<ResultOfDeployMultifactor>;
    deploy_miner(params: TParamsOfDeployMiner): Promise<ResultOfBlockchainWrite>;
    deploy_miner_with_progress(
      params: TParamsOfDeployMiner,
      on_progress: Function,
    ): Promise<ResultOfBlockchainWrite>;
    set_mining_keys(params: TParamsOfSetMiningKeys): Promise<ResultOfBlockchainWrite>;
    del_mining_key(params: TParamsOfDelMiningKey): Promise<ResultOfBlockchainWrite>;
    change_seed_phrase(params: TParamsOfChangeSeedPhrase): Promise<ResultOfBlockchainWrite>;
    prepare_multifactor_deploy_params(params: TParamsOfPrepareDeploy): Promise<PreparedDeployParams>;
    prepare_zk_login_v1(): ZkLoginPrepareResult;

    // ── Info methods ──
    get_multifactor_info(params: TParamsOfGetMultifactorInfo): Promise<ResultOfGetMultifactorInfo>;
    get_multifactor_data_by_name(wallet_name: string): Promise<ResultOfGetMultifactorDetails | undefined>;
    get_multifactor_address(params: { pubkey: string }): Promise<ResultOfGetMvMultifactorAddress>;
    get_mirror_address(params: { pubkey: string }): ResultGetMirrorAddress;
    get_miner_address(params: TParamsOfGetMinerAddress): Promise<string>;
    get_miner_details_by_multifactor_address(multifactor_address: string): Promise<ResultOfGetMinerDetails>;
    get_history(params: TParamsOfGetHistory): Promise<ResultOfGetHistory>;
    check_name_availability(wallet_name: string): Promise<ResultOfCheckNameAvailability>;
    validate_name(wallet_name: string): ResultOfValidateWalletName;
    decode_connect_payload_b64url(payload_b64: string): any;
    query_connect_session_messages(params: TParamsOfQueryConnectSessionMessages): Promise<any>;
  }

  export class Miner {
    private constructor();
    free(): void;
    static new(
      endpoints: string[],
      app_id: string,
      address: string,
      public_key: string,
      secret_key: string,
    ): Promise<Miner>;
    can_start(): boolean;
    start(duration_ms: number, callback: Function): void;
    stop(): void;
    add_tap(x: number, y: number): void;
    get_reward(): Promise<void>;
    get_miner_data(): Promise<MinerAccountData>;
    get_current_block(): Promise<any>;
    remove_seed(seed: string): void;
  }

  export class MinerAccountData {
    private constructor();
    free(): void;
    tap_sum: bigint;
    tap_sum_5m: bigint;
    epoch_start: bigint;
    epoch_5m_start: bigint;
  }

  // ── Free functions ──

  export function gen_mining_keys(app_id: string): Promise<ResultOfGenMiningKeys>;
  export function ensure_mining_keys_propagated(params: TParamsOfEnsureMiningKeysPropagated): Promise<void>;
  export function get_miner_address_by_wallet_name(params: TParamsOfGetMinerAddressByWalletName): Promise<string>;
  export function deploy_multisig_via_giver(params: any): Promise<any>;
  export function multisig_balances(params: any): Promise<Record<number, string>>;
}