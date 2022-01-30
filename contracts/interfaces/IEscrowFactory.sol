//SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./IProductionEscrow.sol";
import "./IStaxeProductions.sol";

interface IEscrowFactory {
  function newEscrow(
    IERC1155 token,
    IStaxeProductions productions,
    uint256 productionId
  ) external returns (IProductionEscrow);
}
