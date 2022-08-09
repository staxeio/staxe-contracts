//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./IProductionEscrowV3.sol";

interface IPriceCalculationEngineV3 {
  function calculateTokenPrice(
    IProductionEscrowV3 escrow,
    IProductionEscrowV3.ProductionData calldata production,
    uint256 tokenBasePrice,
    uint256 amount,
    address buyer
  ) external view returns (IERC20Upgradeable currency, uint256 price);
}
