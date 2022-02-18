//SPDX-License-Identifier: MIT
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
  address public treasury;
  mapping(uint256 => ProductionData) public productionData;

  IEscrowFactory private escrowFactory;
  IStaxeMembers private members;

  constructor(
    IStaxeProductionToken _token,
    IEscrowFactory _escrowFactory,
    IStaxeMembers _members,
    address _treasury
  ) Ownable() {
    token = _token;
    escrowFactory = _escrowFactory;
    members = _members;
    treasury = _treasury;
  }

  function setEscrowFactory(IEscrowFactory _escrowFactory) external onlyOwner {
    escrowFactory = _escrowFactory;
  }

  function setMembers(IStaxeMembers _members) external onlyOwner {
    members = _members;
  }

  function setTreasury(address _treasury) external onlyOwner {
    treasury = _treasury;
  }

  function getProductionData(uint256 id) external view override returns (ProductionData memory) {
    return productionData[id];
  }

  function getProductionDataForProductions(uint256[] memory ids)
    external
    view
    override
    returns (ProductionData[] memory)
  {
    ProductionData[] memory result = new ProductionData[](ids.length);
    for (uint256 i = 0; i < ids.length; i++) {
      result[i] = productionData[ids[i]];
    }
    return result;
  }

  // ------- Lifecycle

  function createNewProduction(CreateProduction calldata newProduction) external override {
    require(members.isOrganizer(msg.sender), "NOT_ORGANIZER");
    require(newProduction.id > 0, "ID_0_NOT_ALLOWED");
    require(newProduction.tokenInvestorSupply > 0, "ZERO_TOKEN_SUPPLY");
    require(newProduction.tokenPrice > 0, "ZERO_TOKEN_PRICE");
    require(productionData[newProduction.id].id == 0, "PRODUCTION_EXISTS");
    emit ProductionCreated(
      newProduction.id,
      msg.sender,
      newProduction.tokenInvestorSupply,
      newProduction.tokenOrganizerSupply,
      newProduction.tokenTreasurySupply
    );
    ProductionData storage data = productionData[newProduction.id];
    data.id = newProduction.id;
    data.creator = msg.sender;
    data.tokenSupply =
      newProduction.tokenInvestorSupply +
      newProduction.tokenOrganizerSupply +
      newProduction.tokenTreasurySupply;
    data.tokenPrice = newProduction.tokenPrice;
    data.state = ProductionState.CREATED;
    data.maxTokensUnknownBuyer = newProduction.maxTokensUnknownBuyer;
    data.tokensSoldCounter = newProduction.tokenOrganizerSupply + newProduction.tokenTreasurySupply;
    data.dataHash = newProduction.dataHash;
    data.deposits = escrowFactory.newEscrow(token, this, newProduction.id);
    token.mintToken(data.deposits, newProduction.id, newProduction.tokenInvestorSupply);
    token.mintToken(
      [msg.sender, treasury],
      newProduction.id,
      [newProduction.tokenOrganizerSupply, newProduction.tokenTreasurySupply]
    );
  }

  function approveProduction(uint256 id) external override {
    require(members.isApprover(msg.sender), "NOT_APPROVER");
    require(productionData[id].id > 0, "NOT_EXIST");
    require(productionData[id].state == ProductionState.CREATED, "NOT_CREATED");
    productionData[id].state = ProductionState.OPEN;
  }

  function declineProduction(uint256 id) external override {
    require(members.isApprover(msg.sender), "NOT_APPROVER");
    require(productionData[id].id > 0, "NOT_EXIST");
    require(productionData[id].state == ProductionState.CREATED, "NOT_CREATED");
    productionData[id].state = ProductionState.DECLINED;
  }

  // ------- Investment

  function getNextTokensPrice(uint256 id, uint256 numTokens) external view returns (uint256) {
    require(productionData[id].id > 0, "NOT_EXIST");
    return productionData[id].deposits.getNextTokenPrice(msg.sender, numTokens);
  }

  function buyTokens(uint256 id, uint256 numTokens) external payable override {
    // checks
    require(numTokens > 0, "ZERO_TOKEN");
    ProductionData storage data = productionData[id];
    require(data.id > 0, "NOT_EXIST");
    require(data.state == ProductionState.OPEN, "NOT_OPEN");
    require(
      data.maxTokensUnknownBuyer == 0 || members.isInvestor(msg.sender) || numTokens <= data.maxTokensUnknownBuyer,
      "MAX_TOKENS_EXCEEDED_FOR_NON_INVESTOR"
    );
    require(data.tokensSoldCounter + numTokens <= data.tokenSupply, "NOT_ENOUGH_TOKENS");
    uint256 price = data.deposits.getNextTokenPrice(msg.sender, numTokens);
    require(price <= msg.value, "NOT_ENOUGH_FUNDS_SENT");
    // update state
    emit ProductionTokenBought(id, msg.sender, numTokens, price);
    data.tokensSoldCounter = numTokens + productionData[id].tokensSoldCounter;
    data.deposits.investorBuyToken{value: price}(msg.sender, numTokens);
    uint256 exceed = msg.value - price;
    if (exceed > 0) {
      payable(msg.sender).transfer(exceed);
    }
  }

  function withdrawFunds(uint256 id, uint256 amount) external override {
    require(members.isOrganizer(msg.sender), "NOT_ORGANIZER");
    require(productionData[id].id > 0, "NOT_EXIST");
    require(productionData[id].state == ProductionState.OPEN, "NOT_OPEN");
    require(amount > 0, "NOT_ZERO");
    emit FundsWithdrawn(id, msg.sender, amount);
    productionData[id].deposits.withdrawFunds(msg.sender, amount);
  }

  function withdrawProceeds(uint256 id) external override {
    require(members.isInvestor(msg.sender), "NOT_INVESTOR");
    ProductionData memory data = productionData[id];
    require(data.id > 0, "NOT_EXIST");
    uint256 amount = data.deposits.getWithdrawableProceeds(msg.sender);
    emit ProceedsWithdrawn(id, msg.sender, amount);
    data.deposits.withdrawProceeds(msg.sender);
  }

  function proceeds(uint256 id) external payable override {
    // checks
    require(members.isOrganizer(msg.sender), "NOT_ORGANIZER");
    require(msg.value > 0, "ZERO_VALUE");
    ProductionData storage data = productionData[id];
    require(data.id > 0, "NOT_EXIST");
    require(data.state == ProductionState.OPEN, "NOT_OPEN");
    // forward to escrow
    emit ProceedsSent(id, msg.sender, msg.value);
    data.deposits.proceeds{value: msg.value}(msg.sender);
  }

  function finish(uint256 id) external payable override {
    // checks
    require(members.isOrganizer(msg.sender), "NOT_ORGANIZER");
    ProductionData storage data = productionData[id];
    require(data.id > 0, "NOT_EXIST");
    require(data.state == ProductionState.OPEN, "NOT_OPEN");
    require(msg.sender == data.creator, "NOT_CREATOR");
    // update state
    if (msg.value > 0) {
      emit ProceedsSent(id, msg.sender, msg.value);
      data.deposits.proceeds{value: msg.value}(msg.sender);
    }
    emit ProductionFinished(id);
    data.state = ProductionState.FINISHED;
  }
}
