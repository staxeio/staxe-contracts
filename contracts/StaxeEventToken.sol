//SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC1155/presets/ERC1155PresetMinterPauser.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IStaxeEventToken.sol";

contract StaxeEventToken is ERC1155PresetMinterPauser, IStaxeEventToken {
  constructor() ERC1155PresetMinterPauser("https://staxe.app/api/tokens/{id}") {}

  function mintEventToken(
    address owner,
    uint256 eventId,
    uint256 totalAmount
  ) external override {
    require(totalAmount > 0, "AMOUNT_ZERO");
    mint(owner, eventId, totalAmount, "");
  }
}
