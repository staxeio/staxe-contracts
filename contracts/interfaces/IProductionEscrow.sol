//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./IProductionTokenTracker.sol";

interface IProductionEscrow is IProductionTokenTracker {
  // ---- Events

  event FundsDeposit(address indexed payer, uint256 amount);
  event ProceedsDeposit(address indexed payer, uint256 amount);
  event FundsPayout(address indexed receiver, uint256 amount);
  event ProceedsPayout(address indexed receiver, uint256 amount);

  // -- Functions

  function investorBuyToken(address investor, uint256 numTokens) external payable;

  function withdrawFunds(address organizer, uint256 amount) external;

  function proceeds(address organizer) external payable;

  function withdrawProceeds(address investor) external;

  function getWithdrawableFunds() external view returns (uint256);

  function getWithdrawableProceeds(address investor) external view returns (uint256);

  function getNextTokenPrice(address investor, uint256 tokensToBuy) external view returns (uint256);
}
