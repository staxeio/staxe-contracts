//SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/presets/ERC1155PresetMinterPauser.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IStaxeProductionToken.sol";
import "./interfaces/IProductionTokenTracker.sol";

contract StaxeEventToken is ERC1155PresetMinterPauser, IStaxeProductionToken {
  // Not a decentralized URL, but we're not selling an NFT
  constructor() ERC1155PresetMinterPauser("https://staxe.app/api/tokens/{id}") {}

  mapping(uint256 => IProductionTokenTracker) tokenMinter; // notify token minter on token transfers if sender != tokenMinter

  function mintToken(
    IProductionTokenTracker owner,
    uint256 id,
    uint256 totalAmount
  ) external override {
    require(totalAmount > 0, "AMOUNT_ZERO");
    tokenMinter[id] = owner;
    mint(address(owner), id, totalAmount, "");
  }

  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal override {
    // TODO notify all token trackers if from is != owner address
  }
}
