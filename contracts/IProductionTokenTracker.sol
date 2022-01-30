//SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

interface IProductionTokenTracker {
  function tokenTransfer(
    uint256 tokenId,
    address currentOnwer,
    address newOwner,
    uint256 numTokens
  ) external;
}
