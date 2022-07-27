//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import "./interfaces/IProductionEscrowV3.sol";
import "./interfaces/IProductionTokenV3.sol";
import "./interfaces/IProductionTokenTrackerV3.sol";
import "./interfaces/IProductionsV3.sol";
import "./interfaces/IMembersV3.sol";
import "./interfaces/IWETH.sol";

// import "hardhat/console.sol";

/// @custom:security-contact info@staxe.io
contract StaxeProductionsV3 is
  ERC2771ContextUpgradeable,
  OwnableUpgradeable,
  ReentrancyGuardUpgradeable,
  IProductionsV3
{
  using CountersUpgradeable for CountersUpgradeable.Counter;
  using AddressUpgradeable for address payable;
  using SafeERC20Upgradeable for IERC20Upgradeable;

  // ---------- State ----------

  CountersUpgradeable.Counter private tokenIds;
  mapping(address => bool) public trustedEscrowFactories;
  mapping(address => bool) public trustedErc20Coins;

  ISwapRouter public constant router = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);

  mapping(uint256 => Escrow) public productionEscrows;
  IProductionTokenV3 public productionToken;
  IMembersV3 public members;
  address public treasury;
  IWETH public nativeWrapper;

  // ---------- Functions ----------

  constructor(address trustedForwarder) ERC2771ContextUpgradeable(trustedForwarder) {}

  // ---- Modifiers ----

  modifier validProduction(uint256 id) {
    require(productionEscrows[id].id != 0, "Production does not exist");
    _;
  }

  modifier validBuyer(address buyer) {
    require(buyer != address(0), "Buyer must be valid address");
    require(
      buyer == _msgSender() || isTrustedForwarder(_msgSender()) || members.isInvestor(_msgSender()),
      "Invalid token buyer"
    );
    _;
  }

  modifier trustedOnly() {
    require(isTrustedForwarder(_msgSender()), "Can only be called from trusted forwarder");
    _;
  }

  // ---- Proxy ----

  function initialize(
    IProductionTokenV3 _productionToken,
    IMembersV3 _members,
    IWETH _nativeWrapper,
    address _treasury
  ) public initializer {
    require(_treasury != address(0), "Treasury must be valid address");
    productionToken = _productionToken;
    members = _members;
    nativeWrapper = _nativeWrapper;
    treasury = _treasury;
    tokenIds.increment();
    __Ownable_init();
    __ReentrancyGuard_init();
  }

  // ---- Data Access ----

  function getProduction(uint256 id) external view validProduction(id) returns (Production memory) {
    (
      IProductionEscrowV3.ProductionData memory data,
      IProductionEscrowV3.Perk[] memory perks,
      uint256 fundsRaised
    ) = productionEscrows[id].escrow.getProductionDataWithPerks();
    uint256 balance = IERC20Upgradeable(data.currency).balanceOf(address(productionEscrows[id].escrow));
    bool paused = productionEscrows[id].escrow.paused();
    return
      Production({
        id: id,
        data: data,
        perks: perks,
        escrow: productionEscrows[id].escrow,
        fundsRaised: fundsRaised,
        escrowBalance: balance,
        paused: paused
      });
  }

  function getTokenPrice(uint256 id, uint256 amount)
    external
    view
    override
    validProduction(id)
    returns (IERC20Upgradeable, uint256)
  {
    return productionEscrows[id].escrow.getTokenPrice(amount, _msgSender());
  }

  function getTokenPriceFor(
    uint256 id,
    uint256 amount,
    address buyer
  ) external view override validProduction(id) validBuyer(buyer) returns (IERC20Upgradeable, uint256) {
    return productionEscrows[id].escrow.getTokenPrice(amount, buyer);
  }

  function getTokenOwnerData(uint256 id, address tokenOwner)
    external
    view
    validProduction(id)
    validBuyer(tokenOwner)
    returns (
      uint256 balance,
      IProductionEscrowV3.Perk[] memory perksOwned,
      uint256 proceedsClaimed,
      uint256 proceedsAvailable
    )
  {
    return productionEscrows[id].escrow.getTokenOwnerData(tokenOwner);
  }

  // ---- Lifecycle ----

  function mintProduction(
    IProductionEscrowV3 escrow,
    address creator,
    uint256 totalAmount
  ) external override nonReentrant returns (uint256 id) {
    require(trustedEscrowFactories[_msgSender()], "Untrusted Escrow Factory");
    require(trustedErc20Coins[address(escrow.getProductionData().currency)], "Unknown ERC20 token");
    id = tokenIds.current();
    emit ProductionMinted(id, creator, totalAmount, address(escrow));
    productionEscrows[id] = Escrow({id: id, escrow: escrow});
    tokenIds.increment();
    productionToken.mintToken(IProductionTokenTrackerV3(escrow), id, totalAmount);
  }

  function approve(uint256 id) external override nonReentrant validProduction(id) {
    productionEscrows[id].escrow.approve(_msgSender());
  }

  function decline(uint256 id) external override nonReentrant validProduction(id) {
    productionEscrows[id].escrow.decline(_msgSender());
  }

  function finishCrowdsale(uint256 id) external override nonReentrant validProduction(id) {
    productionEscrows[id].escrow.finish(_msgSender(), treasury);
  }

  function close(uint256 id) external override nonReentrant validProduction(id) {
    productionEscrows[id].escrow.close(_msgSender(), treasury);
  }

  function pause(uint256 id) external override nonReentrant validProduction(id) {
    productionEscrows[id].escrow.pause(_msgSender());
  }

  function unpause(uint256 id) external override nonReentrant validProduction(id) {
    productionEscrows[id].escrow.unpause(_msgSender());
  }

  function cancel(uint256 id, uint256 newCloseDate) external override nonReentrant validProduction(id) {
    productionEscrows[id].escrow.cancel(_msgSender(), newCloseDate);
  }

  // ---- Buy Tokens ----

  function buyTokensWithCurrency(
    uint256 id,
    address buyer,
    uint256 amount,
    uint16 perk
  ) external payable override nonReentrant validProduction(id) validBuyer(buyer) {
    require(amount > 0, "Must pass amount > 0");
    require(msg.value > 0, "Must pass msg.value > 0");
    IProductionEscrowV3 escrow = productionEscrows[id].escrow;
    require(amount <= escrow.getTokensAvailable(), "Cannot buy more than available");
    (IERC20Upgradeable token, uint256 price) = escrow.getTokenPrice(amount, buyer);
    swapToTargetTokenAmountOut(token, price, address(escrow));
    emit TokenBought(id, buyer, amount, price, perk);
    escrow.buyTokens(buyer, amount, price, perk);
  }

  function buyTokensWithTokens(
    uint256 id,
    address buyer,
    uint256 amount,
    uint16 perk
  ) external override nonReentrant validProduction(id) validBuyer(buyer) {
    buyWithTransfer(id, amount, buyer, buyer, perk);
  }

  function buyTokensWithFiat(
    uint256 id,
    address buyer,
    uint256 amount,
    uint16 perk
  ) external override nonReentrant validProduction(id) validBuyer(buyer) trustedOnly {
    buyWithTransfer(id, amount, _msgSender(), buyer, perk);
  }

  function depositProceedsInTokens(uint256 id, uint256 amount) external override nonReentrant validProduction(id) {
    IProductionEscrowV3.ProductionData memory productionData = productionEscrows[id].escrow.getProductionData();
    IERC20Upgradeable token = IERC20Upgradeable(productionData.currency);
    require(token.allowance(productionData.creator, address(this)) >= amount, "Insufficient allowance");
    token.safeTransferFrom(productionData.creator, address(this), amount);
    token.safeTransfer(address(productionEscrows[id].escrow), amount);
    productionEscrows[id].escrow.depositProceeds(_msgSender(), amount);
    emit ProceedsDeposited(id, _msgSender(), amount);
  }

  function depositProceedsInCurrency(uint256 id) external payable override nonReentrant validProduction(id) {
    IProductionEscrowV3.ProductionData memory productionData = productionEscrows[id].escrow.getProductionData();
    IERC20Upgradeable token = IERC20Upgradeable(productionData.currency);
    uint256 amount = swapToTargetTokenAmountIn(token, address(productionEscrows[id].escrow));
    emit ProceedsDeposited(id, _msgSender(), amount);
    productionEscrows[id].escrow.depositProceeds(_msgSender(), amount);
  }

  function transferProceeds(uint256 id) external override nonReentrant validProduction(id) {
    uint256 amount = productionEscrows[id].escrow.transferProceeds(_msgSender());
    emit ProceedsClaimed(id, _msgSender(), amount);
  }

  function transferFunding(uint256 id) external override nonReentrant validProduction(id) {
    (uint256 amount, uint256 platformShare) = productionEscrows[id].escrow.transferFunding(_msgSender(), treasury);
    emit FundingClaimed(id, _msgSender(), amount, platformShare);
  }

  function finishProduction(uint256 id) external override nonReentrant validProduction(id) {
    productionEscrows[id].escrow.finish(_msgSender(), treasury);
  }

  // ---- Utilities ----

  receive() external payable {}

  function addTrustedEscrowFactory(address trustedEscrowFactory) external onlyOwner {
    trustedEscrowFactories[trustedEscrowFactory] = true;
  }

  function removeTrustedEscrowFactory(address invalidAddress) external onlyOwner {
    trustedEscrowFactories[invalidAddress] = false;
  }

  function addTrustedErc20Coin(address trustedErc20Coin) external onlyOwner {
    trustedErc20Coins[trustedErc20Coin] = true;
  }

  function removeTrustedErc20Coin(address invalidAddress) external onlyOwner {
    trustedErc20Coins[invalidAddress] = false;
  }

  // ---- Internal ----

  function _msgSender() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (address sender) {
    return ContextUpgradeable._msgSender();
  }

  function _msgData() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (bytes calldata) {
    return ContextUpgradeable._msgData();
  }

  // ---- Private ----

  function swapToTargetTokenAmountOut(
    IERC20Upgradeable targetToken,
    uint256 targetAmount,
    address targetAddress
  ) private returns (uint256 amountIn) {
    ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams({
      tokenIn: address(nativeWrapper),
      tokenOut: address(targetToken),
      fee: 3000,
      recipient: targetAddress,
      deadline: block.timestamp,
      amountOut: targetAmount,
      amountInMaximum: msg.value,
      sqrtPriceLimitX96: 0
    });
    nativeWrapper.deposit{value: msg.value}();
    TransferHelper.safeApprove(address(nativeWrapper), address(router), msg.value);
    amountIn = router.exactOutputSingle(params);
    if (amountIn < msg.value) {
      // Refund ETH to user
      uint256 refundAmount = msg.value - amountIn;
      TransferHelper.safeApprove(address(nativeWrapper), address(router), 0);
      nativeWrapper.withdraw(refundAmount);
      TransferHelper.safeTransferETH(_msgSender(), refundAmount);
    }
  }

  function swapToTargetTokenAmountIn(IERC20Upgradeable targetToken, address targetAddress)
    private
    returns (uint256 amountIn)
  {
    ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
      tokenIn: address(nativeWrapper),
      tokenOut: address(targetToken),
      fee: 3000,
      recipient: targetAddress,
      deadline: block.timestamp,
      amountIn: msg.value,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0
    });
    nativeWrapper.deposit{value: msg.value}();
    TransferHelper.safeApprove(address(nativeWrapper), address(router), msg.value);
    amountIn = router.exactInputSingle(params);
  }

  function buyWithTransfer(
    uint256 id,
    uint256 amount,
    address tokenHolder,
    address buyer,
    uint16 perk
  ) private {
    require(amount > 0, "Must pass amount > 0");
    IProductionEscrowV3 escrow = productionEscrows[id].escrow;
    require(amount <= escrow.getTokensAvailable(), "Cannot buy more than available");
    (IERC20Upgradeable token, uint256 price) = escrow.getTokenPrice(amount, buyer);
    require(token.allowance(tokenHolder, address(this)) >= price, "Insufficient allowance");
    emit TokenBought(id, buyer, amount, price, perk);
    token.safeTransferFrom(tokenHolder, address(this), price);
    token.safeTransfer(address(escrow), price);
    escrow.buyTokens(buyer, amount, price, perk);
  }
}
