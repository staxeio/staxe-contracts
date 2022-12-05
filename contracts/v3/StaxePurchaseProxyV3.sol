//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./interfaces/IProductionsV3.sol";
import "./interfaces/IProductionEscrowV3.sol";
import "./interfaces/IPurchaseProxyV3.sol";

// import "hardhat/console.sol";

/// @custom:security-contact info@staxe.io
contract StaxePurchaseProxyV3 is
  IPurchaseProxyV3,
  ERC20Upgradeable,
  ERC2771ContextUpgradeable,
  OwnableUpgradeable,
  PausableUpgradeable,
  ReentrancyGuardUpgradeable
{
  using SafeERC20Upgradeable for IERC20Upgradeable;

  IProductionsV3 private productions;
  IERC20Upgradeable private wrappedToken;
  mapping(address => Purchase) private purchases;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address _trustedForwarder) ERC2771ContextUpgradeable(_trustedForwarder) {
    _disableInitializers();
  }

  function initialize(IProductionsV3 _productions, IERC20Upgradeable _wrappedToken) public initializer {
    __Ownable_init();
    __ERC20_init("Staxe Wrapper Tokens", "WSTX");
    __Pausable_init();
    __ReentrancyGuard_init();
    productions = _productions;
    wrappedToken = _wrappedToken;
  }

  // ---- Functions ----

  function decimals() public view override returns (uint8) {
    return IERC20MetadataUpgradeable(address(wrappedToken)).decimals();
  }

  function placePurchase(
    uint256 tokenId,
    uint256 numTokens,
    uint16 perkId
  ) external override nonReentrant whenNotPaused {
    require(
      productions.getProduction(tokenId).data.state == IProductionEscrowV3.ProductionState.OPEN,
      "Proudction not open for token sales"
    );
    require(numTokens != 0, "Invalid token number to buy");
    emit PurchasePlaced(_msgSender(), tokenId, numTokens, perkId);
    purchases[_msgSender()] = Purchase({tokenId: tokenId, numTokens: numTokens, perkId: perkId});
  }

  function purchase(
    uint256 tokenId,
    uint256 numTokens,
    uint16 perkId
  ) external override nonReentrant whenNotPaused {
    require(
      productions.getProduction(tokenId).data.state == IProductionEscrowV3.ProductionState.OPEN,
      "Proudction not open for token sales"
    );
    require(numTokens != 0, "Invalid token number to buy");
    _purchase(_msgSender(), tokenId, numTokens, perkId, true);
  }

  function depositTo(
    address buyer,
    uint256 tokenAmount,
    address tokenAddress
  ) external override nonReentrant whenNotPaused {
    require(tokenAddress == address(wrappedToken), "Invalid token sent");
    IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
    token.safeTransferFrom(_msgSender(), address(this), tokenAmount);
    _mint(buyer, tokenAmount);
    if (purchases[buyer].tokenId != 0) {
      bool result = _purchase(
        buyer,
        purchases[buyer].tokenId,
        purchases[buyer].numTokens,
        purchases[buyer].perkId,
        false
      );
      if (result) {
        purchases[buyer].tokenId = 0;
      }
    }
  }

  function withdraw(uint256 amount) external override nonReentrant whenNotPaused {
    require(amount > 0, "Amount must be > 0");
    require(balanceOf(_msgSender()) >= amount, "Balance not high enough");
    _burn(_msgSender(), amount);
    wrappedToken.safeTransfer(_msgSender(), amount);
  }

  function withdrawAll() external override nonReentrant whenNotPaused {
    uint256 balance = balanceOf(_msgSender());
    require(balance > 0, "Nothing to withdraw");
    _burn(_msgSender(), balance);
    wrappedToken.safeTransfer(_msgSender(), balance);
  }

  // ---- Admin ----

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }

  // ---- Internal ----

  function _purchase(
    address buyer,
    uint256 tokenId,
    uint256 numTokens,
    uint16 perkId,
    bool requireSufficientBalance
  ) internal returns (bool) {
    (IERC20Upgradeable productionCurrency, uint256 price) = productions.getTokenPriceFor(tokenId, numTokens, buyer);
    require(address(productionCurrency) == address(wrappedToken), "Invalid payment currency");
    require(!requireSufficientBalance || balanceOf(buyer) >= price, "Balance too low");
    if (balanceOf(buyer) >= price) {
      emit PurchaseExecuted(buyer, tokenId, numTokens, perkId, address(productionCurrency), price);
      _burn(buyer, price);
      wrappedToken.safeApprove(address(productions), price);
      productions.buyTokensWithTokens(tokenId, buyer, numTokens, perkId);
      return true;
    }
    return false;
  }

  function _msgSender() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (address sender) {
    return ERC2771ContextUpgradeable._msgSender();
  }

  function _msgData() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (bytes calldata) {
    return ERC2771ContextUpgradeable._msgData();
  }
}
