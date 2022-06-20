//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./interfaces/IProductionEscrowV2.sol";
import "./interfaces/IEscrowFactoryV2.sol";
import "./interfaces/IStaxeProductionsV2.sol";
import "./ProductionEscrowV2.sol";

contract StaxeEscrowFactoryV2 is IEscrowFactoryV2 {
  function newEscrow(
    IERC1155 token,
    IStaxeProductionsV2 productions,
    uint256 productionId
  ) external override returns (IProductionEscrowV2) {
    ProductionEscrowV2 escrow = new ProductionEscrowV2(token, productions, productionId);
    escrow.transferOwnership(msg.sender);
    return escrow;
  }
}
