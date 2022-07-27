//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../v3/interfaces/IPerkTrackerV3.sol";

// import "hardhat/console.sol";

contract PerkTrackerTest is Ownable, IPerkTrackerV3 {
  event PerkClaimed(address claimer, uint256 productionId, uint16 perkId, uint256 tokensBought);

  function perkClaimed(
    address claimer,
    uint256 productionId,
    uint16 perkId,
    uint256 tokensBought
  ) external onlyOwner {
    emit PerkClaimed(claimer, productionId, perkId, tokensBought);
  }

  function transferOwnership(address newOwner) public override(Ownable, IPerkTrackerV3) {
    Ownable.transferOwnership(newOwner);
  }
}
