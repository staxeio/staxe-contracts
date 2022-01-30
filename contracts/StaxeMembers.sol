//SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "./interfaces/IStaxeMembers.sol";

contract StaxeMembers is IStaxeMembers, AccessControlEnumerable {
  bytes32 public constant INVESTOR_ROLE = keccak256("INVESTOR_ROLE");
  bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
  bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

  constructor() {
    _setupRole(AccessControl.DEFAULT_ADMIN_ROLE, msg.sender);
    _setupRole(INVESTOR_ROLE, msg.sender);
    _setupRole(ORGANIZER_ROLE, msg.sender);
    _setupRole(APPROVER_ROLE, msg.sender);
  }

  function isOrganizer(address sender) external view returns (bool) {
    return hasRole(ORGANIZER_ROLE, sender);
  }

  function isApprover(address sender) external view returns (bool) {
    return hasRole(APPROVER_ROLE, sender);
  }

  function isInvestor(address sender) external view returns (bool) {
    return hasRole(INVESTOR_ROLE, sender);
  }
}
