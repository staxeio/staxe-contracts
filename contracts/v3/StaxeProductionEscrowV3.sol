//SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

import "./interfaces/IMembersV3.sol";
import "./interfaces/IProductionEscrowV3.sol";

contract StaxeProductionEscrowV3 is Ownable, IProductionEscrowV3, IERC1155Receiver {
  ProductionData public productionData;
  uint256 public immutable tokenPrice;
  IMembersV3 public immutable members;

  Perk[] public perks;
  mapping(uint16 => address[]) public perkOwners;
  mapping(address => uint16[]) public perksByOwner;

  IERC1155 private tokenContract;

  // funds raised
  uint256 public raisedBalance;
  uint256 public availableFunds;

  constructor(
    ProductionData memory _productionData,
    Perk[] memory _perks,
    uint256 _tokenPrice,
    IMembersV3 _members
  ) Ownable() {
    productionData = _productionData;
    for (uint16 i = 0; i < _perks.length; i++) {
      perks.push(_perks[i]);
    }
    tokenPrice = _tokenPrice;
    members = _members;
  }

  modifier hasState(ProductionState state) {
    require(productionData.state == state, "Not in required state");
    _;
  }

  modifier creatorOnly(address caller) {
    require(isCreatorOrDelegate(caller), "Can only be called from creator or delegate");
    _;
  }

  // --- IProductionEscrowV3 functions ---

  function getProductionData() external view override returns (ProductionData memory) {
    return productionData;
  }

  function getProductionDataWithPerks() external view override returns (ProductionData memory, Perk[] memory) {
    return (productionData, perks);
  }

  function getTokensAvailable() external view hasState(ProductionState.OPEN) returns (uint256) {
    return productionData.totalSupply - productionData.soldCounter;
  }

  function getTokenPrice(uint256 amount, address) external view override returns (IERC20, uint256) {
    require(amount <= productionData.totalSupply - productionData.soldCounter, "");
    return (productionData.currency, amount * tokenPrice);
  }

  function getTokenOwnerData(address tokenOwner)
    external
    view
    override
    returns (uint256 balance, Perk[] memory perksOwned)
  {
    balance = tokenContract.balanceOf(tokenOwner, productionData.id);
    uint16[] memory ids = perksByOwner[tokenOwner];
    perksOwned = new Perk[](ids.length);
    for (uint16 i = 0; i < ids.length; i++) {
      uint16 id = ids[i];
      Perk memory perk = _idToPerk(id);
      perksOwned[i] = Perk({id: id, total: perk.total, claimed: 1, minTokensRequired: perk.minTokensRequired});
    }
    return (balance, perksOwned);
  }

  function approve(address approver) external override hasState(ProductionState.CREATED) onlyOwner {
    require(members.isApprover(approver));
    productionData.state = ProductionState.OPEN;
  }

  function decline(address decliner) external override hasState(ProductionState.CREATED) onlyOwner {
    require(members.isApprover(decliner));
    productionData.state = ProductionState.DECLINED;
  }

  function finish(address caller) external override hasState(ProductionState.OPEN) onlyOwner {
    // if we have an end timestamp we can allow closing anyone (e.g. our relay with an autotask)
    // otherwise if no timestamp we hand this over to the production owner.
    require(
      (productionData.crowdsaleEndDate == 0 && isCreatorOrDelegate(caller)) ||
        productionData.crowdsaleEndDate >= block.timestamp,
      "Cannot be finished before date or only be creator"
    );
    productionData.state = ProductionState.FINISHED;
  }

  function close(address caller) external override hasState(ProductionState.FINISHED) onlyOwner {
    // if we have an end timestamp we can allow closing anyone (e.g. our relay with an autotask)
    // otherwise if no timestamp we hand this over to the production owner.
    require(
      (productionData.productionEndDate == 0 && isCreatorOrDelegate(caller)) ||
        productionData.productionEndDate >= block.timestamp,
      "Cannot be closed before date or only be creator"
    );
    productionData.state = ProductionState.CLOSED;
  }

  function swipe(address caller) external override hasState(ProductionState.CLOSED) onlyOwner creatorOnly(caller) {
    IERC20 currency = IERC20(productionData.currency);
    uint256 balanceLeft = currency.balanceOf(address(this));
    currency.transfer(productionData.creator, balanceLeft);
  }

  function buyTokens(
    address buyer,
    uint256 amount,
    uint256 price,
    uint16 perkId
  ) external override hasState(ProductionState.OPEN) onlyOwner {
    require(amount <= productionData.totalSupply - productionData.soldCounter);
    _claimPerk(buyer, amount, perkId);
    raisedBalance += price;
    // raise event
    productionData.soldCounter += amount;
    tokenContract.safeTransferFrom(address(this), buyer, productionData.id, amount, "");
  }

  function transferProceeds(address holder) external override onlyOwner {}

  function transferFunding() external override onlyOwner {}

  // --- IERC1155Receiver functions ---

  function onERC1155Received(
    address, /*operator*/
    address, /*from*/
    uint256 tokenId,
    uint256 amount,
    bytes calldata /*data*/
  ) external virtual override hasState(ProductionState.CREATED) returns (bytes4) {
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

  function isCreatorOrDelegate(address caller) private view returns (bool) {
    return productionData.creator == caller || members.isOrganizerDelegate(caller, productionData.creator);
  }

  function _claimPerk(
    address buyer,
    uint256 tokensBought,
    uint16 perkId
  ) internal {
    if (perkId == 0) {
      return;
    }
    Perk memory perk;
    for (uint16 i = 0; i < perks.length; i++) {
      if (perks[i].id == perkId) {
        perk = perks[i];
        break;
      }
    }
    require(perk.id != 0, "Invalid perkId");
    require(perk.total > perk.claimed, "Perk not available");
    require(perk.minTokensRequired <= tokensBought, "Not enough tokens to claim");
    perk.claimed += 1;
    perkOwners[perkId].push(buyer);
    perksByOwner[buyer].push(perkId);
  }

  function _idToPerk(uint16 perkId) internal view returns (Perk memory result) {
    for (uint16 i = 0; i < perks.length; i++) {
      if (perks[i].id == perkId) {
        result = perks[i];
        break;
      }
    }
  }
}
