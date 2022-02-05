import { expect } from 'chai';
import { ethers } from 'hardhat';
import { StaxeDAOToken } from '../typechain';
import { generateLeaf, generateProof } from './utils/merkle-utils';

import MerkleGenerator from '../utils/merkle-generator';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ethersParse, timeTravel } from './utils/ethers-utils';

describe('StaxeDAOToken', function () {
  // contracts
  let token: StaxeDAOToken;

  // actors
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let addresses: SignerWithAddress[];

  // balances
  const TOKEN_DECIMALS = 18;
  const TREASURY_INIT = 1000;
  const AIRDROP_INIT = 2000;

  beforeEach(async () => {
    [owner, treasury, ...addresses] = await ethers.getSigners();

    // create contracts
    const tokenFactory = await ethers.getContractFactory('StaxeDAOToken');
    token = (await tokenFactory.deploy(treasury.getAddress(), TREASURY_INIT, AIRDROP_INIT)) as StaxeDAOToken;
  });

  // ------------------------------------ init token ------------------------------------

  it('inits with treasury and airdrop balance', async function () {
    // when
    const treasuryBalance = await token.balanceOf(await treasury.getAddress());
    const airdropSupply = await token.balanceOf(await token.address);

    // then
    expect(treasuryBalance).to.equal(ethersParse(TREASURY_INIT, TOKEN_DECIMALS));
    expect(airdropSupply).to.equal(ethersParse(AIRDROP_INIT, TOKEN_DECIMALS));
  });

  // ------------------------------------ airdrops / claim ------------------------------------

  it('creates new airdrop', async () => {
    // given
    const airdrop = {
      [addresses[0].address]: 100,
    };
    const generator = new MerkleGenerator(TOKEN_DECIMALS, airdrop);
    const { merkleRoot } = await generator.process();
    // in 90 days
    const claimEnd = Math.floor(new Date().setDate(new Date().getDate() + 90) / 1000);

    // when then
    await expect(token.newAirdrop(merkleRoot, claimEnd))
      .to.emit(token, 'AirdropCreated')
      .withArgs(merkleRoot, 1, claimEnd);
  });

  it('should fail to create new airdrop if not owner', async () => {
    // when then
    await expect(
      token.connect(addresses[0]).newAirdrop('0xcb3e5354b17a03f06b0bef4e293ceda50dbbfc91adbeacd54ee46bbc81da2c12', 1000)
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('allows to claim correct amount of tokens with airdrop', async () => {
    // given
    const airdrop = {
      [addresses[0].address]: 100,
      [addresses[1].address]: 200,
      [addresses[2].address]: 300,
    };
    const { merkleRoot, merkleTree, merkleProof, amount } = await generateProof(
      airdrop,
      TOKEN_DECIMALS,
      addresses[0].address
    );
    // in 90 days
    const claimEnd = Math.floor(new Date().setDate(new Date().getDate() + 90) / 1000);
    await token.newAirdrop(merkleRoot, claimEnd);
    expect(await token.balanceOf(addresses[0].address)).to.equal(0);

    // when then
    // --- claim success
    await expect(token.connect(addresses[0]).claimTokens(amount, merkleProof))
      .to.emit(token, 'TokenClaimed')
      .withArgs(addresses[0].address, amount, 1);
    expect(await token.balanceOf(addresses[0].address)).to.equal(amount);
    expect(await token.balanceOf(token.address)).to.equal(ethersParse(AIRDROP_INIT - 100, TOKEN_DECIMALS));

    // --- claim failure already claimed
    await expect(token.connect(addresses[0]).claimTokens(amount, merkleProof)).to.be.revertedWith(
      'STX_ALREADY_CLAIMED'
    );

    // --- claim failure wrong amount
    const amount1 = ethersParse(airdrop[addresses[1].address] + 100, TOKEN_DECIMALS);
    const leaf1: Buffer = generateLeaf(addresses[1].address, amount1.toString());
    const proof1: string[] = merkleTree.getHexProof(leaf1);
    await expect(token.connect(addresses[1]).claimTokens(amount1, proof1)).to.be.revertedWith(
      'STX_MERKLE_PROOF_INVALID'
    );
  });

  it('should fail to claim without active airdrop', async () => {
    // given
    const airdrop = {
      [addresses[0].address]: 100,
    };
    const { merkleProof, amount } = await generateProof(airdrop, TOKEN_DECIMALS, addresses[0].address);

    // when then
    await expect(token.connect(addresses[0]).claimTokens(amount, merkleProof)).to.be.revertedWith(
      'STX_MERKLE_ROOT_NOT_SET'
    );
  });

  it('should fail to create new airdrop while current still running', async () => {
    // given
    const airdrop = {
      [addresses[0].address]: 100,
    };
    const { merkleRoot } = await generateProof(airdrop, TOKEN_DECIMALS, addresses[0].address);

    // when
    // in 5 days
    const claimEnd = Math.floor(new Date().setDate(new Date().getDate() + 5) / 1000);
    await token.newAirdrop(merkleRoot, claimEnd);

    // in 15 days
    const claimEndDrop2 = Math.floor(new Date().setDate(new Date().getDate() + 15) / 1000);
    await expect(token.newAirdrop(merkleRoot, claimEndDrop2)).to.be.revertedWith('STX_CLAIM_PERIOD_NOT_ENDED');
  });

  it('allows to claim correct amount of tokens in multiple airdrops', async () => {
    // given
    const airdrop1 = {
      [addresses[0].address]: 100,
    };
    const airdrop2 = {
      [addresses[0].address]: 300,
    };

    // airdrop 1
    const {
      merkleRoot: root1,
      merkleProof: proof1,
      amount: amount1,
    } = await generateProof(airdrop1, TOKEN_DECIMALS, addresses[0].address);
    // in 5 days
    const claimEnd1 = Math.floor(new Date().setDate(new Date().getDate() + 5) / 1000);
    await token.newAirdrop(root1, claimEnd1);

    // --- claim 1
    await token.connect(addresses[0]).claimTokens(amount1, proof1);

    // airdrop 2
    const {
      merkleRoot: root2,
      merkleProof: proof2,
      amount: amount2,
    } = await generateProof(airdrop2, TOKEN_DECIMALS, addresses[0].address);
    // in 15 days
    const claimEnd2 = Math.floor(new Date().setDate(new Date().getDate() + 15) / 1000);
    await timeTravel(6);
    await token.newAirdrop(root2, claimEnd2);

    // --- claim 2
    await token.connect(addresses[0]).claimTokens(amount2, proof2);

    // then
    await timeTravel(-6);
    expect(await token.balanceOf(addresses[0].address)).to.equal(amount1.add(amount2));
  });

  // ------------------------------------ sweep token ------------------------------------

  it('should sweep unclaimed airdrop supplies', async () => {
    // given
    const airdrop = {
      [addresses[0].address]: 100,
    };
    const { merkleRoot, merkleProof, amount } = await generateProof(airdrop, TOKEN_DECIMALS, addresses[0].address);
    const claimEnd = Math.floor(new Date().setDate(new Date().getDate() + 5) / 1000);
    await token.newAirdrop(merkleRoot, claimEnd);
    await token.connect(addresses[0]).claimTokens(amount, merkleProof);
    await timeTravel(6);

    // when
    await token.connect(owner).sweepUnclaimedTokens();

    // then
    await timeTravel(-6);
    const treasuryBalance = await token.balanceOf(treasury.address);
    expect(treasuryBalance).to.equal(ethersParse(AIRDROP_INIT - 100 + TREASURY_INIT, TOKEN_DECIMALS));
  });

  it('should fail to sweep unclaimed airdrop supplies if airdrop is still running', async () => {
    // given
    const airdrop = {
      [addresses[0].address]: 100,
    };
    const { merkleRoot, merkleProof, amount } = await generateProof(airdrop, TOKEN_DECIMALS, addresses[0].address);
    const claimEnd = Math.floor(new Date().setDate(new Date().getDate() + 50) / 1000);
    await token.newAirdrop(merkleRoot, claimEnd);
    await token.connect(addresses[0]).claimTokens(amount, merkleProof);

    // when then
    await expect(token.connect(owner).sweepUnclaimedTokens()).to.be.revertedWith('STX_CLAIM_PERIOD_NOT_ENDED');
  });

  it('should fail to sweep tokens if not owner', async () => {
    // when then
    await expect(token.connect(addresses[0]).sweepUnclaimedTokens()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
  });
});
