//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

import "../v3/interfaces/IPerkTrackerV3.sol";

// import "hardhat/console.sol";

contract PerkTrackerTest is IPerkTrackerV3 {
  event PerkClaimed(address claimer, uint256 productionId, uint16 perkId, uint256 tokensBought);

  IProductionEscrowV3 private escrow;
  address private productionFactory;

  constructor(address _productionFactory) {
    productionFactory = _productionFactory;
  }

  function perkClaimed(
    address claimer,
    uint256 productionId,
    uint16 perkId,
    uint256 tokensBought
  ) external override {
    require(msg.sender == address(escrow), "Can only be called by registered escrow");
    emit PerkClaimed(claimer, productionId, perkId, tokensBought);
  }

  function registerEscrow(IProductionEscrowV3 _escrow) external override {
    require(msg.sender == productionFactory, "Can only be set by production factory");
    require(address(escrow) == address(0), "Escrow already registered");
    escrow = _escrow;
  }
}
