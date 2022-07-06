//SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "./interfaces/IMembersV3.sol";
import "./interfaces/IProductionEscrowV3.sol";

// import "hardhat/console.sol";

contract StaxeProductionEscrowV3 is Ownable, IProductionEscrowV3, IERC1155Receiver {
  using EnumerableSet for EnumerableSet.UintSet;

  // --- Data ---

  ProductionData public productionData;
  uint256 public immutable tokenPrice;
  IMembersV3 public immutable members;

  Perk[] public perks;
  mapping(address => uint16[]) public perksByOwner;
  mapping(address => EnumerableSet.UintSet) private perkSetByOwner;

  IERC1155Upgradeable private tokenContract;

  uint256 public fundsRaised;
  uint256 public proceedsEarned;
  mapping(address => uint256) payoutPerTokenHolder;
  mapping(address => uint256) private payoutPerTokenTracking;

  // --- Functions ---

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

  function getProductionDataWithPerks()
    external
    view
    override
    returns (
      ProductionData memory,
      Perk[] memory,
      uint256
    )
  {
    return (productionData, perks, fundsRaised);
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
    returns (
      uint256 balance,
      Perk[] memory perksOwned,
      uint256 proceedsClaimed,
      uint256 proceedsAvailable
    )
  {
    balance = tokenContract.balanceOf(tokenOwner, productionData.id);
    uint16[] memory ids = perksByOwner[tokenOwner];
    uint256[] memory values = EnumerableSet.values(perkSetByOwner[tokenOwner]);
    perksOwned = new Perk[](values.length);
    for (uint16 i = 0; i < values.length; i++) {
      uint16 id = uint16(values[i]);
      Perk memory perk = perks[id - 1];
      uint16 count = countIds(id, ids);
      perksOwned[i] = Perk({id: id, total: perk.total, claimed: count, minTokensRequired: perk.minTokensRequired});
    }
    proceedsClaimed = payoutPerTokenHolder[tokenOwner];
    proceedsAvailable = ((balance * proceedsEarned) / productionData.soldCounter) - payoutPerTokenTracking[tokenOwner];
    return (balance, perksOwned, proceedsClaimed, proceedsAvailable);
  }

  function approve(address approver) external override hasState(ProductionState.CREATED) onlyOwner {
    require(members.isApprover(approver));
    emit StateChanged(ProductionState.CREATED, ProductionState.OPEN, approver);
    productionData.state = ProductionState.OPEN;
  }

  function decline(address decliner) external override hasState(ProductionState.CREATED) onlyOwner {
    require(members.isApprover(decliner));
    emit StateChanged(ProductionState.CREATED, ProductionState.DECLINED, decliner);
    productionData.state = ProductionState.DECLINED;
  }

  function finish(address caller, address platformTreasury) external override hasState(ProductionState.OPEN) onlyOwner {
    // if we have an end timestamp we can allow closing anyone (e.g. our relay with an autotask)
    // otherwise if no timestamp we hand this over to the production owner.
    require(
      (productionData.crowdsaleEndDate == 0 && isCreatorOrDelegate(caller)) ||
        productionData.crowdsaleEndDate >= block.timestamp,
      "Cannot be finished before date or only by creator"
    );
    emit StateChanged(ProductionState.OPEN, ProductionState.FINISHED, caller);
    productionData.state = ProductionState.FINISHED;
    swipeToCreator(caller, platformTreasury);
  }

  function close(address caller, address platformTreasury)
    external
    override
    hasState(ProductionState.FINISHED)
    onlyOwner
  {
    // if we have an end timestamp we can allow closing anyone (e.g. our relay with an autotask)
    // otherwise if no timestamp we hand this over to the production owner.
    require(
      (productionData.productionEndDate == 0 && isCreatorOrDelegate(caller)) ||
        productionData.productionEndDate >= block.timestamp,
      "Cannot be closed before date or only by creator"
    );
    emit StateChanged(ProductionState.FINISHED, ProductionState.CLOSED, caller);
    productionData.state = ProductionState.CLOSED;
    swipeToCreator(caller, platformTreasury);
  }

  function buyTokens(
    address buyer,
    uint256 amount,
    uint256 price,
    uint16 perkId
  ) external override hasState(ProductionState.OPEN) onlyOwner {
    require(amount <= productionData.totalSupply - productionData.soldCounter);
    claimPerk(buyer, amount, perkId);
    fundsRaised += price;
    emit TokenBought(buyer, amount, price, perkId);
    productionData.soldCounter += amount;
    tokenContract.safeTransferFrom(address(this), buyer, productionData.id, amount, "");
  }

  function depositProceeds(address caller, uint256 amount)
    external
    override
    hasState(ProductionState.FINISHED)
    creatorOnly(caller)
    onlyOwner
  {
    emit ProceedsDeposited(amount, caller);
    proceedsEarned += amount;
  }

  function transferProceeds(address holder)
    external
    override
    hasState(ProductionState.FINISHED)
    onlyOwner
    returns (uint256 payout)
  {
    uint256 proceedsPerToken = proceedsEarned / productionData.soldCounter;
    uint256 tokens = tokenContract.balanceOf(holder, productionData.id);
    payout = (proceedsPerToken * tokens) - payoutPerTokenTracking[holder];
    payoutPerTokenHolder[holder] += payout;
    payoutPerTokenTracking[holder] += payout;
    if (payout > 0) {
      emit ProceedsClaimed(payout, holder);
      IERC20(productionData.currency).transfer(holder, payout);
    }
  }

  function transferFunding(address caller, address platformTreasury)
    external
    override
    hasState(ProductionState.OPEN)
    creatorOnly(caller)
    onlyOwner
    returns (uint256 amount, uint256 platformShare)
  {
    (amount, platformShare) = swipeToCreator(caller, platformTreasury);
  }

  // --- Callback functions ---

  function onTokenTransfer(
    IERC1155Upgradeable, /* tokenContract */
    uint256 tokenId,
    address currentOwner,
    address newOwner,
    uint256 numTokens
  ) external override {
    require(msg.sender == address(tokenContract), "Unknown token contract sender");
    require(tokenId == productionData.id, "Invalid token id");
    uint256 currentBalance = tokenContract.balanceOf(currentOwner, productionData.id);
    uint256 payoutTransfer = (numTokens * payoutPerTokenTracking[currentOwner]) / currentBalance;
    payoutPerTokenTracking[currentOwner] -= payoutTransfer;
    payoutPerTokenTracking[newOwner] += payoutTransfer;
  }

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
    tokenContract = IERC1155Upgradeable(msg.sender);
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

  // --- Private ---

  function swipeToCreator(address caller, address platformTreasury)
    private
    returns (uint256 balanceLeft, uint256 platformShare)
  {
    IERC20 currency = IERC20(productionData.currency);
    uint256 balance = currency.balanceOf(address(this));
    platformShare = (balance * productionData.platformSharePercentage) / 100;
    balanceLeft = balance - platformShare;
    emit FundingClaimed(balanceLeft, platformShare, caller);
    currency.transfer(productionData.creator, balanceLeft);
    currency.transfer(platformTreasury, platformShare);
  }

  function isCreatorOrDelegate(address caller) private view returns (bool) {
    return productionData.creator == caller || members.isOrganizerDelegate(caller, productionData.creator);
  }

  function claimPerk(
    address buyer,
    uint256 tokensBought,
    uint16 perkId
  ) internal {
    if (perkId == 0) {
      return;
    }
    require(perkId <= perks.length, "Invalid perkId");
    Perk storage perk = perks[perkId - 1];
    require(perk.total > perk.claimed, "Perk not available");
    require(perk.minTokensRequired <= tokensBought, "Not enough tokens to claim");
    perk.claimed += 1;
    perksByOwner[buyer].push(perkId);
    EnumerableSet.add(perkSetByOwner[buyer], perkId);
  }

  function countIds(uint16 perkId, uint16[] memory perkIds) private pure returns (uint16 result) {
    for (uint16 i = 0; i < perkIds.length; i++) {
      if (perkIds[i] == perkId) {
        result += 1;
      }
    }
  }
}
