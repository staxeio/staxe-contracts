//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IProductionTokenTracker {
  function tokenTransfer(
    IERC1155 tokenContract,
    uint256 tokenId,
    address currentOwner,
    address newOwner,
    uint256 numTokens
  ) external;
}
