//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

interface IStaxeMembers {
  function isOrganizer(address sender) external view returns (bool);

  function isApprover(address sender) external view returns (bool);

  function isInvestor(address sender) external view returns (bool);

  function isDaoMember(address sender) external view returns (bool);
}
