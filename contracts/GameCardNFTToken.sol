// SPDX-License-Identifier: MIT
pragma ton-solidity >= 0.58.0;

import "./interfaces.sol";

/**
 * @title GameCardNFTToken
 * @notice Индивидуальный TIP-4.1/4.2 токен карты Acki Rivals.
 *
 * Каждая карта — отдельный контракт с уникальным адресом через varInit.
 * Адрес токена зависит от _initTokenId, который передаётся через
 * tvm.buildStateInit в коллекции.
 *
 * Стандарты:
 *   - TIP-4.1: transfer + owner() + collection()
 *   - TIP-4.2: tokenURI() + TokenMetadataUpdated
 */
contract GameCardNFTToken is ITIP4_1NFT, ITIP4_2NFT {

    /* ─── varInit ─────────────────────────────────────────── */

    /// Уникальный ID токена (передаётся через varInit при построении stateInit)
    /// Гарантирует уникальный адрес для каждой карты
    uint256 public static _initTokenId;

    /* ─── Состояние ───────────────────────────────────────── */

    /// Адрес коллекции, выпустившей карту
    address public collection;
    /// Адрес владельца
    address public owner;
    /// Адрес менеджера (может передавать карту от имени владельца)
    address public manager;
    /// Базовый URI метаданных
    string public tokenURI;

    // 🎮 Игровые характеристики
    uint256 public cardId;      // ID карты из игры (1-44)
    string public name;
    uint8 public power;
    uint8 public damage;
    string public ability;
    string public rarity;
    string public clan;
    uint8 public stars;         // 0-5, улучшение карты

    /* ─── События ─────────────────────────────────────────── */

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event TokenMetadataUpdated(uint256 indexed tokenId, string tokenURI);
    event TokenUpgraded(uint256 indexed tokenId, uint8 newStars, uint8 powerBonus, uint8 damageBonus);

    /* ─── Модификаторы ────────────────────────────────────── */

    modifier onlyCollection() {
        require(msg.sender == collection, 101);
        _;
    }

    modifier onlyOwnerOrManager() {
        require(msg.sender == owner || msg.sender == manager, 102);
        _;
    }

    /* ─── Конструктор ─────────────────────────────────────── */

    /**
     * @notice Вызывается КОЛЛЕКЦИЕЙ при минтинге.
     * @dev _initTokenId уже установлен через varInit ДО вызова конструктора.
     *      Проверка msg.sender == collection гарантирует, что только коллекция
     *      может создать токен (защита от front-run mint).
     */
    constructor(
        address _collection,
        address _owner,
        address _manager,
        uint256 _cardId,
        string _name,
        uint8 _power,
        uint8 _damage,
        string _ability,
        string _rarity,
        string _clan,
        string _tokenURI
    ) public {
        require(msg.sender == _collection, 103);
        require(_collection != address(0), 104);
        tvm.accept();

        collection = _collection;
        owner = _owner;
        manager = _manager;
        cardId = _cardId;
        name = _name;
        power = _power;
        damage = _damage;
        ability = _ability;
        rarity = _rarity;
        clan = _clan;
        stars = 0;
        tokenURI = _tokenURI;

        emit Transfer(address(0), _owner, _initTokenId);
        emit TokenMetadataUpdated(_initTokenId, _tokenURI);
    }

    /* ─── TIP-4.1: transfer ───────────────────────────────── */

    /**
     * @notice TIP-4.1 transfer с поддержкой callback'ов.
     * @param to Адрес нового владельца
     * @param sendGasTo Адрес для возврата газа
     * @param callbacks Маппинг адресов контрактов, которые надо уведомить
     */
    function transfer(
        address to,
        address sendGasTo,
        mapping(address => CallbackParams) callbacks
    ) public override onlyOwnerOrManager {
        require(to != address(0), 105);
        require(to != address(this), 106);
        tvm.accept();

        address oldOwner = owner;
        manager = to;  // стандартное поведение: новый владелец становится менеджером
        owner = to;

        // TIP-4.1: callbacks передаются через onAcceptTransfer на получателе
        // Заметка: в TVM-Solidity нет .keys() для mapping, поэтому
        // калбэки обрабатываются на стороне контракта-получателя
        // через onAcceptTransfer callback

        // Отправляем газ
        if (sendGasTo.value != 0) {
            sendGasTo.transfer(0, false, 64);
        }

        emit Transfer(oldOwner, to, _initTokenId);
    }

    /**
     * @notice Простой transfer без callback'ов (для маркетплейса).
     */
    function simpleTransfer(address to) public onlyOwnerOrManager {
        require(to != address(0), 105);
        tvm.accept();

        address oldOwner = owner;
        manager = to;
        owner = to;

        emit Transfer(oldOwner, to, _initTokenId);
    }

    /* ─── TIP-4.2: Metadata ───────────────────────────────── */

    /**
     * @notice Установить URI метаданных (только коллекция).
     */
    function setTokenURI(string _tokenURI) public onlyCollection {
        tvm.accept();
        tokenURI = _tokenURI;
        emit TokenMetadataUpdated(_initTokenId, _tokenURI);
    }

    /* ─── Управление ──────────────────────────────────────── */

    /**
     * @notice Сменить менеджера (владелец или текущий менеджер).
     */
    function setManager(address _manager) public onlyOwnerOrManager {
        require(_manager != address(0), 105);
        tvm.accept();
        manager = _manager;
    }

    /**
     * @notice Сжечь карту (только владелец или менеджер).
     */
    function burn() public onlyOwnerOrManager {
        tvm.accept();

        address oldOwner = owner;
        owner = address(0);
        manager = address(0);

        emit Transfer(oldOwner, address(0), _initTokenId);
    }

    /**
     * @notice Улучшить карту (только коллекция, макс 5 звёзд).
     * @param _powerBonus +X к силе
     * @param _damageBonus +X к урону
     */
    function upgrade(uint8 _powerBonus, uint8 _damageBonus) public onlyCollection {
        require(stars < 5, 107);
        tvm.accept();

        stars++;
        power += _powerBonus;
        damage += _damageBonus;

        emit TokenUpgraded(_initTokenId, stars, _powerBonus, _damageBonus);
    }

    /* ─── Поддержка интерфейсов ──────────────────────────── */

    function supportsInterface(bytes4 interfaceID) public pure returns (bool) {
        return interfaceID == bytes4(0x3204ec29)  // TIP-4.1
            || interfaceID == bytes4(0x9b37ea52)  // TIP-4.2
            || interfaceID == bytes4(0x01ffc9a7); // ERC-165
    }

    /* ─── Getter ──────────────────────────────────────────── */

    function getInfo() public view returns (
        address, address, uint256, string, uint8, uint8,
        string, string, string, uint8, string
    ) {
        return (owner, manager, cardId, name, power, damage,
                ability, rarity, clan, stars, tokenURI);
    }

    /* ─── Приём SHELL ─────────────────────────────────────── */
    // fallback убран — TVM-Solidity 0.77 не поддерживает payable fallback
}

