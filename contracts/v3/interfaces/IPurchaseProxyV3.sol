//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IPurchaseProxyV3 {
  function placePurchase(
    uint256 tokenId,
    uint256 numTokens,
    uint16 perkId
  ) external;

  function purchase(
    uint256 tokenId,
    uint256 numTokens,
    uint16 perkId
  ) external;

  function depositTo(
    address buyer,
    uint256 tokenAmount,
    address tokenAddress
  ) external;

  function withdraw(uint256 amount) external;
}
