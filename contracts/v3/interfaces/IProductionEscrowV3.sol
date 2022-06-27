//SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IProductionEscrowV3 {
  enum ProductionState {
    EMPTY,
    CREATED,
    OPEN,
    FINISHED,
    DECLINED,
    CANCELED,
    CLOSED
  }

  struct Perk {
    uint16 id;
    uint16 total;
    uint16 claimed;
    uint256 minTokensRequired;
  }

  struct ProductionData {
    uint256 id;
    address creator;
    uint256 totalSupply;
    uint256 soldCounter;
    uint256 maxTokensUnknownBuyer;
    IERC20 currency;
    ProductionState state;
    string dataHash;
  }

  function getProductionData() external view returns (ProductionData memory);

  function getProductionDataWithPerks() external view returns (ProductionData memory, Perk[] memory);

  function getTokensAvailable() external view returns (uint256);

  function getTokenPrice(uint256 amount, address buyer) external view returns (IERC20, uint256);

  function approve() external;

  function decline() external;

  function finish() external;

  function close() external;

  function swipe() external;

  function buyTokens(
    address buyer,
    uint256 amount,
    uint256 price
  ) external;

  function redeemProceeds(address holder, address receiver) external;

  function transferFunding() external;
}
