//SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "./interfaces/IMembersV3.sol";
import "./interfaces/IProductionEscrowV3.sol";

// import "hardhat/console.sol";

contract StaxeProductionEscrowV3 is Ownable, IProductionEscrowV3, IERC1155Receiver, Pausable {
  using EnumerableSet for EnumerableSet.UintSet;
  using SafeERC20Upgradeable for IERC20Upgradeable;

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
  mapping(address => Purchase[]) private purchasesByBuyer;

  bool public refundable;

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
    require(
      isCreatorOrDelegate(caller) || (refundable && members.isApprover(caller)),
      "Can only be called from creator or delegate"
    );
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
      uint256,
      uint256
    )
  {
    return (productionData, perks, fundsRaised, proceedsEarned);
  }

  function getTokensAvailable() external view hasState(ProductionState.OPEN) returns (uint256) {
    return productionData.totalSupply - productionData.soldCounter;
  }

  function getTokenPrice(uint256 amount, address buyer) external view override returns (IERC20Upgradeable, uint256) {
    return productionData.priceCalculationEngine.calculateTokenPrice(this, productionData, tokenPrice, amount, buyer);
  }

  function getTokenOwnerData(address tokenOwner)
    external
    view
    override
    returns (
      uint256 balance,
      Purchase[] memory purchases,
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
    proceedsAvailable = productionData.soldCounter > 0
      ? ((balance * proceedsEarned) / productionData.soldCounter) - payoutPerTokenTracking[tokenOwner]
      : 0;
    return (balance, purchasesByBuyer[tokenOwner], perksOwned, proceedsClaimed, proceedsAvailable);
  }

  // ---------------------------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------------------------

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

  function finish(
    address caller,
    bool isTrustedForwarder,
    address platformTreasury
  ) external override hasState(ProductionState.OPEN) onlyOwner whenNotPaused {
    // if we have an end timestamp we can allow closing anyone (e.g. our relay with an autotask)
    // otherwise if no timestamp we hand this over to the production owner.
    require(
      (productionData.crowdsaleEndDate == 0 && isCreatorOrDelegate(caller)) ||
        (productionData.crowdsaleEndDate > 0 &&
          productionData.crowdsaleEndDate <= block.timestamp &&
          (isCreatorOrDelegate(caller) || isTrustedForwarder)),
      "Cannot be finished before finish date or only by creator"
    );
    emit StateChanged(ProductionState.OPEN, ProductionState.FINISHED, caller);
    productionData.state = ProductionState.FINISHED;
    swipeToCreator(caller, platformTreasury);
  }

  function close(
    address caller,
    bool isTrustedForwarder,
    address platformTreasury
  ) external override hasState(ProductionState.FINISHED) onlyOwner {
    // if we have an end timestamp we can allow closing anyone (e.g. our relay with an autotask)
    // otherwise if no timestamp we hand this over to the production owner.
    require(
      (productionData.productionEndDate == 0 && isCreatorOrDelegate(caller)) ||
        (productionData.productionEndDate > 0 &&
          productionData.productionEndDate <= block.timestamp &&
          (isCreatorOrDelegate(caller) || isTrustedForwarder)),
      "Cannot be closed before close date or only by creator"
    );
    emit StateChanged(ProductionState.FINISHED, ProductionState.CLOSED, caller);
    productionData.state = ProductionState.CLOSED;
    swipeToCreator(caller, platformTreasury);
  }

  function pause(address caller) external onlyOwner hasState(ProductionState.OPEN) whenNotPaused {
    require(members.isApprover(caller), "Caller must be approver");
    _pause();
  }

  function unpause(address caller) external onlyOwner hasState(ProductionState.OPEN) whenPaused {
    require(members.isApprover(caller), "Caller must be approver");
    _unpause();
  }

  function paused() public view override(Pausable, IProductionEscrowV3) onlyOwner returns (bool) {
    return Pausable.paused();
  }

  function cancel(address caller, uint256 newCloseDate) external onlyOwner hasState(ProductionState.OPEN) whenPaused {
    require(members.isApprover(caller), "Caller must be approver");
    require(newCloseDate >= block.timestamp + 30 days, "Refund period not long enough");
    emit StateChanged(ProductionState.OPEN, ProductionState.FINISHED, caller);
    productionData.state = ProductionState.FINISHED;
    productionData.productionEndDate = newCloseDate;
    refundable = true;
    IERC20Upgradeable currency = IERC20Upgradeable(productionData.currency);
    uint256 balance = currency.balanceOf(address(this));
    proceedsEarned += balance;
    _unpause();
  }

  // ---------------------------------------------------------------------------------------------
  // Tokens, funds and proceeds
  // ---------------------------------------------------------------------------------------------

  function buyTokens(
    address buyer,
    uint256 amount,
    uint256 price,
    uint16 perkId
  ) external override hasState(ProductionState.OPEN) whenNotPaused onlyOwner {
    require(amount <= productionData.totalSupply - productionData.soldCounter, "Not enough tokens available");
    require(
      members.isInvestor(buyer) ||
        amount <= productionData.maxTokensUnknownBuyer ||
        productionData.maxTokensUnknownBuyer == 0,
      "Needs investor role to buy amount of tokens"
    );
    claimPerk(buyer, amount, perkId);
    fundsRaised += price;
    emit TokenBought(buyer, amount, price, perkId);
    productionData.soldCounter += amount;
    tokenContract.safeTransferFrom(address(this), buyer, productionData.id, amount, "");
    purchasesByBuyer[buyer].push(Purchase(amount, price));
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
    require(members.isInvestor(holder), "Only investors can claim proceeds");
    uint256 tokens = tokenContract.balanceOf(holder, productionData.id);
    payout = ((tokens * proceedsEarned) / productionData.soldCounter) - payoutPerTokenTracking[holder];
    payoutPerTokenHolder[holder] += payout;
    payoutPerTokenTracking[holder] += payout;
    if (payout > 0) {
      emit ProceedsClaimed(payout, holder);
      IERC20Upgradeable token = IERC20Upgradeable(productionData.currency);
      token.safeTransfer(holder, payout);
    }
  }

  function transferFunding(address caller, address platformTreasury)
    external
    override
    hasState(ProductionState.OPEN)
    creatorOnly(caller)
    onlyOwner
    whenNotPaused
    returns (uint256 amount, uint256 platformShare)
  {
    (amount, platformShare) = swipeToCreator(caller, platformTreasury);
  }

  // ---------------------------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------------------------

  function onTokenTransfer(
    IERC1155Upgradeable, /* tokenContract */
    uint256 tokenId,
    address currentOwner,
    address newOwner,
    uint256 numTokens
  ) external override {
    require(msg.sender == address(tokenContract), "Unknown token contract sender");
    require(tokenId == productionData.id, "Invalid token id");
    require(numTokens > 0, "Tokens to transfer must be > 0");
    uint256 currentBalance = tokenContract.balanceOf(currentOwner, productionData.id);
    require(currentBalance >= numTokens, "Insufficient balance for transfer");
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
    if (productionData.organizerTokens > 0) {
      tokenContract.safeTransferFrom(
        address(this),
        productionData.creator,
        tokenId,
        productionData.organizerTokens,
        bytes("")
      );
      productionData.soldCounter += productionData.organizerTokens;
    }
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

  // ---------------------------------------------------------------------------------------------
  // private
  // ---------------------------------------------------------------------------------------------

  function swipeToCreator(address caller, address platformTreasury)
    private
    returns (uint256 balanceLeft, uint256 platformShare)
  {
    IERC20Upgradeable currency = IERC20Upgradeable(productionData.currency);
    uint256 balance = currency.balanceOf(address(this));
    platformShare = (balance * productionData.platformSharePercentage) / 100;
    balanceLeft = balance - platformShare;
    emit FundingClaimed(balanceLeft, platformShare, caller);
    currency.safeTransfer(productionData.creator, balanceLeft);
    currency.safeTransfer(platformTreasury, platformShare);
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
    if (address(productionData.perkTracker) != address(0)) {
      productionData.perkTracker.perkClaimed(buyer, productionData.id, perkId, tokensBought);
    }
  }

  function countIds(uint16 perkId, uint16[] memory perkIds) private pure returns (uint16 result) {
    for (uint16 i = 0; i < perkIds.length; i++) {
      if (perkIds[i] == perkId) {
        result += 1;
      }
    }
  }
}
