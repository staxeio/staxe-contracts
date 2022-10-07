//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IPurchaseProxyV3 {
  event PurchasePlaced(address indexed buyer, uint256 indexed tokenId, uint256 numTokens, uint16 perkId);
  event PurchaseExecuted(
    address indexed buyer,
    uint256 indexed tokenId,
    uint256 numTokens,
    uint16 perkId,
    address paymentToken,
    uint256 price
  );
  event Deposit(address indexed buyer, uint256 tokenAmount, address tokenAddress);

  struct Purchase {
    uint256 tokenId;
    uint256 numTokens;
    uint16 perkId;
  }

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

  function withdrawAll() external;
}
