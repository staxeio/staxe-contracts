//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./IProductionEscrowV3.sol";

interface IPerkTrackerV3 {
  function perkClaimed(
    address claimer,
    uint256 productionId,
    uint16 perkId,
    uint256 tokensBought
  ) external;

  function registerEscrow(IProductionEscrowV3 escrow) external;
}
