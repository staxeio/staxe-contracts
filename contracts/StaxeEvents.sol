//SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";
import "./IStaxeEventToken.sol";
import "./EventEscrow.sol";

contract StaxeEvents is Ownable, AccessControl, IERC1155Receiver {

  // ------- Data structures

  enum EventState {EMPTY, CREATED, OPEN, FINISHED, DECLINED}

  struct EventData {
    uint256 eventId;
    address creator;
    uint256 tokenSupply; // Total number of tokens to mint
    uint256 tokensSoldCounter; // Number of tokens already sold.
    uint256 tokenBuyPrice; // Token buy back price, to be calculated
    uint256 tokenSellPrice; // Selling price to investors, TODO: Probably better placed inside the custom Escrow once dynamic?
    EventState eventState;
    EventEscrow deposits;
  }

  // ------- Events

  event EventCreated(uint256 indexed eventId, address indexed creator, uint256 tokenSupply);
  event EventFinished(uint256 indexed eventId, uint256 proceeds, uint256 tokenPrice);
  event EventTokenBought(uint256 indexed eventId, address indexed buyer, uint256 tokens);
  event EventTokenSold(uint256 indexed eventId, address indexed seller, uint256 tokens);

  // ------- Contract state

  bytes32 public constant INVESTOR_ROLE = keccak256("INVESTOR_ROLE");
  bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
  bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

  IStaxeEventToken public eventToken;
  mapping(uint256 => EventData) public eventData;
  EventEscrowFactory private escrowFactory;

  constructor(IStaxeEventToken _eventToken, EventEscrowFactory _escrowFactory) Ownable() {
    eventToken = _eventToken;
    escrowFactory = _escrowFactory;
    _setupRole(AccessControl.DEFAULT_ADMIN_ROLE, msg.sender);
    _setupRole(INVESTOR_ROLE, msg.sender);
    _setupRole(ORGANIZER_ROLE, msg.sender);
    _setupRole(APPROVER_ROLE, msg.sender);
  }

  function getEventData(uint256 eventId) external view returns (EventData memory) {
    return eventData[eventId];
  }

  function getEventDataForEvents(uint256[] memory eventIds) external view returns (EventData[] memory) {
    EventData[] memory result = new EventData[](eventIds.length);
    for (uint256 i = 0; i < eventIds.length; i++) {
      result[i] = eventData[eventIds[i]];
    }
    return result;
  }

  function hasRoleAssigned(string memory roleName) external view returns (bool) {
    return hasRole(keccak256(bytes(roleName)), msg.sender);
  }

  // ------- Lifecycle

  function createNewEvent(
    uint256 eventId,
    uint256 tokenSupply,
    uint256 tokenPrice
  ) external {
    require(hasRole(ORGANIZER_ROLE, msg.sender), "NOT_ORGANIZER");
    require(eventId > 0, "EVENT_ID_0");
    require(tokenSupply > 0, "ZERO_TOKEN_SUPPLY");
    require(tokenPrice > 0, "ZERO_TOKEN_PRICE");
    require(eventData[eventId].eventId == 0, "EVENT_EXISTS");
    emit EventCreated(eventId, msg.sender, tokenSupply);
    eventData[eventId].eventId = eventId;
    eventData[eventId].creator = msg.sender;
    eventData[eventId].tokenSupply = tokenSupply;
    eventData[eventId].tokenSellPrice = tokenPrice;
    eventData[eventId].eventState = EventState.CREATED;
    eventData[eventId].deposits = escrowFactory.newEscrow(eventToken, eventId, msg.sender);
    eventToken.mintEventToken(address(eventData[eventId].deposits), eventId, tokenSupply);
  }

  function approveEvent(uint256 eventId) external {
    require(hasRole(APPROVER_ROLE, msg.sender), "NOT_APPROVER");
    require(eventData[eventId].eventId > 0, "NOT_EXIST");
    require(eventData[eventId].eventState == EventState.CREATED, "NOT_CREATED");
    eventData[eventId].eventState = EventState.OPEN;
  }

  function declineEvent(uint256 eventId) external {
    require(hasRole(APPROVER_ROLE, msg.sender), "NOT_APPROVER");
    require(eventData[eventId].eventId > 0, "NOT_EXIST");
    require(eventData[eventId].eventState == EventState.CREATED, "NOT_CREATED");
    eventData[eventId].eventState = EventState.DECLINED;
  }

  // ------- Investment

  function getTokensAvailable(uint256 eventId) external view returns (uint256) {
    require(eventData[eventId].eventId > 0, "NOT_EXIST");
    return eventToken.balanceOf(address(this), eventId);
  }

  function getTokenPrice(uint256 eventId, uint256 numTokens) external view returns (uint256) {
    require(eventData[eventId].eventId > 0, "NOT_EXIST");
    return eventData[eventId].tokenSellPrice * numTokens;
  }

  function buyEventTokens(uint256 eventId, uint256 numTokens) external payable {
    // checks
    require(hasRole(INVESTOR_ROLE, msg.sender), "NOT_INVESTOR");
    require(msg.value > 0, "ZERO_VALUE");
    require(numTokens > 0, "ZERO_TOKEN");
    require(eventData[eventId].eventId > 0, "NOT_EXIST");
    require(eventData[eventId].eventState == EventState.OPEN, "NOT_OPEN");
    require(eventData[eventId].tokensSoldCounter + numTokens <= eventData[eventId].tokenSupply, "NOT_ENOUGH_TOKENS");
    require(eventData[eventId].tokenSellPrice * numTokens <= msg.value, "NOT_ENOUGH_MONEY_SENT");
    // update state
    emit EventTokenBought(eventId, msg.sender, numTokens);
    eventData[eventId].tokensSoldCounter = numTokens + eventData[eventId].tokensSoldCounter;
    uint256 price = eventData[eventId].tokenSellPrice * numTokens;
    uint256 exceed = msg.value - price;
    eventData[eventId].deposits.investorBuyToken{value: price}(msg.sender, numTokens);
    payable(msg.sender).transfer(exceed);
  }

  function withdrawFunds(uint256 eventId, uint256 amount) external {
    require(hasRole(ORGANIZER_ROLE, msg.sender), "NOT_ORGANIZER");
    require(eventData[eventId].eventId > 0, "NOT_EXIST");
    require(eventData[eventId].eventState == EventState.OPEN, "NOT_OPEN");
    require(amount > 0, "NOT_ZERO");
    eventData[eventId].deposits.withdraw(msg.sender, amount);
  }

  function proceeds(uint256 eventId) external payable {
    // checks
    require(hasRole(ORGANIZER_ROLE, msg.sender), "NOT_ORGANIZER");
    require(msg.value > 0, "ZERO_VALUE");
    require(eventData[eventId].eventId > 0, "NOT_EXIST");
    require(eventData[eventId].eventState == EventState.OPEN, "NOT_OPEN");
    require(eventData[eventId].tokensSoldCounter > 0, "ZERO_TOKEN_SOLD");
    // update state
    eventData[eventId].eventState = EventState.FINISHED;
    (uint256 price, uint256 exceed) =
      _calculateBuyTokenPrice(
        eventData[eventId].tokensSoldCounter,
        address(eventData[eventId].deposits).balance + msg.value
      );
    emit EventFinished(eventId, msg.value - exceed, price);
    eventData[eventId].tokenBuyPrice = price;
    payable(msg.sender).transfer(exceed);
    eventData[eventId].deposits.proceeds{value: msg.value - exceed}();
  }

  // callback from selling a token back to Staxe
  function onERC1155Received(
    address operator,
    address from,
    uint256 eventId,
    uint256 value,
    bytes calldata _data
  ) external virtual override returns (bytes4) {
    _buyTokenFromInvestor(operator, from, eventId, value);
    return this.onERC1155Received.selector;
  }

  function onERC1155BatchReceived(
    address operator,
    address from,
    uint256[] calldata eventIds,
    uint256[] calldata values,
    bytes calldata _data
  ) external virtual override returns (bytes4) {
    require(eventIds.length == values.length, "NOT_SAME_LENGTH");
    for (uint256 i = 0; i < eventIds.length; i++) {
      _buyTokenFromInvestor(operator, from, eventIds[i], values[i]);
    }
    return this.onERC1155BatchReceived.selector;
  }

  // ERC165 - needed from ERC1155Receiver
  function supportsInterface(bytes4 interfaceID) public view virtual override(AccessControl, IERC165) returns (bool) {
    return
      interfaceID == type(IERC165).interfaceId || // ERC-165 support (i.e. `bytes4(keccak256('supportsInterface(bytes4)'))`).
      interfaceID == type(IAccessControl).interfaceId ||
      interfaceID == type(IERC1155Receiver).interfaceId; // ERC-1155 `ERC1155TokenReceiver` support (i.e. `bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)")) ^ bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))`).
  }

  // --------------------- private functions

  function _buyTokenFromInvestor(
    address operator,
    address from,
    uint256 eventId,
    uint256 value
  ) private {
    require(hasRole(INVESTOR_ROLE, from), "NOT_INVESTOR");
    require(hasRole(INVESTOR_ROLE, operator), "OPERATOR_NOT_INVESTOR");
    require(msg.sender == address(eventToken), "NOT_SENT_BY_EVENT_TOKEN");
    require(eventData[eventId].eventId > 0, "NOT_EXIST");
    require(eventData[eventId].eventState == EventState.FINISHED, "NOT_FINISHED");
    emit EventTokenSold(eventId, from, value);
    uint256 price = eventData[eventId].tokenBuyPrice * value;
    eventData[eventId].deposits.investorSellToken(from, price);
  }

  function _calculateBuyTokenPrice(uint256 tokensSold, uint256 totalBalance)
    private
    pure
    returns (uint256 price, uint256 exceed)
  {
    exceed = totalBalance % tokensSold;
    price = (totalBalance - exceed) / tokensSold;
  }
}
