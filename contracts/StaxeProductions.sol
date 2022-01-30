//SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IStaxeProductionToken.sol";
import "./interfaces/IProductionEscrow.sol";
import "./interfaces/IStaxeMembers.sol";
import "./interfaces/IEscrowFactory.sol";
import "./interfaces/IStaxeProductions.sol";

contract StaxeProductions is Ownable, IStaxeProductions {
  // ------- Contract state

  IStaxeProductionToken public token;
  mapping(uint256 => ProductionData) public productionData;

  IEscrowFactory private escrowFactory;
  IStaxeMembers private members;

  constructor(
    IStaxeProductionToken _token,
    IEscrowFactory _escrowFactory,
    IStaxeMembers _members
  ) Ownable() {
    token = _token;
    escrowFactory = _escrowFactory;
    members = _members;
  }

  function setEscrowFactory(IEscrowFactory _escrowFactory) external onlyOwner {
    escrowFactory = _escrowFactory;
  }

  function setMembers(IStaxeMembers _members) external onlyOwner {
    members = _members;
  }

  // ------- Lifecycle

  function createNewProduction(
    uint256 id,
    uint256 tokenSupply,
    uint256 tokenPrice
  ) external {
    require(members.isOrganizer(msg.sender), "NOT_ORGANIZER");
    require(id > 0, "EVENT_ID_0");
    require(tokenSupply > 0, "ZERO_TOKEN_SUPPLY");
    require(tokenPrice > 0, "ZERO_TOKEN_PRICE");
    require(productionData[id].id == 0, "EVENT_EXISTS");
    emit ProductionCreated(id, msg.sender, tokenSupply);
    ProductionData storage data = productionData[id];
    data.id = id;
    data.creator = msg.sender;
    data.tokenSupply = tokenSupply;
    data.tokenPrice = tokenPrice;
    data.state = ProductionState.CREATED;
    data.deposits = escrowFactory.newEscrow(token, data);
    token.mintToken(data.deposits, id, tokenSupply);
  }

  function approveProduction(uint256 id) external {
    require(members.isApprover(msg.sender), "NOT_APPROVER");
    require(productionData[id].id > 0, "NOT_EXIST");
    require(productionData[id].state == ProductionState.CREATED, "NOT_CREATED");
    productionData[id].state = ProductionState.OPEN;
  }

  function declineProduction(uint256 id) external {
    require(members.isApprover(msg.sender), "NOT_APPROVER");
    require(productionData[id].id > 0, "NOT_EXIST");
    require(productionData[id].state == ProductionState.CREATED, "NOT_CREATED");
    productionData[id].state = ProductionState.DECLINED;
  }

  // ------- Investment

  function buyTokens(uint256 id, uint256 numTokens) external payable {
    // checks
    require(msg.value > 0, "ZERO_VALUE");
    require(numTokens > 0, "ZERO_TOKEN");
    ProductionData storage data = productionData[id];
    require(data.id > 0, "NOT_EXIST");
    require(data.state == ProductionState.OPEN, "NOT_OPEN");
    require(data.tokensSoldCounter + numTokens <= data.tokenSupply, "NOT_ENOUGH_TOKENS");
    require(data.tokenPrice * numTokens <= msg.value, "NOT_ENOUGH_MONEY_SENT");
    // update state
    emit ProductionTokenBought(id, msg.sender, numTokens);
    data.tokensSoldCounter = numTokens + productionData[id].tokensSoldCounter;
    uint256 price = data.tokenPrice * numTokens;
    uint256 exceed = msg.value - price;
    data.deposits.investorBuyToken{value: price}(msg.sender, numTokens);
    payable(msg.sender).transfer(exceed);
  }

  function withdrawFunds(uint256 id, uint256 amount) external {
    require(productionData[id].id > 0, "NOT_EXIST");
    require(productionData[id].state == ProductionState.OPEN, "NOT_OPEN");
    require(amount > 0, "NOT_ZERO");
    productionData[id].deposits.withdrawFunds(msg.sender, amount);
  }

  function withdrawProceeds(uint256 id, uint256 amount) external {
    require(members.isInvestor(msg.sender), "NOT_INVESTOR");
    ProductionData memory data = productionData[id];
    require(data.id > 0, "NOT_EXIST");
    data.deposits.withdrawProceeds(msg.sender, amount);
  }

  function proceeds(uint256 id) external payable {
    // checks
    require(members.isOrganizer(msg.sender), "NOT_ORGANIZER");
    require(msg.value > 0, "ZERO_VALUE");
    ProductionData storage data = productionData[id];
    require(data.id > 0, "NOT_EXIST");
    require(data.state == ProductionState.OPEN, "NOT_OPEN");
    // forward to escrow
    data.deposits.proceeds{value: msg.value}(msg.sender);
  }

  function finish(uint256 id) external {
    // checks
    require(members.isOrganizer(msg.sender), "NOT_ORGANIZER");
    ProductionData storage data = productionData[id];
    require(data.id > 0, "NOT_EXIST");
    require(data.state == ProductionState.OPEN, "NOT_OPEN");
    require(msg.sender == data.creator, "NOT_CREATOR");
    // update state
    data.state = ProductionState.FINISHED;
  }
}
