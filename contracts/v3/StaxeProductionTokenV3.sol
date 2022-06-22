//SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC1155/presets/ERC1155PresetMinterPauser.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IProductionTokenV3.sol";

contract StaxeProductionTokenV3 is ERC1155PresetMinterPauser, IProductionTokenV3 {
  // Not a decentralized URL, but we're not selling an NFT
  constructor() ERC1155PresetMinterPauser("https://staxe.app/api/tokens/{id}") {}

  function mintToken(
    address owner,
    uint256 id,
    uint256 totalAmount
  ) external override {
    require(totalAmount > 0, "Must pass amount > 0");
    mint(address(owner), id, totalAmount, "");
  }
}
