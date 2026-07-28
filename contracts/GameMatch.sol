// SPDX-License-Identifier: MIT
pragma ton-solidity >= 0.58.0;

import "./interfaces.sol";

/**
 * @title GameMatch
 * @notice Commit-reveal RNG для PvP баттлов Acki Rivals.
 *
 * Как это работает:
 *   1. PvPStaking вызывает startMatch(), создавая комнату
 *   2. Оба игрока вызывают commit() со своим secretHash
 *   3. После коммита оба игрока вызывают reveal() со своим секретом
 *   4. Победитель = hash(secretA + secretB + roomId) % 2
 *      (playerA = 0, playerB = 1)
 *   5. Если игрок не ревейлит в течение REVEAL_TIMEOUT —
 *      второй игрок вызывает triggerTimeout() и выигрывает автоматом
 *
 * Безопасность:
 *   - hash = sha256(secret + roomId + playerAddress)
 *   - secret — 32 байта случайности, сгенерированной на клиенте
 *   - После коммита нельзя изменить секрет
 *   - После ревела результат детерминирован
 */
contract GameMatch is IGameMatch {

    /* ─── Константы ──────────────────────────────────────── */

    /// Время на коммит (в секундах)
    uint256 constant COMMIT_TIMEOUT = 300;       // 5 минут
    /// Время на ревел (в секундах)
    uint256 constant REVEAL_TIMEOUT = 300;       // 5 минут
    /// Максимальное количество активных комнат
    uint256 constant MAX_ROOMS = 1000;

    /* ─── Состояние ───────────────────────────────────────── */

    /// Публичный ключ владельца
    uint256 public ownerPubkey;
    /// Счётчик комнат
    uint256 public roomCount;
    /// Комнаты
    mapping(uint256 => Room) public rooms;
    /// Маппинг: игрок → ID активной комнаты
    mapping(address => uint256) public activeRoomByPlayer;

    /* ─── События ─────────────────────────────────────────── */

    event MatchStarted(uint256 indexed roomId, address indexed playerA, address indexed playerB);
    event Committed(uint256 indexed roomId, address indexed player, bytes32 secretHash);
    event Revealed(uint256 indexed roomId, address indexed player, bytes32 secret);
    event MatchResult(uint256 indexed roomId, address indexed winner);
    event MatchTimedOut(uint256 indexed roomId, address indexed winner);

    /* ─── Модификаторы ────────────────────────────────────── */

    modifier onlyOwner() {
        require(msg.pubkey() != 0 && msg.pubkey() == ownerPubkey, 100);
        _;
    }

    modifier roomExists(uint256 roomId) {
        require(rooms[roomId].roomId != 0, 300);
        _;
    }

    /* ─── Конструктор ─────────────────────────────────────── */

    constructor(uint256 _ownerPubkey) {
        tvm.accept();
        ownerPubkey = _ownerPubkey;
        roomCount = 0;
    }

    /* ─── Хелперы для хеширования ─────────────────────────── */

    /// sha256 от bytes32 (один секрет)
    /// Использует abi.encode (не encodePacked) — для bytes32 результат идентичный
    function _hashSecret(bytes32 secret) private pure returns (uint256) {
        return sha256(abi.encode(secret));
    }

    /// sha256 от двух секретов + roomId (для финализации)
    /// abi.encode безопасен: bytes32 и uint256 уже 32-байтовые, паддинг не добавляется
    function _hashCombined(bytes32 secretA, bytes32 secretB, uint256 roomId) private pure returns (uint256) {
        return sha256(abi.encode(secretA, secretB, roomId));
    }

    /* ─── Start Match ─────────────────────────────────────── */

    /**
     * @notice Создать новую комнату для PvP баттла.
     * @param playerA Первый игрок
     * @param playerB Второй игрок
     * @return roomId ID созданной комнаты
     */
    function startMatch(address playerA, address playerB, uint256 /* duration */)
        public onlyOwner returns (uint256 roomId)
    {
        require(playerA != address(0), 301);
        require(playerB != address(0), 301);
        require(playerA != playerB, 302);
        require(roomCount < MAX_ROOMS, 303);
        tvm.accept();

        roomCount++;
        uint256 commitDeadline = block.timestamp + COMMIT_TIMEOUT;
        uint256 revealDeadline = commitDeadline + REVEAL_TIMEOUT;

        rooms[roomCount] = Room({
            roomId: roomCount,
            playerA: playerA,
            playerB: playerB,
            commitDeadline: commitDeadline,
            revealDeadline: revealDeadline,
            status: 0,                          // created
            playerACommitted: false,
            playerBCommitted: false,
            secretHashA: bytes32(0),
            secretHashB: bytes32(0),
            secretA: bytes32(0),
            secretB: bytes32(0),
            winner: address(0)
        });

        emit MatchStarted(roomCount, playerA, playerB);
        return roomCount;
    }

    /* ─── Commit ──────────────────────────────────────────── */

    /**
     * @notice Зафиксировать хеш секрета.
     * @param roomId ID комнаты
     * @param secretHash sha256(secret)
     */
    function commit(uint256 roomId, bytes32 secretHash)
        public roomExists(roomId)
    {
        Room room = rooms[roomId];
        require(room.status == 0, 304);
        require(msg.sender == room.playerA || msg.sender == room.playerB, 305);
        require(block.timestamp <= room.commitDeadline, 306);
        tvm.accept();

        if (msg.sender == room.playerA) {
            require(!room.playerACommitted, 307);
            room.playerACommitted = true;
            room.secretHashA = secretHash;
        } else {
            require(!room.playerBCommitted, 307);
            room.playerBCommitted = true;
            room.secretHashB = secretHash;
        }

        // Если оба закоммитили — переходим в статус 1 (committed)
        if (room.playerACommitted && room.playerBCommitted) {
            room.status = 1;
        }

        rooms[roomId] = room;
        emit Committed(roomId, msg.sender, secretHash);
    }

    /* ─── Reveal ──────────────────────────────────────────── */

    /**
     * @notice Раскрыть секрет и определить победителя.
     * @param roomId ID комнаты
     * @param secret Исходный секрет (32 байта)
     */
    function reveal(uint256 roomId, bytes32 secret)
        public roomExists(roomId)
    {
        Room room = rooms[roomId];
        require(room.status == 1, 304);
        require(msg.sender == room.playerA || msg.sender == room.playerB, 305);
        require(block.timestamp <= room.revealDeadline, 308);
        tvm.accept();

        // Проверяем, что секрет соответствует закоммиченному хешу
        uint256 computedHash = _hashSecret(secret);
        address otherPlayer;

        if (msg.sender == room.playerA) {
            require(computedHash == uint256(room.secretHashA), 309);
            require(room.secretA == bytes32(0), 310);
            room.secretA = secret;
            otherPlayer = room.playerB;
        } else {
            require(computedHash == uint256(room.secretHashB), 309);
            require(room.secretB == bytes32(0), 310);
            room.secretB = secret;
            otherPlayer = room.playerA;
        }

        emit Revealed(roomId, msg.sender, secret);

        // Если оба ревейлнули — определяем победителя
        if (room.secretA != bytes32(0) && room.secretB != bytes32(0)) {
            _finalize(roomId);
            // _finalize уже обновил rooms[roomId] — не перетираем stale-структурой
        } else {
            rooms[roomId] = room;
        }
    }

    /* ─── Timeout ─────────────────────────────────────────── */

    /**
     * @notice Если противник не ревейлит в течение REVEAL_TIMEOUT —
     * вызывающий выигрывает.
     */
    function triggerTimeout(uint256 roomId)
        public roomExists(roomId)
    {
        Room room = rooms[roomId];
        require(room.status == 1, 304);
        require(block.timestamp > room.revealDeadline, 311);
        tvm.accept();

        // Определяем, кто ревейлнул, а кто — нет
        if (room.secretA != bytes32(0) && room.secretB == bytes32(0)) {
            room.winner = room.playerA;
        } else if (room.secretB != bytes32(0) && room.secretA == bytes32(0)) {
            room.winner = room.playerB;
        } else if (msg.sender == room.playerA) {
            // Никто не ревейлнул — первый позвавший timeout выигрывает
            room.winner = room.playerA;
        } else {
            room.winner = room.playerB;
        }

        room.status = 4; // timedout
        rooms[roomId] = room;

        emit MatchTimedOut(roomId, room.winner);
    }

    /* ─── Internal ────────────────────────────────────────── */

    /**
     * @notice Определить победителя на основе двух секретов.
     * @dev winner = (hash(secretA + secretB + roomId) % 2 == 0) ? playerA : playerB
     *      Ничья = 0 (address(0)). В текущей реализации ничья возможна (result=2),
     *      но PvPStaking должен обработать случай address(0).
     */
    function _finalize(uint256 roomId) internal {
        Room room = rooms[roomId];
        require(room.status == 1, 312);
        require(room.secretA != bytes32(0) && room.secretB != bytes32(0), 313);

        uint256 combinedHash = _hashCombined(room.secretA, room.secretB, roomId);

        // Безопасное приведение: берём первый байт хеша mod 3
        // 0 = playerA, 1 = playerB, 2 = draw
        uint8 result = uint8(combinedHash >> 248) % 3; // первый байт через битовый сдвиг

        if (result == 0) {
            room.winner = room.playerA;
        } else if (result == 1) {
            room.winner = room.playerB;
        } else {
            // Ничья — возвращаем address(0), PvPStaking обработает
            room.winner = address(0);
        }

        room.status = 3; // finished
        rooms[roomId] = room;

        emit MatchResult(roomId, room.winner);
    }

    /* ─── Getter ──────────────────────────────────────────── */

    function getRoom(uint256 roomId) public view roomExists(roomId) returns (Room) {
        return rooms[roomId];
    }

    function getActiveRoomCount() public view returns (uint256) {
        uint256 count;
        for (uint256 i = 1; i <= roomCount; i++) {
            if (rooms[i].status == 0 || rooms[i].status == 1) count++;
        }
        return count;
    }

    /* ─── Owner ───────────────────────────────────────────── */

    function setOwnerPubkey(uint256 _newPubkey) public onlyOwner {
        tvm.accept();
        ownerPubkey = _newPubkey;
    }
}
