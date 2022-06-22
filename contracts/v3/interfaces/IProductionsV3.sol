//SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;

import "./IProductionEscrowV3.sol";

interface IProductionsV3 {
  event ProductionCreated(uint256 indexed id, address indexed creator, uint256 tokenSupply, address escrow);

  function mintProduction(
    IProductionEscrowV3 escrow,
    address creator,
    uint256 totalAmount
  ) external returns (uint256 id);
}
