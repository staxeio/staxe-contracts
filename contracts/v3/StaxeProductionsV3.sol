//SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "./interfaces/IProductionEscrowV3.sol";

contract StaxeProductionsV3 is ERC2771ContextUpgradeable, OwnableUpgradeable {
  using Counters for Counters.Counter;

  Counters.Counter private tokenIds;
  mapping(address => bool) private trustedEscrowFactories;
  mapping(uint256 => IProductionEscrowV3) public productionEscrows;

  // ---- Events ----

  // ---- Functions ----
  constructor(address trustedForwarder) ERC2771ContextUpgradeable(trustedForwarder) {}

  // ---- Utilities ----
  function initialize(address[] memory _trustedEscrowFactories) public initializer {
    for (uint256 i = 0; i < _trustedEscrowFactories.length; i++) {
      trustedEscrowFactories[_trustedEscrowFactories[i]] = true;
    }
  }

  function addTrustedEscrowFactory(address trustedEscrowFactory) external onlyOwner {
    trustedEscrowFactories[trustedEscrowFactory] = true;
  }

  function removeTrustedEscrowFactory(address invalidAddress) external onlyOwner {
    trustedEscrowFactories[invalidAddress] = false;
  }

  function _msgSender() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (address sender) {
    return ContextUpgradeable._msgSender();
  }

  function _msgData() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (bytes calldata) {
    return ContextUpgradeable._msgData();
  }

  // ---- Lifecycle ----
  function mintProduction(IProductionEscrowV3 escrow) external {
    require(trustedEscrowFactories[_msgSender()], "Untrusted Escrow Factory");
    tokenIds.increment();
    productionEscrows[tokenIds.current()] = escrow;
  }

  function buyTokens(
    uint256 id,
    uint256 receiver,
    uint256 amount
  ) external payable {}

  function finishProduction(uint256 id) external {}
}
