//SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "hardhat/console.sol";

contract EventEscrowFactory {
  function newEscrow(
    IERC1155 eventToken,
    uint256 eventId,
    address creator
  ) external returns (EventEscrow) {
    EventEscrow escrow = new EventEscrow(eventToken, eventId, creator);
    escrow.transferOwnership(msg.sender);
    return escrow;
  }
}

contract EventEscrow is Ownable, IERC1155Receiver {
  using Address for address payable;

  event Deposit(address indexed payer, uint256 amount);
  event Payout(address indexed payee, uint256 amount);
  event FundsWithdrawn(address receiver, uint256 amount);
  event ProceedsIn(uint256 amount);

  IERC1155 private eventToken;
  address public creator;
  uint256 public eventId;

  constructor(
    IERC1155 _eventToken,
    uint256 _eventId,
    address _creator
  ) Ownable() {
    require(_creator != address(0), "INVALID_CREATOR");
    eventToken = _eventToken;
    eventId = _eventId;
    creator = _creator;
  }

  function investorBuyToken(address payer, uint256 numTokens) external payable onlyOwner {
    uint256 amount = msg.value;
    emit Deposit(payer, amount);
    eventToken.safeTransferFrom(address(this), payer, eventId, numTokens, "0x0");
  }

  function investorSellToken(address payee, uint256 amount) external onlyOwner {
    require(address(this).balance >= amount, "NOT_ENOUGH_FUNDS");
    emit Payout(payee, amount);
    payable(payee).sendValue(amount);
  }

  function withdraw(address receiver, uint256 amount) external onlyOwner {
    require(receiver == creator, "NOT_ELIGIBLE");
    require(address(this).balance >= amount, "NOT_ENOUGH_FUNDS");
    emit FundsWithdrawn(receiver, amount);
    payable(receiver).sendValue(amount);
  }

  function proceeds() external payable onlyOwner {
    emit ProceedsIn(msg.value);
  }

  function onERC1155Received(
    address operator,
    address from,
    uint256 tokenId,
    uint256 value,
    bytes calldata _data
  ) external virtual override returns (bytes4) {
    require(tokenId == eventId, "WRONG_EVENT_ID");
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
