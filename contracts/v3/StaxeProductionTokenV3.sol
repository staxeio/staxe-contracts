//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "./interfaces/IProductionTokenV3.sol";
import "./interfaces/IProductionTokenTrackerV3.sol";

// import "hardhat/console.sol";

/// @custom:security-contact info@staxe.io
contract StaxeProductionTokenV3 is
  Initializable,
  ERC1155Upgradeable,
  AccessControlUpgradeable,
  PausableUpgradeable,
  IProductionTokenV3
{
  using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;
  using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

  bytes32 public constant URI_SETTER_ROLE = keccak256("URI_SETTER_ROLE");
  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

  mapping(uint256 => IProductionTokenTrackerV3) private tokenMinter;
  mapping(uint256 => EnumerableSetUpgradeable.AddressSet) private tokenBuyersByToken;
  mapping(address => EnumerableSetUpgradeable.UintSet) private tokenIdsByBuyer;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize() public initializer {
    __ERC1155_init("https://staxe.app/api/v3/tokens/{id}");
    __AccessControl_init();
    __Pausable_init();

    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _grantRole(URI_SETTER_ROLE, msg.sender);
    _grantRole(PAUSER_ROLE, msg.sender);
    _grantRole(MINTER_ROLE, msg.sender);
  }

  function getTokenBalances(address buyer)
    external
    view
    returns (uint256[] memory tokenIds, uint256[] memory balances)
  {
    require(buyer != address(0), "Invalid buyer");
    tokenIds = EnumerableSetUpgradeable.values(tokenIdsByBuyer[buyer]);
    balances = new uint256[](tokenIds.length);
    for (uint256 i = 0; i < tokenIds.length; i++) {
      balances[i] = balanceOf(buyer, tokenIds[i]);
    }
  }

  function setURI(string memory newuri) public onlyRole(URI_SETTER_ROLE) {
    _setURI(newuri);
  }

  function pause() public onlyRole(PAUSER_ROLE) {
    _pause();
  }

  function unpause() public onlyRole(PAUSER_ROLE) {
    _unpause();
  }

  function mint(
    address account,
    uint256 id,
    uint256 amount,
    bytes memory data
  ) public onlyRole(MINTER_ROLE) {
    _mint(account, id, amount, data);
  }

  function mintBatch(
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) public onlyRole(MINTER_ROLE) {
    _mintBatch(to, ids, amounts, data);
  }

  function mintToken(
    IProductionTokenTrackerV3 owner,
    uint256 id,
    uint256 totalAmount
  ) external override {
    require(totalAmount > 0, "Must pass amount > 0");
    tokenMinter[id] = owner;
    mint(address(owner), id, totalAmount, "");
  }

  function _beforeTokenTransfer(
    address, /*operator*/
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory /*data*/
  ) internal override {
    for (uint256 i = 0; i < ids.length; i++) {
      uint256 amount = amounts[i];
      uint256 id = ids[i];
      EnumerableSetUpgradeable.add(tokenBuyersByToken[id], to);
      EnumerableSetUpgradeable.add(tokenIdsByBuyer[to], id);
      IProductionTokenTrackerV3 tracker = tokenMinter[id];
      if (shouldCallTokenTransferTracker(from, to, address(tracker))) {
        tracker.onTokenTransfer(this, ids[i], from, to, amount);
      }
    }
  }

  function shouldCallTokenTransferTracker(
    address from,
    address to,
    address tracker
  ) private view returns (bool) {
    return tracker != address(0) && from != address(this) && from != tracker && to != tracker;
  }

  function supportsInterface(bytes4 interfaceId)
    public
    view
    override(ERC1155Upgradeable, IERC165Upgradeable, AccessControlUpgradeable)
    returns (bool)
  {
    return super.supportsInterface(interfaceId);
  }
}
