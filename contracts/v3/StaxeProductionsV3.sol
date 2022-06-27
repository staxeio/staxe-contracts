//SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import "./interfaces/IProductionEscrowV3.sol";
import "./interfaces/IProductionTokenV3.sol";
import "./interfaces/IProductionsV3.sol";
import "./interfaces/IMembersV3.sol";
import "./interfaces/IWETH.sol";

// import "hardhat/console.sol";

contract StaxeProductionsV3 is ERC2771ContextUpgradeable, OwnableUpgradeable, IProductionsV3 {
  using CountersUpgradeable for CountersUpgradeable.Counter;
  using AddressUpgradeable for address payable;

  // ---------- State ----------

  CountersUpgradeable.Counter private tokenIds;
  mapping(address => bool) private trustedEscrowFactories;
  mapping(address => bool) private trustedErc20Coins;

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
    productionToken = _productionToken;
    members = _members;
    nativeWrapper = _nativeWrapper;
    treasury = _treasury;
    __Ownable_init();
  }

  // ---- Data Access ----

  function getProduction(uint256 id) external view returns (Production memory) {
    require(productionEscrows[id].id != 0, "Unknown production");
    (IProductionEscrowV3.ProductionData memory data, IProductionEscrowV3.Perk[] memory perks) = productionEscrows[id]
      .escrow
      .getProductionDataWithPerks();
    return Production(id, data, perks, productionEscrows[id].escrow);
  }

  function getTokenPrice(uint256 id, uint256 amount) external view override returns (IERC20, uint256) {
    require(productionEscrows[id].id != 0, "Unknown production");
    return productionEscrows[id].escrow.getTokenPrice(amount, _msgSender());
  }

  function getTokenPriceFor(
    uint256 id,
    uint256 amount,
    address buyer
  ) external view override validProduction(id) validBuyer(buyer) returns (IERC20, uint256) {
    return productionEscrows[id].escrow.getTokenPrice(amount, buyer);
  }

  // ---- Lifecycle ----

  function mintProduction(
    IProductionEscrowV3 escrow,
    address creator,
    uint256 totalAmount
  ) external override returns (uint256 id) {
    require(trustedEscrowFactories[_msgSender()], "Untrusted Escrow Factory");
    require(trustedErc20Coins[address(escrow.getProductionData().currency)], "Unknown ERC20 token");
    tokenIds.increment();
    id = tokenIds.current();
    emit ProductionCreated(id, creator, totalAmount, address(escrow));
    productionToken.mintToken(address(escrow), id, totalAmount);
    productionEscrows[id] = Escrow({id: id, escrow: escrow});
  }

  function approve(uint256 id) external validProduction(id) {
    require(members.isApprover(_msgSender()));
    productionEscrows[id].escrow.approve();
  }

  function decline(uint256 id) external validProduction(id) {
    require(members.isApprover(_msgSender()));
    productionEscrows[id].escrow.decline();
  }

  function finishCrowdsale(uint256 id) external validProduction(id) {
    require(members.isOrganizer(_msgSender()));
    productionEscrows[id].escrow.finish();
  }

  function close(uint256 id) external validProduction(id) {
    require(members.isOrganizer(_msgSender()));
    productionEscrows[id].escrow.close();
  }

  // ---- Buy Tokens ----

  function buyTokensWithCurrency(
    uint256 id,
    address buyer,
    uint256 amount
  ) external payable validProduction(id) validBuyer(buyer) {
    require(amount > 0, "Must pass amount > 0");
    require(msg.value > 0, "Must pass msg.value > 0");
    IProductionEscrowV3 escrow = productionEscrows[id].escrow;
    require(amount <= escrow.getTokensAvailable(), "Cannot buy more than available");
    (IERC20 token, uint256 price) = escrow.getTokenPrice(amount, buyer);
    _swapToTargetToken(token, price, address(escrow));
    escrow.buyTokens(buyer, amount, price);
  }

  function buyTokensWithTokens(
    uint256 id,
    address buyer,
    uint256 amount
  ) external validProduction(id) validBuyer(buyer) {
    _buyWithTransfer(id, amount, buyer, buyer);
  }

  function buyTokensWithFiat(
    uint256 id,
    address buyer,
    uint256 amount
  ) external validProduction(id) validBuyer(buyer) trustedOnly {
    _buyWithTransfer(id, amount, _msgSender(), buyer);
  }

  function proceedsToTreasury(uint256 id, address owner) external {}

  function finishProduction(uint256 id) external {}

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

  function _swapToTargetToken(
    IERC20 targetToken,
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

  function _buyWithTransfer(
    uint256 id,
    uint256 amount,
    address tokenHolder,
    address buyer
  ) private {
    require(amount > 0, "Must pass amount > 0");
    IProductionEscrowV3 escrow = productionEscrows[id].escrow;
    require(amount <= escrow.getTokensAvailable(), "Cannot buy more than available");
    (IERC20 token, uint256 price) = escrow.getTokenPrice(amount, buyer);
    require(token.allowance(tokenHolder, address(this)) >= price, "Insufficient allowance");
    token.transferFrom(tokenHolder, address(this), price);
    token.transfer(address(escrow), price);
    escrow.buyTokens(buyer, amount, price);
  }
}
