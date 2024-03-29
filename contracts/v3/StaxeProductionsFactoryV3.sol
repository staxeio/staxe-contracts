//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "./interfaces/IMembersV3.sol";
import "./interfaces/IPerkTrackerV3.sol";
import "./interfaces/IPriceCalculationEngineV3.sol";
import "./interfaces/IProductionsV3.sol";
import "./interfaces/IProductionEscrowV3.sol";
import "./StaxeProductionEscrowV3.sol";

// import "hardhat/console.sol";

contract StaxeProductionsFactoryV3 {
  // ----- Structs -----
  struct CreatePerk {
    uint16 total;
    uint256 minTokensRequired;
  }

  struct CreateProduction {
    uint256 totalSupply;
    uint256 organizerTokens;
    uint256 tokenPrice;
    address currency;
    uint256 maxTokensUnknownBuyer;
    CreatePerk[] perks;
    string dataHash;
    uint256 crowdsaleEndDate;
    uint256 productionEndDate;
    uint8 platformSharePercentage;
    address perkTracker;
  }

  // ----- Events -----
  event ProductionCreated(uint256 indexed id, address indexed creator, uint256 tokenSupply, address escrow);

  // ----- State -----
  IProductionsV3 private productions;
  IMembersV3 private members;
  IPriceCalculationEngineV3 private priceCalculationEngine;

  constructor(
    IProductionsV3 _productions,
    IMembersV3 _members,
    IPriceCalculationEngineV3 _priceCalculationEngine
  ) {
    productions = _productions;
    members = _members;
    priceCalculationEngine = _priceCalculationEngine;
  }

  // ----- Functions -----
  function createProduction(CreateProduction calldata data) external {
    require(members.isOrganizer(msg.sender), "Not an organizer");
    IProductionEscrowV3.Perk[] memory perks = new IProductionEscrowV3.Perk[](data.perks.length);
    for (uint16 i = 0; i < perks.length; i++) {
      CreatePerk memory perk = data.perks[i];
      perks[i] = IProductionEscrowV3.Perk({
        id: i + 1,
        total: perk.total,
        claimed: 0,
        minTokensRequired: perk.minTokensRequired
      });
    }
    IProductionEscrowV3.ProductionData memory productionData = IProductionEscrowV3.ProductionData({
      id: 0,
      creator: msg.sender,
      totalSupply: data.totalSupply,
      organizerTokens: data.organizerTokens,
      maxTokensUnknownBuyer: data.maxTokensUnknownBuyer,
      soldCounter: 0,
      currency: IERC20Upgradeable(data.currency),
      state: IProductionEscrowV3.ProductionState.CREATED,
      dataHash: data.dataHash,
      crowdsaleEndDate: data.crowdsaleEndDate,
      productionEndDate: data.productionEndDate,
      platformSharePercentage: data.platformSharePercentage,
      perkTracker: IPerkTrackerV3(data.perkTracker),
      priceCalculationEngine: IPriceCalculationEngineV3(priceCalculationEngine)
    });
    StaxeProductionEscrowV3 escrow = new StaxeProductionEscrowV3(productionData, perks, data.tokenPrice, members);
    escrow.transferOwnership(address(productions));
    if (data.perkTracker != address(0)) {
      productionData.perkTracker.registerEscrow(escrow);
    }
    uint256 id = productions.mintProduction(escrow, msg.sender, data.totalSupply);
    emit ProductionCreated(id, msg.sender, data.totalSupply, address(escrow));
  }
}
