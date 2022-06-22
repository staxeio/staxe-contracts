import { expect } from 'chai';
import { StaxeProductionsFactoryV3, StaxeProductionsV3, StaxeProductionTokenV3 } from '../../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { harness, newProduction } from '../utils/harness';

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

  it('does reject a new production for non-organizer', async function () {
    // given
    const production = newProduction(100, 1n * 10n ** 18n);

    // when
    await expect(factory.connect(investor1).createProduction(production)).to.be.revertedWith('Not an organizer');
  });
});
