//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./IProductionEscrowV2.sol";
import "./IStaxeProductionsV2.sol";

interface IEscrowFactoryV2 {
  function newEscrow(
    IERC1155 token,
    IStaxeProductionsV2 productions,
    uint256 productionId
  ) external returns (IProductionEscrowV2);
}
