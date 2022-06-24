import { expect } from 'chai';
import { StaxeProductionsFactoryV3, StaxeProductionsV3, StaxeProductionTokenV3 } from '../../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { createProduction, harness, newProduction } from '../utils/harness';
import { USDT } from '../../utils/swap';
import { BigNumber } from 'ethers';

describe('StaxeProductionsV3: create productions', function () {
  // contracts
  let token: StaxeProductionTokenV3;
  let productions: StaxeProductionsV3;
  let factory: StaxeProductionsFactoryV3;

  // actors
  let owner: SignerWithAddress;
  let organizer: SignerWithAddress;
  let investor1: SignerWithAddress;

  beforeEach(async () => {
    ({ token, productions, factory, owner, organizer, investor1 } = await harness());
  });

  it('inits contract correctly', async function () {
    // then
    expect(await productions.owner()).to.equal(owner.address);
  });

  it('creates a new production for organizer', async function () {
    // given
    const production = newProduction(100, 1n * 10n ** 18n);
    const escrowAddress = '0xf99B3859f4986f383502f64D97BCc74715537016';

    // when
    await expect(factory.connect(organizer).createProduction(production))
      .to.emit(factory, 'ProductionCreated')
      .withArgs(1, organizer.address, production.totalSupply, escrowAddress);
    expect(await token.balanceOf(escrowAddress, 1)).to.equal(production.totalSupply);
  });

  it('creates a new production with perks', async function () {
    // given
    const data = newProduction(
      100,
      1n * 10n ** 18n,
      [
        { total: 10, minTokensRequired: 3 },
        { total: 5, minTokensRequired: 5 },
        { total: 1, minTokensRequired: 10 },
      ],
      10,
      USDT(1337) as string,
      'hash'
    );

    // when
    const id = await createProduction(factory.connect(organizer), data);

    // then
    const created = await productions.getProduction(id);
    expect(created.id).not.to.be.undefined;
    expect(created.data.id).to.be.equal(created.id);
    expect(created.data.totalSupply).to.be.equal(data.totalSupply);
    expect(created.data.creator).to.be.equal(organizer.address);
    expect(created.data.soldCounter).to.be.equal(0);
    expect(created.data.maxTokensUnknownBuyer).to.be.equal(data.maxTokensUnknownBuyer);
    expect(created.data.currency).to.be.equal(data.currency);
    expect(created.data.state).to.be.equal(1);
    expect(created.data.dataHash).to.be.equal(data.dataHash);
    expect(created.perks.length).to.be.equal(3);
    console.log(created.perks);
    expect(created.perks[0].id).to.be.equal(1);
    expect(created.perks[0].total).to.be.equal(10);
    expect(created.perks[0].claimed).to.be.equal(0);
    expect(created.perks[0].minTokensRequired).to.be.equal(BigNumber.from(3));
  });

  it('does reject a new production for non-organizer', async function () {
    // given
    const production = newProduction(100, 1n * 10n ** 18n);

    // when
    await expect(factory.connect(investor1).createProduction(production)).to.be.revertedWith('Not an organizer');
  });
});
