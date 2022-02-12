//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./IProductionTokenTracker.sol";

interface IStaxeProductionToken is IERC1155 {
  function mintToken(
    IProductionTokenTracker owner,
    uint256 id,
    uint256 totalAmount
  ) external;

  function mintToken(
    address[2] memory owners,
    uint256 id,
    uint256[2] memory totalAmounts
  ) external;
}
