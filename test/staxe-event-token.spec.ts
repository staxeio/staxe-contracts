/*import { expect } from 'chai';
// @ts-ignore
import { ethers } from 'hardhat';
import { StaxeEventToken } from '../typechain';

describe('StaxeEventToken', () => {
  it('should create an ERC1155 event token', async () => {
    // given
    const [owner, accountOne] = await ethers.getSigners();
    const tokenFactory = await ethers.getContractFactory('StaxeEventToken');
    const token = (await tokenFactory.deploy()) as StaxeEventToken;
    await token.deployed();

    // when
    await token.mintEventToken(accountOne.address, 1, 10);

    // then
    expect(await token.balanceOf(accountOne.address, 1)).to.equal(10);
  });

  it('should should reject minting from non-minter', async () => {
    // given
    const [owner, accountOne] = await ethers.getSigners();
    const tokenFactory = await ethers.getContractFactory('StaxeEventToken');
    const token = (await tokenFactory.connect(owner).deploy()) as StaxeEventToken;
    await token.deployed();

    // when
    // @ts-ignore
    await expect(token.connect(accountOne).mintEventToken(accountOne.address, 1, 10)).to.be.revertedWith(
      'ERC1155PresetMinterPauser: must have minter role to mint'
    );
  });

  it('should should reject pausing from non-pauser', async () => {
    // given
    const [owner, accountOne] = await ethers.getSigners();
    const tokenFactory = await ethers.getContractFactory('StaxeEventToken');
    const token = (await tokenFactory.connect(owner).deploy()) as StaxeEventToken;
    await token.deployed();

    // when
    // @ts-ignore
    await expect(token.connect(accountOne).pause()).to.be.revertedWith(
      'ERC1155PresetMinterPauser: must have pauser role to pause'
    );
  });

  it('should should reject minting after pausing', async () => {
    // given
    const [owner, accountOne] = await ethers.getSigners();
    const tokenFactory = await ethers.getContractFactory('StaxeEventToken');
    const token = (await tokenFactory.connect(owner).deploy()) as StaxeEventToken;
    await token.deployed();
    await token.connect(owner).pause();

    // when
    // @ts-ignore
    await expect(token.connect(owner).mintEventToken(accountOne.address, 1, 10)).to.be.revertedWith(
      'ERC1155Pausable: token transfer while paused'
    );
  });
});
*/
