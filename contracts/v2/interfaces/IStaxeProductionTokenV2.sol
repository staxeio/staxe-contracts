//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./IProductionTokenTrackerV2.sol";

interface IStaxeProductionTokenV2 is IERC1155 {
  function mintToken(
    IProductionTokenTrackerV2 owner,
    uint256 id,
    uint256 totalAmount
  ) external;

  function mintToken(
    address[2] memory owners,
    uint256 id,
    uint256[2] memory totalAmounts
  ) external;

  function canTransfer(
    uint256 id,
    address from,
    address to,
    uint256 amount
  ) external view returns (bool);
}
