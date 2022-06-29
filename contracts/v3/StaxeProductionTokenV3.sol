//SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC1155/presets/ERC1155PresetMinterPauser.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./interfaces/IProductionTokenV3.sol";
import "./interfaces/IProductionTokenTrackerV3.sol";

contract StaxeProductionTokenV3 is ERC1155PresetMinterPauser, IProductionTokenV3 {
  mapping(uint256 => IProductionTokenTrackerV3) tokenMinter;

  // Not a decentralized URL, but we're not selling an NFT
  constructor() ERC1155PresetMinterPauser("https://staxe.app/api/tokens/{id}") {}

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
      IProductionTokenTrackerV3 tracker = tokenMinter[ids[i]];
      if (shouldCallTokenTransferTracker(from, to, address(tracker))) {
        tracker.onTokenTransfer(this, ids[i], from, to, amounts[i]);
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
}
