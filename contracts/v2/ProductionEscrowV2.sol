//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "./interfaces/IProductionEscrowV2.sol";
import "./interfaces/IStaxeProductionsV2.sol";

contract ProductionEscrowV2 is Ownable, IERC1155Receiver, IProductionEscrowV2 {
  using Address for address payable;

  IERC1155 private productionToken;
  IStaxeProductionsV2 private productions;
  uint256 public productionId;

  uint256 public fundsBalance;
  uint256 private proceedsTotal;
  mapping(address => uint256) private proceedsPaid;

  constructor(
    IERC1155 _productionToken,
    IStaxeProductionsV2 _productions,
    uint256 _productionId
  ) Ownable() {
    productionToken = _productionToken;
    productions = _productions;
    productionId = _productionId;
  }

  // --- Callable by owner only

  function investorBuyToken(address payer, uint256 numTokens) external payable override onlyOwner {
    uint256 amount = msg.value;
    emit FundsDeposit(payer, amount);
    fundsBalance += amount;
    productionToken.safeTransferFrom(address(this), payer, productionId, numTokens, "0x0");
  }

  function withdrawFunds(address receiver, uint256 amount) external override onlyOwner {
    require(receiver == _productionData().creator, "NOT_CREATOR");
    require(fundsBalance >= amount, "NOT_ENOUGH_FUNDS_AVAILABLE");
    emit FundsPayout(receiver, amount);
    fundsBalance -= amount;
    payable(receiver).sendValue(amount);
  }

  function proceeds(address payer) external payable override onlyOwner {
    require(payer == _productionData().creator, "NOT_CREATOR");
    uint256 amount = msg.value;
    emit ProceedsDeposit(payer, amount);
    proceedsTotal += amount;
  }

  function withdrawProceeds(address receiver) external override onlyOwner {
    uint256 amount = _maxPayoutFor(receiver);
    emit ProceedsPayout(receiver, amount);
    proceedsPaid[receiver] += amount;
    payable(receiver).sendValue(amount);
  }

  // --- Callable directly

  function getWithdrawableFunds() external view override returns (uint256) {
    return fundsBalance;
  }

  function getWithdrawableProceeds(address investor) external view override returns (uint256) {
    return _maxPayoutFor(investor);
  }

  function getNextTokenPrice(
    address, /*investor*/
    uint256 tokensToBuy
  ) external view override returns (uint256) {
    uint256 tokenValue = _amountPerToken();
    uint256 tokenPrice = _productionData().tokenPrice;
    return tokenValue > tokenPrice ? tokenValue * tokensToBuy : tokenPrice * tokensToBuy;
  }

  function tokenTransfer(
    IERC1155 tokenContract,
    uint256 tokenId,
    address, /*currentOwner*/
    address, /*newOwner*/
    uint256 /*numTokens*/
  ) external view override {
    require(productionToken == tokenContract, "INVALID_CONTRACT");
    require(tokenId == productionId, "INVALID_TOKEN_ID");
    require(proceedsTotal == 0, "CANNOT_TRANSFER_WHEN_PROCEEDS_EXIST");
    require(_productionData().state != IStaxeProductionsV2.ProductionState.FINISHED, "PRODUCTION_FINISHED");
  }

  function canTransfer(
    IERC1155 tokenContract,
    uint256 tokenId,
    address, /*currentOwner*/
    address, /*newOwner*/
    uint256 /*numTokens*/
  ) external view override returns (bool) {
    return
      productionToken == tokenContract &&
      tokenId == productionId &&
      proceedsTotal == 0 &&
      _productionData().state != IStaxeProductionsV2.ProductionState.FINISHED;
  }

  function onERC1155Received(
    address, /*operator*/
    address, /*from*/
    uint256 tokenId,
    uint256, /*value*/
    bytes calldata /*data*/
  ) external virtual override returns (bytes4) {
    require(tokenId == productionId, "WRONG_EVENT_ID");
    return this.onERC1155Received.selector;
  }

  function onERC1155BatchReceived(
    address, /*operator*/
    address, /*from*/
    uint256[] calldata, /*tokenIds*/
    uint256[] calldata, /*values*/
    bytes calldata /*data*/
  ) external virtual override returns (bytes4) {
    return 0x00; // unsupported
  }

  // ERC165 - needed from ERC1155Receiver
  function supportsInterface(bytes4 interfaceID) external view virtual override returns (bool) {
    return
      interfaceID == 0x01ffc9a7 || // ERC-165 support (i.e. `bytes4(keccak256('supportsInterface(bytes4)'))`).
      interfaceID == 0x4e2312e0; // ERC-1155 `ERC1155TokenReceiver` support (i.e. `bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)")) ^ bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))`).
  }

  // ----- Internals

  function _maxPayoutFor(address receiver) internal view returns (uint256) {
    uint256 amountPerToken = _amountPerToken();
    uint256 tokensOwned = productionToken.balanceOf(receiver, productionId);
    return (amountPerToken * tokensOwned) - proceedsPaid[receiver];
  }

  function _amountPerToken() internal view returns (uint256) {
    IStaxeProductionsV2.ProductionData memory data = _productionData();
    // Production finished?
    // -> No more tokens sold. Unsold tokens do not count for payout calculations.
    // -> Otherwise calculate based on assumption that more tokens are sold.
    uint256 divideByTokens = (
      data.state == IStaxeProductionsV2.ProductionState.FINISHED ? data.tokensSoldCounter : data.tokenSupply
    );
    return (proceedsTotal - (proceedsTotal % divideByTokens)) / divideByTokens;
  }

  function _productionData() internal view returns (IStaxeProductionsV2.ProductionData memory) {
    return productions.getProductionData(productionId);
  }
}
