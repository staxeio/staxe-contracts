//SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IStaxeEventToken is IERC1155 {
  function mintEventToken(
    address owner,
    uint256 eventId,
    uint256 totalAmount
  ) external;
}
