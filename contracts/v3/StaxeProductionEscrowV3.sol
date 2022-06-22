//SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

import "./interfaces/IProductionEscrowV3.sol";

contract StaxeProductionEscrowV3 is Ownable, IProductionEscrowV3, IERC1155Receiver {
  IERC1155 private tokenContract;
  ProductionData public productionData;
  uint256 public tokenPrice;
  mapping(address => uint256) public tokenPurchased;

  // funds raised
  uint256 public raisedBalance;
  uint256 public availableFunds;

  constructor(ProductionData memory _productionData, uint256 _tokenPrice) Ownable() {
    productionData = _productionData;
    tokenPrice = _tokenPrice;
  }

  // --- IProductionEscrowV3 functions ---

  function getProductionData() external view override returns (ProductionData memory) {
    return productionData;
  }

  function getTokenPrice(uint256 amount, address) external view override returns (IERC20, uint256) {
    require(amount <= productionData.totalSupply - productionData.soldCounter, "");
    return (productionData.currency, amount * tokenPrice);
  }

  function buyTokens(
    address buyer,
    uint256 amount,
    uint256 price
  ) external override onlyOwner {
    require(amount <= productionData.totalSupply - productionData.soldCounter);
    raisedBalance += price;
    tokenPurchased[buyer] += amount;
  }

  function redeemProceeds(address holder, address receiver) external override {}

  // --- IERC1155Receiver functions ---

  function onERC1155Received(
    address, /*operator*/
    address, /*from*/
    uint256 tokenId,
    uint256 amount,
    bytes calldata /*data*/
  ) external virtual override returns (bytes4) {
    require(productionData.id == 0, "Token already set");
    require(productionData.totalSupply == amount, "Wrong amount minted");
    productionData.id = tokenId;
    tokenContract = IERC1155(msg.sender);
    return this.onERC1155Received.selector;
  }

  function onERC1155BatchReceived(
    address, /*operator*/
    address, /*from*/
    uint256[] calldata, /*tokenIds*/
    uint256[] calldata, /*values*/
    bytes calldata /*data*/
  ) external virtual override returns (bytes4) {
    return 0x00; // unsupported
  }

  // ERC165 - needed from ERC1155Receiver
  function supportsInterface(bytes4 interfaceID) external view virtual override returns (bool) {
    return
      interfaceID == 0x01ffc9a7 || // ERC-165 support (i.e. `bytes4(keccak256('supportsInterface(bytes4)'))`).
      interfaceID == 0x4e2312e0; // ERC-1155 `ERC1155TokenReceiver` support (i.e. `bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)")) ^ bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))`).
  }
}
