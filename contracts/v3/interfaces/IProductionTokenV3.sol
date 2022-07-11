//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";

import "./IProductionTokenTrackerV3.sol";

interface IProductionTokenV3 is IERC1155Upgradeable {
  function mintToken(
    IProductionTokenTrackerV3 owner,
    uint256 id,
    uint256 totalAmount
  ) external;
}
