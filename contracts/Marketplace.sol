// SPDX-License-Identifier: MIT
pragma ton-solidity >= 0.58.0;

import "./interfaces.sol";
import "./GameCardNFTToken.sol";

/**
 * @title Marketplace
 * @notice P2P маркетплейс NFT карт Acki Rivals за NACKL.
 *
 * Как это работает:
 *   1. Владелец карты вызывает list(tokenAddress, tokenRoot, price)
 *      → контракт забирает карту (transfer на себя, но оставляет менеджмент)
 *   2. Покупатель вызывает buy(tokenAddress), отправляя NACKL
 *      → NACKL идёт продавцу, карта — покупателю
 *   3. Владелец может отменить листинг через cancel(tokenAddress)
 *
 * Комиссия: feeBps (в базисных пунктах) идёт на адрес маркетплейса.
 *
 * Требования:
 *   - Продавец должен сначала approve карту на маркетплейс
 *     (через setManager на GameCardNFTToken)
 *   - Покупатель должен иметь NACKL в своём TIP-3 Wallet
 */
contract Marketplace is IMarketplace, IAcceptTokensTransferCallback {

    /* ─── Константы ──────────────────────────────────────── */

    uint16 constant BPS_DENOMINATOR = 10000;
    uint128 constant MIN_GAS = 0.1 ton;
    uint128 constant MIN_PRICE = 1_000_000_000;     // 1 NACKL (nano)

    /* ─── Состояние ───────────────────────────────────────── */

    /// Публичный ключ владельца
    uint256 public ownerPubkey;
    /// Администратор
    address public admin;
    /// Комиссия маркетплейса (250 = 2.5%)
    uint16 public feeBps;
    /// Адрес нашего TIP-3 Wallet для приёма NACKL
    address public tokenWallet;
    /// Адрес NACKL TokenRoot
    address public nacklTokenRoot;
    /// Пустая TvmCell для передачи в transfer
    TvmCell _empty;
    /// Счётчик листингов
    uint256 public listingCount;

    /// Маппинг: адрес токена → листинг
    mapping(address => Listing) public listings;
    /// Маппинг: продавец → количество листингов
    mapping(address => uint256) public sellerListingCount;

    /* ─── События ─────────────────────────────────────────── */

    // Listed, Bought, Cancelled — наследуются из IMarketplace
    // Bought с fee перегружен: отличается от IMarketplace.Bought наличием fee
    event Bought(address indexed buyer, address indexed tokenAddress, uint128 price, uint128 fee);
    event FeeUpdated(uint16 feeBps);
    event TokenWalletDeployed(address indexed tokenWallet);

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

    modifier listingExists(address tokenAddress) {
        require(listings[tokenAddress].active, 200);
        _;
    }

    /* ─── Конструктор ─────────────────────────────────────── */

    constructor(uint256 _ownerPubkey, address _admin, address _nacklTokenRoot) public {
        tvm.accept();
        ownerPubkey = _ownerPubkey;
        admin = _admin;
        nacklTokenRoot = _nacklTokenRoot;
        feeBps = 250;       // 2.5%
        listingCount = 0;
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
    }

    function setFee(uint16 _feeBps) public onlyOwnerOrAdmin {
        require(_feeBps <= 1000, 102);      // макс 10%
        tvm.accept();
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function setNacklTokenRoot(address _tokenRoot) public onlyOwnerOrAdmin {
        tvm.accept();
        nacklTokenRoot = _tokenRoot;
    }

    /* ─── TokenWallet ─────────────────────────────────────── */

    function deployTokenWallet() public onlyOwnerOrAdmin {
        require(nacklTokenRoot != address(0), 103);
        require(tokenWallet == address(0), 104);
        tvm.accept();

        ITokenRoot(nacklTokenRoot).deployWallet{
            value: MIN_GAS
        }(address(this), 0.5 ton);
    }

    function onTokenWalletDeployed(address _tokenWallet) public {
        require(msg.sender == nacklTokenRoot, 105);
        tvm.accept();
        tokenWallet = _tokenWallet;
        emit TokenWalletDeployed(_tokenWallet);
    }

    /* ─── List ────────────────────────────────────────────── */

    /**
     * @notice Выставить карту на продажу.
     *
     * @dev Продавец должен сначала вызвать setManager(tokenAddress, marketplaceAddress)
     *      на своей NFT карте. После этого маркетплейс может передать карту покупателю.
     *
     * @param tokenAddress Адрес контракта NFT карты
     * @param _tokenRoot Адрес NACKL TokenRoot
     * @param price Цена в NACKL (nano)
     */
    function list(address tokenAddress, address _tokenRoot, uint128 price)
        public
    {
        require(price >= MIN_PRICE, 201);
        require(_tokenRoot == nacklTokenRoot, 202);
        require(!listings[tokenAddress].active, 203);
        tvm.accept();

        // Проверяем, что маркетплейс — менеджер карты
        GameCardNFTToken token = GameCardNFTToken(tokenAddress);
        require(token.manager() == address(this), 204);
        require(token.owner() == msg.sender, 205);

        listings[tokenAddress] = Listing({
            seller: msg.sender,
            tokenAddress: tokenAddress,
            tokenRoot: _tokenRoot,
            price: price,
            active: true
        });
        listingCount++;
        sellerListingCount[msg.sender]++;

        emit Listed(msg.sender, tokenAddress, price);
    }

    /* ─── Buy ─────────────────────────────────────────────── */

    /**
     * @notice Купить выставленную карту.
     *
     * Основной путь: покупатель дёргает onAcceptTokensTransfer
     * через TIP-3 NACKL transfer с payload action="buy".
     *
     * Этот метод — для случаев, когда SDK уже перевёл NACKL
     * или для совместимости со старыми кошельками.
     */
    function buy(address tokenAddress) public listingExists(tokenAddress) {
        Listing listing = listings[tokenAddress];
        require(tokenWallet != address(0), 104);
        // ⚠️ NACKL должен быть уже на балансе контракта
        require(ITokenWallet(tokenWallet).balance() >= listing.price, 208);
        tvm.accept();

        uint128 fee = (listing.price * feeBps) / BPS_DENOMINATOR;
        uint128 sellerAmount = listing.price - fee;

        ITokenWallet(tokenWallet).transfer{ value: 0.2 ton }(
            listing.seller, sellerAmount, false, _empty
        );

        GameCardNFTToken token = GameCardNFTToken(tokenAddress);
        token.simpleTransfer{ value: 0.3 ton }(msg.sender);

        listing.active = false;
        listings[tokenAddress] = listing;
        listingCount--;
        sellerListingCount[listing.seller]--;

        emit Bought(msg.sender, tokenAddress, listing.price, fee);
    }

    /* ─── Buy with TIP-3 ─────────────────────────────────── */

    /**
     * @notice Обработка входящего перевода NACKL.
     * Покупатель отправляет NACKL с payload "buy + tokenAddress".
     */
    function onAcceptTokensTransfer(
        address /* tokenRoot */,
        uint128 amount,
        address sender,
        TvmCell payload
    ) public override {
        require(msg.sender == tokenWallet, 106);

        // Декодируем: action = "buy", tokenAddress
        (string action, address tokenAddress) = abi.decode(payload, (string, address));
        require(sha256(action) == sha256("buy"), 300);

        Listing listing = listings[tokenAddress];
        require(listing.active, 200);
        require(amount >= listing.price, 301);
        tvm.accept();

        // Расчёт комиссии
        uint128 fee = (listing.price * feeBps) / BPS_DENOMINATOR;
        uint128 sellerAmount = listing.price - fee;

        // Отправляем NACKL продавцу
        ITokenWallet(tokenWallet).transfer{
            value: 0.2 ton
        }(listing.seller, sellerAmount, false, _empty);

        // Излишек (если покупатель отправил больше) — возвращаем
        uint128 excess = amount - listing.price;
        if (excess > 0) {
            ITokenWallet(tokenWallet).transfer{
                value: 0.1 ton
            }(sender, excess, false, _empty);
        }

        // Передаём карту покупателю
        GameCardNFTToken token = GameCardNFTToken(tokenAddress);
        token.simpleTransfer{ value: 0.3 ton }(sender);

        // Снимаем листинг
        listing.active = false;
        listings[tokenAddress] = listing;
        listingCount--;
        sellerListingCount[listing.seller]--;

        emit Bought(sender, tokenAddress, listing.price, fee);
    }

    /* ─── Cancel ──────────────────────────────────────────── */

    /**
     * @notice Отменить листинг.
     */
    function cancel(address tokenAddress)
        public listingExists(tokenAddress)
    {
        Listing listing = listings[tokenAddress];
        require(msg.sender == listing.seller, 206);
        tvm.accept();

        listing.active = false;
        listings[tokenAddress] = listing;
        listingCount--;
        sellerListingCount[listing.seller]--;

        emit Cancelled(msg.sender, tokenAddress);
    }

    /* ─── Admin ───────────────────────────────────────────── */

    /**
     * @notice Принудительно снять листинг (админ).
     */
    function forceCancel(address tokenAddress) public onlyOwnerOrAdmin listingExists(tokenAddress) {
        Listing listing = listings[tokenAddress];
        tvm.accept();

        listing.active = false;
        listings[tokenAddress] = listing;
        listingCount--;
        sellerListingCount[listing.seller]--;

        emit Cancelled(listing.seller, tokenAddress);
    }

    /* ─── Withdraw ────────────────────────────────────────── */

    /**
     * @notice Вывести накопленные NACKL (комиссии маркетплейса).
     */
    function withdraw(address to, uint128 amount) public onlyOwnerOrAdmin {
        require(tokenWallet != address(0), 104);
        require(to != address(0), 207);
        tvm.accept();

        ITokenWallet(tokenWallet).transfer{
            value: 0.1 ton
        }(to, amount, false, _empty);
    }

    /* ─── Getter ──────────────────────────────────────────── */

    function getListing(address tokenAddress) public view returns (Listing) {
        return listings[tokenAddress];
    }

    function getSellerListings(address seller) public view returns (Listing[] activeListings) {
        uint256 count = sellerListingCount[seller];
        activeListings = new Listing[](count);
        uint256 idx;
        for (uint256 i = 0; i < listingCount; i++) {
            // Поскольку маппинг не итерируемый — возвращаем только в тестовых целях
            // На проде использовать off-chain индексер
        }
    }

    function getBalance() public view returns (uint128) {
        if (tokenWallet == address(0)) return 0;
        return ITokenWallet(tokenWallet).balance();
    }

    /* ─── Приём SHELL ─────────────────────────────────────── */

    fallback() external payable {}
}
