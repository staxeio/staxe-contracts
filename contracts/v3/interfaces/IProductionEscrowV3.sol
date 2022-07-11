//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IProductionTokenTrackerV3.sol";

interface IProductionEscrowV3 is IProductionTokenTrackerV3 {
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
    uint256 crowdsaleEndDate;
    uint256 productionEndDate;
    uint8 platformSharePercentage;
  }

  // --- Events ---

  event StateChanged(ProductionState from, ProductionState to, address by);
  event TokenBought(address buyer, uint256 amount, uint256 price, uint16 perkClaimed);
  event FundingClaimed(uint256 amount, uint256 platformShare, address by);
  event ProceedsDeposited(uint256 amount, address by);
  event ProceedsClaimed(uint256 amount, address by);

  // --- Functions ---

  function getProductionData() external view returns (ProductionData memory);

  function getProductionDataWithPerks()
    external
    view
    returns (
      ProductionData memory,
      Perk[] memory,
      uint256
    );

  function getTokenOwnerData(address tokenOwner)
    external
    view
    returns (
      uint256 balance,
      Perk[] memory perks,
      uint256 proceedsClaimed,
      uint256 proceedsAvailable
    );

  function getTokensAvailable() external view returns (uint256);

  function getTokenPrice(uint256 amount, address buyer) external view returns (IERC20, uint256);

  function approve(address approver) external;

  function decline(address decliner) external;

  function finish(address caller, address platformTreasury) external;

  function close(address caller, address platformTreasury) external;

  function buyTokens(
    address buyer,
    uint256 amount,
    uint256 price,
    uint16 perk
  ) external;

  function depositProceeds(address caller, uint256 amount) external;

  function transferProceeds(address tokenHolder) external returns (uint256 amount);

  function transferFunding(address caller, address platformTreasury)
    external
    returns (uint256 amount, uint256 platformShare);
}
