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
import "@uniswap/v3-periphery/contracts/interfaces/IPeripheryPayments.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import "./interfaces/IProductionEscrowV3.sol";
import "./interfaces/IProductionTokenV3.sol";
import "./interfaces/IProductionsV3.sol";

interface IUniswapRouter is IPeripheryPayments, ISwapRouter {}

contract StaxeProductionsV3 is ERC2771ContextUpgradeable, OwnableUpgradeable, IStaxeProductionsV3 {
  using CountersUpgradeable for CountersUpgradeable.Counter;
  using AddressUpgradeable for address payable;

  struct Production {
    uint256 id;
    IProductionEscrowV3 deposits;
  }

  // ---------- State ----------

  CountersUpgradeable.Counter private tokenIds;
  mapping(address => bool) private trustedEscrowFactories;
  mapping(address => bool) private trustedErc20Coins;
  IUniswapRouter private router;

  mapping(uint256 => Production) public productionEscrows;
  IStaxeProductionTokenV3 public productionToken;
  address public treasury;
  IERC20 public nativeWrapper;

  // ---------- Functions ----------

  constructor(address trustedForwarder) ERC2771ContextUpgradeable(trustedForwarder) {}

  // ---- Proxy ----

  function initialize(
    IStaxeProductionTokenV3 _productionToken,
    IUniswapRouter _router,
    IERC20 _nativeWrapper,
    address _treasury
  ) public initializer {
    productionToken = _productionToken;
    router = _router;
    nativeWrapper = _nativeWrapper;
    treasury = _treasury;
    __Ownable_init();
  }

  // ---- Lifecycle ----

  function mintProduction(IProductionEscrowV3 escrow, uint256 totalAmount) external {
    require(trustedEscrowFactories[_msgSender()], "Untrusted Escrow Factory");
    require(trustedErc20Coins[address(escrow.getProductionData().currency)], "Unknown ERC20 token");
    tokenIds.increment();
    uint256 current = tokenIds.current();
    emit ProductionCreated(current, _msgSender(), totalAmount, address(escrow));
    productionEscrows[current] = Production({id: current, deposits: escrow});
    productionToken.mintToken(address(escrow), current, totalAmount);
  }

  function buyTokensWithCurrency(
    uint256 id,
    address buyer,
    uint256 amount,
    uint24 fee,
    uint256 deadline
  ) external payable {
    require(productionEscrows[id].id != 0, "Unknown production");
    require(amount > 0, "Must pass amount > 0");
    require(msg.value > 0, "Must pass msg.value > 0");
    (IERC20 token, uint256 price) = productionEscrows[id].deposits.getTokenPrice(amount, buyer);
    _swapToTargetToken(token, price, fee, deadline);
    // TODO: send to escrow and do token transfer
  }

  function buyTokensWithTokens(
    uint256 id,
    address buyer,
    uint256 amount
  ) external {
    require(productionEscrows[id].id != 0, "Unknown production");
    (IERC20 token, uint256 price) = productionEscrows[id].deposits.getTokenPrice(amount, buyer);
    require(token.allowance(buyer, address(this)) >= price, "Insufficient allowance");
    token.transfer(address(this), price);
    token.transfer(address(productionEscrows[id].deposits), price);
    productionEscrows[id].deposits.buyTokens(buyer, amount, price);
  }

  function proceedsToTreasury(uint256 id, address owner) external {
    require(isTrustedForwarder(_msgSender()), "Only callable from forwarder proxy");
    require(productionEscrows[id].id != 0, "Unknown production");
    productionEscrows[id].deposits.redeemProceeds(treasury, owner);
  }

  function finishProduction(uint256 id) external {}

  // ---- Utilities ----

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
    uint24 fee,
    uint256 deadline
  ) private {
    ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams({
      tokenIn: address(nativeWrapper),
      tokenOut: address(targetToken),
      fee: fee,
      recipient: address(this),
      deadline: deadline,
      amountOut: targetAmount,
      amountInMaximum: msg.value,
      sqrtPriceLimitX96: 0
    });

    router.exactOutputSingle{value: msg.value}(params);
    router.refundETH();

    payable(_msgSender()).sendValue(address(this).balance);
  }
}
