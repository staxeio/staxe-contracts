//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IMembersV3 {
  function isOrganizer(address sender) external view returns (bool);

  function isApprover(address sender) external view returns (bool);

  function isInvestor(address sender) external view returns (bool);

  function isOrganizerDelegate(address sender, address organizer) external view returns (bool);
}
