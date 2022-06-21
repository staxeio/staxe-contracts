//SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IStaxeProductionTokenV3 is IERC1155 {
  function mintToken(
    address owner,
    uint256 id,
    uint256 totalAmount
  ) external;
}
