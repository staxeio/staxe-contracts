//SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/IMembersV3.sol";
import "./interfaces/IProductionsV3.sol";
import "./interfaces/IProductionEscrowV3.sol";
import "./StaxeProductionEscrowV3.sol";

contract StaxeProductionsFactoryV3 is Ownable {
  // ----- Structs -----
  struct CreateProduction {
    uint256 totalSupply;
    uint256 maxTokensUnknownBuyer;
    uint256[] perksReachedWithTokens;
    address currency;
    uint256 tokenPrice;
    string dataHash;
  }

  // ----- Events -----
  event ProductionCreated(uint256 indexed id, address indexed creator, uint256 tokenSupply, address escrow);

  // ----- State -----
  IProductionsV3 private productions;
  IMembersV3 private members;

  constructor(IProductionsV3 _productions, IMembersV3 _members) Ownable() {
    productions = _productions;
    members = _members;
  }

  // ----- Functions -----
  function createProduction(CreateProduction memory data) external {
    require(members.isOrganizer(msg.sender), "Not an organizer");
    IProductionEscrowV3.ProductionData memory productionData = IProductionEscrowV3.ProductionData({
      id: 0,
      creator: msg.sender,
      totalSupply: data.totalSupply,
      maxTokensUnknownBuyer: data.maxTokensUnknownBuyer,
      soldCounter: 0,
      perksReachedWithTokens: data.perksReachedWithTokens,
      currency: IERC20(data.currency),
      state: IProductionEscrowV3.ProductionState.CREATED,
      dataHash: data.dataHash
    });
    StaxeProductionEscrowV3 escrow = new StaxeProductionEscrowV3(productionData, data.tokenPrice);
    escrow.transferOwnership(address(productions));
    uint256 id = productions.mintProduction(escrow, msg.sender, data.totalSupply);
    emit ProductionCreated(id, msg.sender, data.totalSupply, address(escrow));
  }
}
