//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";

import "./interfaces/IMembersV3.sol";

// import "hardhat/console.sol";

/// @custom:security-contact info@staxe.io
contract StaxeMembersV3 is AccessControlEnumerableUpgradeable, IMembersV3 {
  bytes32 public constant INVESTOR_ROLE = keccak256("INVESTOR_ROLE");
  bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
  bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

  mapping(address => address) organizerDelegate;
  address private relayer;

  // ---- Events ----

  // ---- Functions ----

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address treasury, address _relayer) public initializer {
    __AccessControlEnumerable_init();
    relayer = _relayer;
    _setupRole(AccessControlUpgradeable.DEFAULT_ADMIN_ROLE, msg.sender);
    _setupRole(INVESTOR_ROLE, _msgSender());
    _setupRole(ORGANIZER_ROLE, _msgSender());
    _setupRole(APPROVER_ROLE, _msgSender());
    _grantRole(AccessControlUpgradeable.DEFAULT_ADMIN_ROLE, relayer);
    _grantRole(AccessControlUpgradeable.DEFAULT_ADMIN_ROLE, treasury);
  }

  function isOrganizer(address sender) external view override returns (bool) {
    return hasRole(ORGANIZER_ROLE, sender);
  }

  function isApprover(address sender) external view override returns (bool) {
    return hasRole(APPROVER_ROLE, sender);
  }

  function isInvestor(address sender) external view override returns (bool) {
    return hasRole(INVESTOR_ROLE, sender);
  }

  function isOrganizerDelegate(address sender, address organizer) external view override returns (bool) {
    return hasRole(ORGANIZER_ROLE, organizer) && (sender == organizer || organizerDelegate[sender] == organizer);
  }

  function addDelegate(address delegate) external onlyRole(ORGANIZER_ROLE) {
    require(organizerDelegate[delegate] == address(0), "Delegate already added");
    organizerDelegate[delegate] = _msgSender();
  }

  function removeDelegate(address delegate) external onlyRole(ORGANIZER_ROLE) {
    require(organizerDelegate[delegate] == _msgSender(), "Cannot remove delegate from someone else");
    organizerDelegate[delegate] = address(0);
  }

  function registerInvestor(address investor) external {
    require(relayer == msg.sender, "Can only be called from trusted relayer");
    _grantRole(INVESTOR_ROLE, investor);
  }
}
