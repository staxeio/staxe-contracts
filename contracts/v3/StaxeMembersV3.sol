//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";

import "./interfaces/IMembersV3.sol";

/// @custom:security-contact info@staxe.io
contract StaxeMembersV3 is AccessControlEnumerableUpgradeable, ERC2771ContextUpgradeable, IMembersV3 {
  bytes32 public constant INVESTOR_ROLE = keccak256("INVESTOR_ROLE");
  bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
  bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

  mapping(address => address) organizerDelegate;
  address private immutable trustedForwarder;

  // ---- Events ----

  // ---- Functions ----

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(address _trustedForwarder) ERC2771ContextUpgradeable(_trustedForwarder) {
    _disableInitializers();
    trustedForwarder = _trustedForwarder;
  }

  function initialize(address treasury) public initializer {
    __AccessControlEnumerable_init();
    _setupRole(AccessControlUpgradeable.DEFAULT_ADMIN_ROLE, _msgSender());
    _setupRole(INVESTOR_ROLE, _msgSender());
    _setupRole(ORGANIZER_ROLE, _msgSender());
    _setupRole(APPROVER_ROLE, _msgSender());
    _grantRole(INVESTOR_ROLE, trustedForwarder);
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
    require(isTrustedForwarder(_msgSender()), "Can only be called from trusted forwarder");
    _grantRole(INVESTOR_ROLE, investor);
  }

  // ---- Internal ----

  function _msgSender() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (address sender) {
    return ContextUpgradeable._msgSender();
  }

  function _msgData() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (bytes calldata) {
    return ContextUpgradeable._msgData();
  }
}
