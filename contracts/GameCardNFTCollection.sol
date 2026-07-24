// SPDX-License-Identifier: MIT
pragma ton-solidity >= 0.58.0;

import "./interfaces.sol";
import "./GameCardNFTToken.sol";

/**
 * @title GameCardNFTCollection
 * @notice TIP-4.1/4.2 коллекция NFT карт для игры Acki Rivals.
 *
 * Особенности:
 *   - Каждая карта — отдельный контракт GameCardNFTToken с уникальным адресом
 *   - Batch mint (до 8 карт — cap игрового деплоя)
 *   - Pausable (экстренная остановка минтинга)
 *   - SupportsInterface (TIP-4.1, TIP-4.2, ERC-165)
 *
 * TODO v2: TIP-4.3 Index/IndexBasis — отдельные контракты
 *
 * УНИКАЛЬНЫЙ АДРЕС ТОКЕНА:
 *   Каждый токен получает уникальный `_initTokenId`.
 *   Он передаётся через varInit в tvm.buildStateInit():
 *     stateInit = tvm.buildStateInit({
 *         code: tokenCode,
 *         varInit: { _initTokenId: tokenId }
 *     });
 *   → каждый токен = свой уникальный адрес (защита от front-run mint)
 */
contract GameCardNFTCollection is ITIP4_1Collection {

    /* ─── Структуры ───────────────────────────────────────── */

    /// Метаданные карты для минтинга
    struct CardData {
        uint256 cardId;     // ID из игры (1-44)
        string name;
        uint8 power;
        uint8 damage;
        string ability;
        string rarity;
        string clan;
        string uri;         // URI метаданных
    }

    /* ─── Состояние ───────────────────────────────────────── */

    /// Публичный ключ владельца
    uint256 public ownerPubkey;
    /// Администратор (может минтить)
    address public admin;

    /// Всего заминтино карт
    uint256 public totalSupply;
    /// Ограничение на общее количество карт (0 = без лимита)
    uint256 public maxSupply;

    /// Маппинг: ID токена → адрес контракта карты
    mapping(uint256 => address) public tokenAddresses;
    /// Маппинг: ID токена → CardId игры
    mapping(uint256 => uint256) public tokenCardIds;
    /// Маппинг: адрес контракта карты → ID токена
    mapping(address => uint256) public addressToTokenId;

    /// Код контракта GameCardNFTToken
    TvmCell public tokenCode;

    /// Роялти (в базисных пунктах, макс 1000 = 10%)
    uint16 public royaltyBps;
    /// Адрес получателя роялти
    address public royaltyAddress;

    /// Пауза (true = минтинг остановлен)
    bool public paused;

    // TIP-4.3 Index/IndexBasis — зарезервировано для v2
    // TvmCell public indexCode;
    // TvmCell public indexBasisCode;
    // address public indexBasisAddress;

    /// Пул актуальных шаблонов карт (cardId → CardData)
    mapping(uint256 => CardData) public cardTemplates;

    /* ─── События ─────────────────────────────────────────── */

    event TokenMinted(uint256 indexed tokenId, uint256 indexed cardId,
                      address indexed tokenAddress, address owner);
    event CollectionPaused(bool paused);
    event RoyaltyUpdated(uint16 royaltyBps, address royaltyAddress);
    event TemplateUpdated(uint256 indexed cardId);
    event TokenCodeUpdated(TvmCell newCode);

    /* ─── Модификаторы ────────────────────────────────────── */

    modifier onlyOwner() {
        require(msg.pubkey() != 0 && msg.pubkey() == ownerPubkey, 100);
        _;
    }

    modifier onlyAdminOrOwner() {
        require(
            (msg.pubkey() != 0 && msg.pubkey() == ownerPubkey) ||
            msg.sender == admin,
            100
        );
        _;
    }

    modifier whenNotPaused() {
        require(!paused, 200);
        _;
    }

    /* ─── Конструктор ─────────────────────────────────────── */

    constructor(uint256 _ownerPubkey, address _admin) public {
        tvm.accept();
        ownerPubkey = _ownerPubkey;
        admin = _admin;
        totalSupply = 0;
        maxSupply = 0;          // без лимита
        royaltyBps = 500;       // 5%
        royaltyAddress = _admin;
        paused = false;
    }

    /* ─── Управление ──────────────────────────────────────── */

    /// Установить код токена (обязательно перед mint!)
    function setTokenCode(TvmCell _tokenCode) public onlyOwner {
        tvm.accept();
        tokenCode = _tokenCode;
        emit TokenCodeUpdated(_tokenCode);
    }

    // TIP-4.3 Index/IndexBasis — зарезервировано для v2
    // function setIndexCode(TvmCell _indexCode) public onlyOwner { ... }
    // function setIndexBasisCode(TvmCell _indexBasisCode) public onlyOwner { ... }
    // function deployIndexBasis() public onlyOwner { ... }

    /// Сменить владельца
    function setOwnerPubkey(uint256 _newPubkey) public onlyOwner {
        tvm.accept();
        ownerPubkey = _newPubkey;
    }

    /// Сменить администратора
    function setAdmin(address _admin) public onlyOwner {
        tvm.accept();
        admin = _admin;
    }

    /// Установить лимит на общее количество карт
    function setMaxSupply(uint256 _maxSupply) public onlyOwner {
        tvm.accept();
        maxSupply = _maxSupply;
    }

    /// Установить роялти
    function setRoyalty(uint16 _royaltyBps, address _royaltyAddress) public onlyOwner {
        require(_royaltyBps <= 1000, 203);   // макс 10%
        tvm.accept();
        royaltyBps = _royaltyBps;
        royaltyAddress = _royaltyAddress;
        emit RoyaltyUpdated(_royaltyBps, _royaltyAddress);
    }

    /// Остановить / возобновить минтинг
    function setPaused(bool _paused) public onlyOwner {
        tvm.accept();
        paused = _paused;
        emit CollectionPaused(_paused);
    }

    /* ─── Управление шаблонами карт ───────────────────────── */

    /// Установить шаблон карты
    function setCardTemplate(uint256 _cardId, CardData _data) public onlyAdminOrOwner {
        tvm.accept();
        cardTemplates[_cardId] = _data;
        emit TemplateUpdated(_cardId);
    }

    /// Массовая установка шаблонов
    function setCardTemplates(CardData[] _templates) public onlyAdminOrOwner {
        tvm.accept();
        for (uint256 i = 0; i < _templates.length; i++) {
            CardData data = _templates[i];
            cardTemplates[data.cardId] = data;
            emit TemplateUpdated(data.cardId);
        }
    }

    /* ─── Mint ────────────────────────────────────────────── */

    /**
     * @notice Выпустить одну карту как NFT.
     */
    function mint(uint256 gameCardId, CardData data, address to)
        public onlyAdminOrOwner whenNotPaused
    {
        require(tokenCode.depth() > 0, 204);
        require(maxSupply == 0 || totalSupply < maxSupply, 205);
        tvm.accept();

        uint256 tokenId = ++totalSupply;
        _deployToken(tokenId, gameCardId, data, to);
    }

    /**
     * @notice Выпустить несколько карт за раз (макс 8).
     * @dev cap = 8 из-за gas limit на блок в Acki Nacki.
     */
    function mintBatch(
        uint256[] gameCardIds,
        CardData[] data,
        address to
    ) public onlyAdminOrOwner whenNotPaused
    {
        require(gameCardIds.length == data.length, 206);
        require(gameCardIds.length > 0, 207);
        require(gameCardIds.length <= 8, 208);     // gas cap
        require(maxSupply == 0 || totalSupply + gameCardIds.length <= maxSupply, 205);
        tvm.accept();

        for (uint256 i = 0; i < gameCardIds.length; i++) {
            uint256 tokenId = ++totalSupply;
            _deployToken(tokenId, gameCardIds[i], data[i], to);
        }
    }

    /**
     * @notice Внутренняя функция развёртывания токена.
     */
    function _deployToken(
        uint256 tokenId,
        uint256 gameCardId,
        CardData data,
        address to
    ) internal {
        // Уникальный stateInit через varInit { _initTokenId: tokenId }
        TvmCell stateInit = tvm.buildStateInit({
            code: tokenCode,
            data: tvm.buildDataInit({
                contr: GameCardNFTToken,
                varInit: { _initTokenId: tokenId }
            })
        });
        address tokenAddress = address.makeAddrStd(0, tvm.hash(stateInit));

        // Защита от коллизии адресов
        require(addressToTokenId[tokenAddress] == 0, 209);

        // Разворачиваем токен с 1.0 SHELL (mainnet storage)
        GameCardNFTToken token = new GameCardNFTToken{
            stateInit: stateInit,
            value: 1.0 ton,
            wid: 0
        }(
            address(this),      // _collection
            to,                 // _owner
            to,                 // _manager (изначально = владелец)
            gameCardId,         // _cardId
            data.name,
            data.power,
            data.damage,
            data.ability,
            data.rarity,
            data.clan,
            data.uri
        );

        // Регистрируем токен
        tokenAddresses[tokenId] = address(token);
        tokenCardIds[tokenId] = gameCardId;
        addressToTokenId[address(token)] = tokenId;

        // TODO v2: TIP-4.3 Index/IndexBasis deployment

        emit TokenMinted(tokenId, gameCardId, address(token), to);
    }

    /* ─── SupportsInterface (TIP-4.1) ─────────────────────── */

    function supportsInterface(bytes4 interfaceID) public pure returns (bool) {
        return interfaceID == bytes4(0x3204ec29)   // TIP-4.1 (collection)
            || interfaceID == bytes4(0x9b37ea52)   // TIP-4.2 (metadata)
            || interfaceID == bytes4(0x01ffc9a7);  // ERC-165
    }

    /* ─── Getter-функции ──────────────────────────────────── */

    function getTokenAddress(uint256 tokenId) public view returns (address) {
        return tokenAddresses[tokenId];
    }

    function getTotalSupply() public view returns (uint256) {
        return totalSupply;
    }

    function getMaxSupply() public view returns (uint256) {
        return maxSupply;
    }

    function getTokenIdByAddress(address tokenAddr) public view returns (uint256) {
        return addressToTokenId[tokenAddr];
    }

    function isPaused() public view returns (bool) {
        return paused;
    }

    /// Получить информацию для роялти (EIP-2981-like)
    function getRoyalty(address tokenAddress) public view returns (address, uint16) {
        require(addressToTokenId[tokenAddress] != 0, 210);
        return (royaltyAddress, royaltyBps);
    }

    /* ─── Приём SHELL ─────────────────────────────────────── */

    fallback() external payable {}
}
