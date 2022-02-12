//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/presets/ERC1155PresetMinterPauser.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IStaxeProductionToken.sol";
import "./interfaces/IProductionTokenTracker.sol";

contract StaxeProductionToken is ERC1155PresetMinterPauser, IStaxeProductionToken {
  mapping(uint256 => IProductionTokenTracker) tokenMinter; // notify token minter on token transfers if sender != tokenMinter

  // Not a decentralized URL, but we're not selling an NFT
  constructor() ERC1155PresetMinterPauser("https://staxe.app/api/tokens/{id}") {}

  function mintToken(
    IProductionTokenTracker owner,
    uint256 id,
    uint256 totalAmount
  ) external override {
    require(totalAmount > 0, "AMOUNT_ZERO");
    tokenMinter[id] = owner;
    mint(address(owner), id, totalAmount, "");
  }

  function mintToken(
    address[2] memory owners,
    uint256 id,
    uint256[2] memory totalAmounts
  ) external override {
    if (totalAmounts[0] > 0) {
      mint(owners[0], id, totalAmounts[0], "");
    }
    if (totalAmounts[1] > 0) {
      mint(owners[1], id, totalAmounts[1], "");
    }
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
      IProductionTokenTracker tracker = tokenMinter[ids[i]];
      tracker.tokenTransfer(this, ids[i], from, to, amounts[i]);
    }
  }
}
