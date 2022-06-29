//SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "./IProductionTokenTrackerV3.sol";

interface IProductionTokenV3 is IERC1155 {
  function mintToken(
    IProductionTokenTrackerV3 owner,
    uint256 id,
    uint256 totalAmount
  ) external;
}
