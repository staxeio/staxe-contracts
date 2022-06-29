//SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;

import "./IProductionEscrowV3.sol";

interface IProductionsV3 {
  event ProductionMinted(uint256 indexed id, address indexed creator, uint256 tokenSupply, address escrow);
  event TokenBought(uint256 indexed id, address indexed buyer, uint256 amount, uint256 price, uint16 perkClaimed);
  event FundingClaimed(uint256 indexed id, address indexed buyer, uint256 amount, uint256 platformShare);
  event ProceedsDeposited(uint256 indexed id, address indexed creator, uint256 amount);
  event ProceedsClaimed(uint256 indexed id, address indexed buyer, uint256 amount);

  struct Escrow {
    uint256 id;
    IProductionEscrowV3 escrow;
  }

  struct Production {
    uint256 id;
    IProductionEscrowV3.ProductionData data;
    IProductionEscrowV3.Perk[] perks;
    IProductionEscrowV3 escrow;
    uint256 fundsRaised;
    uint256 escrowBalance;
  }

  function mintProduction(
    IProductionEscrowV3 escrow,
    address creator,
    uint256 totalAmount
  ) external returns (uint256 id);

  function getTokenPrice(uint256 id, uint256 amount) external view returns (IERC20, uint256);

  function getTokenPriceFor(
    uint256 id,
    uint256 amount,
    address buyer
  ) external view returns (IERC20, uint256);
}
