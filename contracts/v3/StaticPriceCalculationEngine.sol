//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";

import "./interfaces/IProductionEscrowV3.sol";
import "./interfaces/IPriceCalculationEngineV3.sol";

contract StaticPriceCalculationEngine is IPriceCalculationEngineV3 {
  function calculateTokenPrice(
    IProductionEscrowV3,
    IProductionEscrowV3.ProductionData calldata productionData,
    uint256 tokenBasePrice,
    uint256 amount,
    address
  ) external pure returns (IERC20Upgradeable currency, uint256 price) {
    return (productionData.currency, amount * tokenBasePrice);
  }
}
