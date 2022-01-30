//SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "./interfaces/IProductionEscrow.sol";

contract ProductionEscrow is Ownable, IERC1155Receiver, IProductionEscrow {
  using Address for address payable;

  event FundsDeposit(address indexed payer, uint256 amount);
  event ProceedsDeposit(address indexed payer, uint256 amount);
  event FundsPayout(address indexed receiver, uint256 amount);
  event ProceedsPayout(address indexed receiver, uint256 amount);

  IERC1155 private productionToken;
  address public creator;
  uint256 public productionId;

  uint256 public fundsBalance;
  uint256 public proceedsBalance;
  uint256 public proceedsTotal;
  mapping(address => uint256) public proceedsPayed;

  constructor(
    IERC1155 _productionToken,
    uint256 _productionId,
    address _creator
  ) Ownable() {
    require(_creator != address(0), "INVALID_CREATOR");
    productionToken = _productionToken;
    productionId = _productionId;
    creator = _creator;
  }

  function tokenTransfer(
    uint256 tokenId,
    address currentOwner,
    address newOwner,
    uint256 numTokens
  ) external {
    require(tokenId == productionId, "INVALID_TOKEN_ID");
    require(proceedsBalance == 0, "CANNOT_TRANSFER_WHEN_PROCEEDS_EXIST");
  }

  function investorBuyToken(address payer, uint256 numTokens) external payable onlyOwner {
    uint256 amount = msg.value;
    emit FundsDeposit(payer, amount);
    fundsBalance += amount;
    productionToken.safeTransferFrom(address(this), payer, productionId, numTokens, "0x0");
  }

  function withdrawFunds(address receiver, uint256 amount) external onlyOwner {
    require(receiver == creator, "NOT_CREATOR");
    require(fundsBalance >= amount, "NOT_ENOUGH_FUNDS");
    emit FundsPayout(receiver, amount);
    fundsBalance -= amount;
    payable(receiver).sendValue(amount);
  }

  function proceeds(address payer) external payable onlyOwner {
    require(payer == creator, "NOT_CREATOR");
    uint256 amount = msg.value;
    emit ProceedsDeposit(payer, amount);
    proceedsBalance += amount;
    proceedsTotal += amount;
  }

  function withdrawProceeds(address receiver, uint256 amount) external onlyOwner {
    // must own at least a token
    // calculate share from total proceeds
    // check if eligible for amount
    // track amount of proceeds taken
    emit ProceedsPayout(receiver, amount);
    payable(receiver).sendValue(amount);
  }

  function onERC1155Received(
    address operator,
    address from,
    uint256 tokenId,
    uint256 value,
    bytes calldata _data
  ) external virtual override returns (bytes4) {
    require(tokenId == productionId, "WRONG_EVENT_ID");
    return this.onERC1155Received.selector;
  }

  function onERC1155BatchReceived(
    address _operator,
    address _from,
    uint256[] calldata _tokenIds,
    uint256[] calldata _values,
    bytes calldata _data
  ) external virtual override returns (bytes4) {
    return 0x00; // unsupported
  }

  // ERC165 - needed from ERC1155Receiver
  function supportsInterface(bytes4 interfaceID) external view virtual override returns (bool) {
    return
      interfaceID == 0x01ffc9a7 || // ERC-165 support (i.e. `bytes4(keccak256('supportsInterface(bytes4)'))`).
      interfaceID == 0x4e2312e0; // ERC-1155 `ERC1155TokenReceiver` support (i.e. `bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)")) ^ bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))`).
  }
}
