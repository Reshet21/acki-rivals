// SPDX-License-Identifier: MIT
pragma ton-solidity >= 0.58.0;

/* ========================================================================
 *   interfaces.sol — Acki Rivals
 *   TIP-3, TIP-4.1/4.2/4.3, IGameMatch, IPvPStaking, IMarketplace
 * ======================================================================== */

// ─── TIP-4.1: Base NFT ─────────────────────────────────────────────────

interface ITIP4_1Collection {
    function supportsInterface(bytes4 interfaceID) external view returns (bool);
}

interface ITIP4_1NFT {
    function transfer(
        address to,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    ) external;
    function owner() external view returns (address);
    function collection() external view returns (address);
}

struct CallbackParams {
    uint128 value;
    TvmCell payload;
}

// ─── TIP-4.2: Metadata ─────────────────────────────────────────────────

interface ITIP4_2JSON {
    function json(string key) external view returns (string);
    function setJSON(string key, string json) external;
}

interface ITIP4_2NFT {
    function tokenURI() external view returns (string);
    event TokenMetadataUpdated(uint256 indexed tokenId, string tokenURI);
}

// ─── TIP-4.3: Index / IndexBasis ──────────────────────────────────────

interface IIndex {
    function owner() external view returns (address);
    function collection() external view returns (address);
    function nft() external view returns (address);
}

interface IIndexBasis {
    function collection() external view returns (address);
    function owner() external view returns (address);
}

// ─── TIP-3: Fungible Tokens (NACKL) ───────────────────────────────────

interface ITokenRoot {
    function deployWallet(address answerAddress, uint128 deployWalletValue) external;
    function walletOf(address owner) external view returns (address);
    function totalSupply() external view returns (uint128);
    function mint(
        uint128 amount,
        address recipient,
        address deployWalletTo,
        uint128 deployWalletValue,
        address remainingGasTo,
        bool notify,
        TvmCell payload
    ) external;
}

interface ITokenWallet {
    function transfer(
        address to,
        uint128 amount,
        bool notify,
        TvmCell payload
    ) external;
    function balance() external view returns (uint128);
    function owner() external view returns (address);
    function root() external view returns (address);
    function burn(uint128 amount, address remainingGasTo) external;
}

interface IAcceptTokensTransferCallback {
    function onAcceptTokensTransfer(
        address tokenRoot,
        uint128 amount,
        address sender,
        TvmCell payload
    ) external;
}

interface IAcceptTokensMintCallback {
    function onAcceptTokensMint(
        address tokenRoot,
        uint128 amount,
        address remainingGasTo,
        TvmCell payload
    ) external;
}

// ─── GameMatch: Commit-Reveal RNG ──────────────────────────────────────

/**
 * @notice On-chain RNG через commit-reveal.
 *
 * Игроки коммитят хеш секрета, потом ревейлят секрет.
 * Победитель определяется как (hash(secretA + secretB + roomId) % 2).
 * Если игрок не ревейлит в течение TIMEOUT — второй выигрывает автоматом.
 */
interface IGameMatch {
    struct Room {
        uint256 roomId;
        address playerA;
        address playerB;
        uint256 commitDeadline;
        uint256 revealDeadline;
        uint8 status;          // 0 = created, 1 = committed, 2 = revealed, 3 = finished, 4 = timedout
        bool playerACommitted;
        bool playerBCommitted;
        bytes32 secretHashA;
        bytes32 secretHashB;
        bytes32 secretA;
        bytes32 secretB;
        address winner;
    }

    function startMatch(address playerA, address playerB, uint256 duration) external returns (uint256 roomId);
    function commit(uint256 roomId, bytes32 secretHash) external;
    function reveal(uint256 roomId, bytes32 secret) external;
    function triggerTimeout(uint256 roomId) external;
    function getRoom(uint256 roomId) external view returns (Room);
}

// ─── PvPStaking ────────────────────────────────────────────────────────

interface IPvPStaking {
    struct Room {
        uint256 roomId;
        address creator;
        address opponent;
        address tokenRoot;
        uint128 stakeAmount;
        uint256 createdAt;
        uint8 status;     // 0 = waiting, 1 = committed, 2 = finished, 3 = cancelled
        address winner;
    }

    function createRoom(uint128 stakeAmount, address tokenRoot) external;
    function joinRoom(uint256 roomId) external;
    function finalizeBattle(uint256 roomId, address gameMatch) external;
    function cancelRoom(uint256 roomId) external;
    function getRoom(uint256 roomId) external view returns (Room);
}

// ─── Marketplace ───────────────────────────────────────────────────────

interface IMarketplace {
    struct Listing {
        address seller;
        address tokenAddress;
        address tokenRoot;
        uint128 price;
        bool active;
    }

    function list(address tokenAddress, address tokenRoot, uint128 price) external;
    function buy(address tokenAddress) external;
    function cancel(address tokenAddress) external;
    function getListing(address tokenAddress) external view returns (Listing);
    event Listed(address indexed seller, address indexed tokenAddress, uint128 price);
    event Bought(address indexed buyer, address indexed tokenAddress, uint128 price);
    event Cancelled(address indexed seller, address indexed tokenAddress);
}
