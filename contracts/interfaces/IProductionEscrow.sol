//SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "./IProductionTokenTracker.sol";

interface IProductionEscrow is IProductionTokenTracker {
  function investorBuyToken(address investor, uint256 numTokens) external payable;

  function withdrawFunds(address organizer, uint256 amount) external;

  function proceeds(address organizer) external payable;

  function withdrawProceeds(address investor, uint256 amount) external;
}
