//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./interfaces/IProductionsV3.sol";
import "./interfaces/IProductionEscrowV3.sol";

/// @custom:security-contact info@staxe.io
contract TransakOnePurchaseProxy is OwnableUpgradeable, ERC2771ContextUpgradeable {
  struct Purchase {
    uint256 tokenId;
    uint256 numTokens;
    uint16 perkId;
  }

  using SafeERC20Upgradeable for IERC20Upgradeable;

  IProductionsV3 private productions;
  mapping(address => Purchase) private purchases;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address _trustedForwarder) ERC2771ContextUpgradeable(_trustedForwarder) {
    _disableInitializers();
  }

  function initialize(IProductionsV3 _productions) public initializer {
    __Ownable_init();
    productions = _productions;
  }

  // ---- Functions ----

  function placePurchase(
    address buyer,
    uint256 tokenId,
    uint256 numTokens,
    uint16 perkId
  ) external {
    require(isTrustedForwarder(_msgSender()), "Must be called by forwarder");
    require(
      productions.getProduction(tokenId).data.state != IProductionEscrowV3.ProductionState.EMPTY,
      "Production does not exist"
    );
    require(buyer != address(0), "Invalid buyer");
    require(numTokens != 0, "Invalid token number to buy");
    purchases[buyer] = Purchase({tokenId: tokenId, numTokens: numTokens, perkId: perkId});
  }

  function depositTo(
    address buyer,
    uint256 tokenAmount,
    address tokenAddress
  ) external {
    require(purchases[buyer].tokenId != 0, "No purchase exists");
    IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
    token.safeTransferFrom(buyer, address(this), tokenAmount);
    token.safeApprove(address(productions), tokenAmount);
    productions.buyTokensWithTokens(
      purchases[buyer].tokenId,
      buyer,
      purchases[buyer].numTokens,
      purchases[buyer].perkId
    );
  }

  // ---- Internal ----

  function _msgSender() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (address sender) {
    return ERC2771ContextUpgradeable._msgSender();
  }

  function _msgData() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (bytes calldata) {
    return ERC2771ContextUpgradeable._msgData();
  }
}
