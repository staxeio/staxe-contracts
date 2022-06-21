//SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;

interface IStaxeProductionsV3 {
  event ProductionCreated(uint256 indexed id, address indexed creator, uint256 tokenSupply, address escrow);
}
