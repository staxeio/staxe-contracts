//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";

import "./interfaces/IMembersV3.sol";

/// @custom:security-contact info@staxe.io
contract StaxeMembersV3 is AccessControlEnumerableUpgradeable, IMembersV3 {
  bytes32 public constant INVESTOR_ROLE = keccak256("INVESTOR_ROLE");
  bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
  bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

  mapping(address => address) organizerDelegate;

  // ---- Events ----

  // ---- Functions ----

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize() public initializer {
    __AccessControlEnumerable_init();
    _setupRole(AccessControlUpgradeable.DEFAULT_ADMIN_ROLE, _msgSender());
    _setupRole(INVESTOR_ROLE, _msgSender());
    _setupRole(ORGANIZER_ROLE, _msgSender());
    _setupRole(APPROVER_ROLE, _msgSender());
  }

  function isOrganizer(address sender) external view override returns (bool) {
    return hasRole(ORGANIZER_ROLE, sender) || hasRole(ORGANIZER_ROLE, organizerDelegate[sender]);
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
}
