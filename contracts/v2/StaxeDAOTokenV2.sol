// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract StaxeDAOTokenV2 is ERC20, ERC20Permit, Ownable {
  using Counters for Counters.Counter;
  mapping(address => mapping(uint256 => uint256)) public claimed;
  bytes32 public merkleRoot;
  uint256 public claimPeriodEnds;
  address public treasury;
  Counters.Counter public airdropCounter;

  event AirdropCreated(bytes32 merkleRoot, uint256 airdropCounter, uint256 claimPeriodEnds);
  event TokenClaimed(address indexed claimer, uint256 amount, uint256 airdropCounter);

  constructor(
    address _treasury,
    uint256 treasurySupply,
    uint256 airdropSupply
  ) ERC20("Staxe DAO", "STX") ERC20Permit("Staxe DAO") Ownable() {
    _mint(_treasury, treasurySupply * (10**18));
    _mint(address(this), airdropSupply * (10**18));
    treasury = _treasury;
  }

  function claimTokens(uint256 amount, bytes32[] calldata merkleProof) external {
    require(merkleRoot != bytes32(0), "STX_MERKLE_ROOT_NOT_SET");
    bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
    bool valid = MerkleProof.verify(merkleProof, merkleRoot, leaf);
    require(valid, "STX_MERKLE_PROOF_INVALID");
    require(claimed[msg.sender][airdropCounter.current()] == 0, "STX_ALREADY_CLAIMED");
    claimed[msg.sender][airdropCounter.current()] = amount;
    emit TokenClaimed(msg.sender, amount, airdropCounter.current());
    _transfer(address(this), msg.sender, amount);
  }

  function newAirdrop(bytes32 _merkleRoot, uint256 _claimPeriodEnds) external onlyOwner {
    require(claimPeriodEnds == 0 || block.timestamp > claimPeriodEnds, "STX_CLAIM_PERIOD_NOT_ENDED");
    merkleRoot = _merkleRoot;
    claimPeriodEnds = _claimPeriodEnds;
    airdropCounter.increment();
    emit AirdropCreated(merkleRoot, airdropCounter.current(), claimPeriodEnds);
  }

  function sweepUnclaimedTokens() external onlyOwner {
    require(block.timestamp > claimPeriodEnds, "STX_CLAIM_PERIOD_NOT_ENDED");
    _transfer(address(this), treasury, balanceOf(address(this)));
  }

  function mintForAirdrop(uint256 additionalSupply) external onlyOwner {
    _mint(address(this), additionalSupply * (10**18));
  }

  function mintForTreasury(uint256 additionalSupply) external onlyOwner {
    _mint(treasury, additionalSupply * (10**18));
  }
}
