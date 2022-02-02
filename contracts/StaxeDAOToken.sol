// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract StaxeDAOToken is ERC20, ERC20Permit, Ownable {
  mapping(address => uint256) public claimed;
  bytes32 public merkleRoot;
  uint256 public claimPeriodEnds;
  address public treasury;

  event MerkleRootChanged(bytes32 merkleRoot);
  event TokenClaimed(address indexed claimer, uint256 amount);

  constructor(
    address _treasury,
    uint256 treasurySupply,
    uint256 airdropSupply,
    uint256 _claimPeriodEnds
  ) ERC20("Staxe DAO", "STX") ERC20Permit("Staxe DAO") {
    _mint(_treasury, treasurySupply * (10**18));
    _mint(address(this), airdropSupply * (10**18));
    treasury = _treasury;
    claimPeriodEnds = _claimPeriodEnds;
  }

  function claimTokens(uint256 amount, bytes32[] calldata merkleProof) external {
    bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
    bool valid = MerkleProof.verify(merkleProof, merkleRoot, leaf);
    require(valid, "STX_MERKLE_PROOF_INVALID");
    require(claimed[msg.sender] < amount, "STX_ALREADY_CLAIMED");
    claimed[msg.sender] += amount;
    emit TokenClaimed(msg.sender, amount);
    _transfer(address(this), msg.sender, amount);
  }

  function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
    require(merkleRoot == bytes32(0), "STX_MERKLE_ROOT_ALREADY_SET");
    merkleRoot = _merkleRoot;
    emit MerkleRootChanged(_merkleRoot);
  }

  function newAirdrop(bytes32 _merkleRoot, uint256 _claimPeriodEnds) external onlyOwner {
    merkleRoot = _merkleRoot;
    claimPeriodEnds = _claimPeriodEnds;
    emit MerkleRootChanged(_merkleRoot);
  }

  function sweepTokens() external onlyOwner {
    require(claimPeriodEnds == 0 || block.timestamp > claimPeriodEnds, "STX_CLAIM_PERIOD_NOT_ENDED");
    _transfer(address(this), treasury, balanceOf(address(this)));
  }

  function mint(uint256 additionalSupply) external onlyOwner {
    _mint(address(this), additionalSupply * (10**18));
  }
}
