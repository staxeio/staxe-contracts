//SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "./IProductionEscrow.sol";
import "./ProductionEscrow.sol";

contract StaxeEscrowFactory {
  function newEscrow(
    IERC1155 token,
    uint256 productionId,
    address creator
  ) external returns (IProductionEscrow) {
    ProductionEscrow escrow = new ProductionEscrow(token, productionId, creator);
    escrow.transferOwnership(msg.sender);
    return escrow;
  }
}
