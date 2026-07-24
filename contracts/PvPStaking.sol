// SPDX-License-Identifier: MIT
pragma ton-solidity >= 0.58.0;

import "./interfaces.sol";
import "./GameMatch.sol";

/**
 * @title PvPStaking
 * @notice NACKL escrow + GameMatch интеграция для PvP баттлов Acki Rivals.
 *
 * Архитектура:
 *   - PvPStaking держит NACKL в своём TIP-3 TokenWallet
 *   - Игроки переводят NACKL на контракт через onAcceptTokensTransfer
 *   - GameMatch определяет победителя через commit-reveal
 *   - PvPStaking выплачивает победителю комиссию
 *
 * Поток ставки (NACKL):
 *   1. Игрок вызывает transfer() на своём NACKL Wallet,
 *      указывая в payload: { action: 0 (create), stakeAmount, roomId }
 *   2. PvPStaking получает onAcceptTokensTransfer, создаёт комнату
 *   3. Второй игрок делает transfer с payload: { action: 1 (join), roomId }
 *   4. PvPStaking принимает ставку, вызывает GameMatch.startMatch()
 *   5. После GameMatch.finalize → callback onGameMatchResult()
 *   6. PvPStaking отправляет NACKL победителю
 */
contract PvPStaking is IAcceptTokensTransferCallback, IPvPStaking {

    /* ─── Константы ──────────────────────────────────────── */

    uint256 constant ROOM_TIMEOUT = 86400;       // 24 часа
    uint16 constant BPS_DENOMINATOR = 10000;    // 100%
    uint256 constant MIN_STAKE = 1_000_000_000; // 1 NACKL (nano)
    uint128 constant MIN_GAS = 0.1 ton;

    /* ─── Структуры ───────────────────────────────────────── */

    struct Room {
        uint256 roomId;
        address creator;
        address opponent;
        address tokenRoot;
        uint128 stakeAmount;
        uint256 createdAt;
        uint8 status;       // 0 = waiting, 1 = staked, 2 = finished, 3 = cancelled
        address winner;
    }

    /* ─── Состояние ───────────────────────────────────────── */

    /// Публичный ключ владельца
    uint256 public ownerPubkey;
    /// Администратор
    address public admin;
    /// Адрес NACKL TokenRoot
    address public nacklTokenRoot;
    /// Адрес нашего TokenWallet для NACKL
    address public tokenWallet;
    /// Комиссия (200 = 2%)
    uint16 public feeBps;
    /// Счётчик комнат
    uint256 public roomCount;
    /// Комнаты
    mapping(uint256 => Room) public rooms;
    /// Активная комната игрока (creator или opponent)
    mapping(address => uint256) public activeRoomByPlayer;
    /// Адрес GameMatch контракта
    address public gameMatchAddress;

    /* ─── События ─────────────────────────────────────────── */

    event RoomCreated(uint256 indexed roomId, address indexed creator, uint128 stakeAmount);
    event PlayerJoined(uint256 indexed roomId, address indexed opponent);
    event BattleResult(uint256 indexed roomId, address indexed winner, uint128 prize, uint128 fee);
    event RoomCancelled(uint256 indexed roomId, address indexed creator);
    event TokenWalletDeployed(address indexed tokenWallet);
    event AdminUpdated(address indexed admin);

    /* ─── Модификаторы ────────────────────────────────────── */

    modifier onlyOwner() {
        require(msg.pubkey() != 0 && msg.pubkey() == ownerPubkey, 100);
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, 101);
        _;
    }

    modifier onlyOwnerOrAdmin() {
        require(
            (msg.pubkey() != 0 && msg.pubkey() == ownerPubkey) ||
            msg.sender == admin,
            100
        );
        _;
    }

    modifier roomExists(uint256 roomId) {
        require(rooms[roomId].roomId != 0, 300);
        _;
    }

    /* ─── Конструктор ─────────────────────────────────────── */

    constructor(uint256 _ownerPubkey, address _admin, address _nacklTokenRoot) public {
        tvm.accept();
        ownerPubkey = _ownerPubkey;
        admin = _admin;
        nacklTokenRoot = _nacklTokenRoot;
        feeBps = 200;       // 2% по умолчанию
        roomCount = 0;
        tokenWallet = address(0);
    }

    /* ─── Управление ──────────────────────────────────────── */

    function setOwnerPubkey(uint256 _newPubkey) public onlyOwner {
        tvm.accept();
        ownerPubkey = _newPubkey;
    }

    function setAdmin(address _admin) public onlyOwner {
        tvm.accept();
        admin = _admin;
        emit AdminUpdated(_admin);
    }

    function setFee(uint16 _feeBps) public onlyOwnerOrAdmin {
        require(_feeBps <= 1000, 102);      // макс 10%
        tvm.accept();
        feeBps = _feeBps;
    }

    function setNacklTokenRoot(address _tokenRoot) public onlyOwnerOrAdmin {
        tvm.accept();
        nacklTokenRoot = _tokenRoot;
    }

    function setGameMatch(address _gameMatch) public onlyOwnerOrAdmin {
        tvm.accept();
        gameMatchAddress = _gameMatch;
    }

    /* ─── TokenWallet ─────────────────────────────────────── */

    /**
     * @notice Развернуть TIP-3 TokenWallet для этого контракта.
     * @dev Вызывается после установки nacklTokenRoot.
     */
    function deployTokenWallet() public onlyOwnerOrAdmin {
        require(nacklTokenRoot != address(0), 103);
        require(tokenWallet == address(0), 104);
        tvm.accept();

        ITokenRoot(nacklTokenRoot).deployWallet{
            value: MIN_GAS
        }(address(this), 0.5 ton);
    }

    /**
     * @notice Callback после развёртывания TokenWallet.
     */
    function onTokenWalletDeployed(address _tokenWallet) public {
        require(msg.sender == nacklTokenRoot, 105);
        tvm.accept();
        tokenWallet = _tokenWallet;
        emit TokenWalletDeployed(_tokenWallet);
    }

    /* ─── TIP-3: onAcceptTokensTransfer ───────────────────── */

    /**
     * @notice TIP-3 callback для получения NACKL.
     *
     * Срабатывает, когда игрок отправляет NACKL через transfer() на наш TokenWallet.
     * В payload закодировано действие:
     *   - action = 0: создать комнату (stake)
     *   - action = 1: присоединиться к комнате (match stake)
     *   - roomId: ID комнаты (для join)
     */
    function onAcceptTokensTransfer(
        address /* tokenRoot */,
        uint128 amount,
        address sender,
        TvmCell payload
    ) public override {
        // Проверяем, что это наш TokenWallet
        require(msg.sender == tokenWallet, 106);

        // Декодируем payload
        (uint8 action, uint256 targetRoomId, uint128 stakeAmount) = abi.decode(
            payload, (uint8, uint256, uint128)
        );

        if (action == 0) {
            // Создать комнату
            require(amount >= MIN_STAKE, 200);
            require(activeRoomByPlayer[sender] == 0, 201);
            tvm.accept();

            roomCount++;
            rooms[roomCount] = Room({
                roomId: roomCount,
                creator: sender,
                opponent: address(0),
                tokenRoot: nacklTokenRoot,
                stakeAmount: stakeAmount > 0 ? stakeAmount : amount,
                createdAt: block.timestamp,
                status: 0,          // waiting
                winner: address(0)
            });
            activeRoomByPlayer[sender] = roomCount;

            emit RoomCreated(roomCount, sender, stakeAmount > 0 ? stakeAmount : amount);
        } else if (action == 1) {
            // Присоединиться к комнате
            Room room = rooms[targetRoomId];
            require(room.roomId != 0, 300);
            require(room.status == 0, 301);
            require(sender != room.creator, 302);
            require(activeRoomByPlayer[sender] == 0, 201);
            require(amount >= room.stakeAmount, 303);
            tvm.accept();

            room.opponent = sender;
            room.status = 1;        // staked
            rooms[targetRoomId] = room;
            activeRoomByPlayer[sender] = targetRoomId;

            emit PlayerJoined(targetRoomId, sender);

            // Если GameMatch настроен — запускаем commit-reveal
            if (gameMatchAddress != address(0)) {
                IGameMatch(gameMatchAddress).startMatch{ value: MIN_GAS }(
                    room.creator, room.opponent, 600  // 10 минут на бой
                );
            }
        } else {
            // Неизвестное действие — возвращаем токены
            tvm.accept();
            ITokenWallet(tokenWallet).transfer{
                value: 0.1 ton
            }(sender, amount, false, "");
        }
    }

    /* ─── GameMatch callback ──────────────────────────────── */

    /**
     * @note Вызывается GameMatch после определения победителя.
     */
    function onGameMatchResult(uint256 roomId, address winner) public {
        require(msg.sender == gameMatchAddress, 107);

        Room room = rooms[roomId];
        require(room.roomId != 0, 300);
        require(room.status == 1, 301);
        tvm.accept();

        // Обработка ничьей (winner = address(0))
        if (winner == address(0)) {
            // Ничья — возвращаем ставки обоим
            _refundBoth(room);
            return;
        }

        require(winner == room.creator || winner == room.opponent, 108);

        uint128 totalStake = room.stakeAmount * 2;
        uint128 fee = (totalStake * feeBps) / BPS_DENOMINATOR;
        uint128 prize = totalStake - fee;

        room.winner = winner;
        room.status = 2;    // finished
        rooms[roomId] = room;

        // Отправляем NACKL победителю
        if (tokenWallet != address(0)) {
            ITokenWallet(tokenWallet).transfer{
                value: 0.2 ton
            }(winner, prize, false, "");
        }

        activeRoomByPlayer[room.creator] = 0;
        activeRoomByPlayer[room.opponent] = 0;

        emit BattleResult(roomId, winner, prize, fee);
    }

    /* ─── Cancel ──────────────────────────────────────────── */

    /**
     * @note Отмена комнаты создателем (только в статусе waiting).
     */
    function cancelRoom(uint256 roomId) public roomExists(roomId) {
        Room room = rooms[roomId];
        require(msg.sender == room.creator, 109);
        require(room.status == 0, 301);
        tvm.accept();

        room.status = 3;    // cancelled
        rooms[roomId] = room;
        activeRoomByPlayer[room.creator] = 0;

        // Возвращаем NACKL создателю
        if (tokenWallet != address(0)) {
            ITokenWallet(tokenWallet).transfer{
                value: 0.2 ton
            }(room.creator, room.stakeAmount, false, "");
        }

        emit RoomCancelled(roomId, room.creator);
    }

    /* ─── Admin force ─────────────────────────────────────── */

    /**
     * @note Принудительное завершение (только admin, например при таймауте).
     */
    function forceFinish(uint256 roomId, address winner) public onlyOwnerOrAdmin roomExists(roomId) {
        Room room = rooms[roomId];
        require(room.status == 0 || room.status == 1, 301);
        require(winner == room.creator || winner == room.opponent, 108);
        tvm.accept();

        uint128 totalStake = room.stakeAmount * 2;
        uint128 fee = (totalStake * feeBps) / BPS_DENOMINATOR;
        uint128 prize = totalStake - fee;

        room.winner = winner;
        room.status = 2;
        rooms[roomId] = room;

        if (tokenWallet != address(0)) {
            ITokenWallet(tokenWallet).transfer{
                value: 0.2 ton
            }(winner, prize, false, "");
        }

        activeRoomByPlayer[room.creator] = 0;
        activeRoomByPlayer[room.opponent] = 0;

        emit BattleResult(roomId, winner, prize, fee);
    }

    /* ─── Internal ────────────────────────────────────────── */

    function _refundBoth(Room room) internal {
        if (tokenWallet != address(0)) {
            ITokenWallet(tokenWallet).transfer{
                value: 0.3 ton
            }(room.creator, room.stakeAmount, false, "");
            ITokenWallet(tokenWallet).transfer{
                value: 0.3 ton
            }(room.opponent, room.stakeAmount, false, "");
        }

        room.status = 3;
        rooms[room.roomId] = room;
        activeRoomByPlayer[room.creator] = 0;
        activeRoomByPlayer[room.opponent] = 0;
    }

    /* ─── Getter ──────────────────────────────────────────── */

    function getRoom(uint256 roomId) public view roomExists(roomId) returns (Room) {
        return rooms[roomId];
    }

    function getBalance() public view returns (uint128) {
        if (tokenWallet == address(0)) return 0;
        return ITokenWallet(tokenWallet).balance();
    }

    /* ─── Приём SHELL ─────────────────────────────────────── */

    fallback() external payable {}
}
