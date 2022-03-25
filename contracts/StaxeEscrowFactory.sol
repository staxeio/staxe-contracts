//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./interfaces/IProductionEscrow.sol";
import "./interfaces/IEscrowFactory.sol";
import "./interfaces/IStaxeProductions.sol";
import "./ProductionEscrow.sol";

contract StaxeEscrowFactory is IEscrowFactory {
  function newEscrow(
    IERC1155 token,
    IStaxeProductions productions,
    uint256 productionId
  ) external override returns (IProductionEscrow) {
    ProductionEscrow escrow = new ProductionEscrow(token, productions, productionId);
    escrow.transferOwnership(msg.sender);
    return escrow;
  }
}
