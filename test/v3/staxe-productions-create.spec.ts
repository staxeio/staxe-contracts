import { expect } from 'chai';
import { StaxeProductionsFactoryV3, StaxeProductionsV3, StaxeProductionTokenV3 } from '../../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { attachEscrow, createProduction, harness, newProduction } from '../utils/harness';
import { USDT } from '../../utils/swap';
import { BigNumber, ethers } from 'ethers';

describe('StaxeProductionsV3: create productions', () => {
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

  describe('Create Productions for Organizers', () => {
    it('inits contract correctly', async function () {
      // then
      expect(await productions.owner()).to.equal(owner.address);
    });

    it('creates a new production for organizer', async () => {
      // given
      const production = newProduction(100, 1n * 10n ** 18n);

      // when
      await expect(factory.connect(organizer).createProduction(production)).to.emit(factory, 'ProductionCreated');
      const created = await productions.getProduction(1);
      expect(await token.balanceOf(created.escrow, 1)).to.equal(production.totalSupply);
    });

    it('creates a new production for organizer with organizer tokens', async () => {
      // given
      const organizerTokens = 10;
      const production = newProduction(100, 1n * 10n ** 18n, [], 0, USDT(1337), '', 0, 0, 10, organizerTokens);

      // when
      await expect(factory.connect(organizer).createProduction(production)).to.emit(factory, 'ProductionCreated');
      const created = await productions.getProduction(1);
      expect(await token.balanceOf(created.escrow, 1)).to.equal(production.totalSupply - organizerTokens);
      expect(await token.balanceOf(organizer.address, 1)).to.equal(organizerTokens);
      expect(created.data.soldCounter).to.be.equal(organizerTokens);
      expect(created.data.organizerTokens).to.be.equal(organizerTokens);
    });

    it('creates a new production with perks', async () => {
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
        'hash',
        0,
        0,
        10
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
      expect(created.data.crowdsaleEndDate).to.be.equal(data.crowdsaleEndDate);
      expect(created.data.productionEndDate).to.be.equal(data.productionEndDate);
      expect(created.data.platformSharePercentage).to.be.equal(data.platformSharePercentage);
      expect(created.perks.length).to.be.equal(3);
      expect(created.perks[0].id).to.be.equal(1);
      expect(created.perks[0].total).to.be.equal(10);
      expect(created.perks[0].claimed).to.be.equal(0);
      expect(created.perks[0].minTokensRequired).to.be.equal(BigNumber.from(3));
    });
  });

  describe('Security Checks: Create Production', () => {
    it('does reject a new production for non-organizer', async () => {
      // given
      const production = newProduction(100, 1n * 10n ** 18n);

      // when
      await expect(factory.connect(investor1).createProduction(production)).to.be.revertedWith('Not an organizer');
    });

    it('rejects receiving a second token transfer after creation', async () => {
      // given
      const data = newProduction(100, 1n * 10n ** 18n);

      // when
      const id = await createProduction(factory.connect(organizer), data);
      const escrow = await attachEscrow(productions, id);

      // then
      await expect(
        escrow.onERC1155Received(
          token.address,
          organizer.address,
          1000,
          500,
          ethers.utils.solidityPack(['address'], ['0x0000000000000000000000000000000000000000'])
        )
      ).to.be.revertedWith('Token already set');
    });

    it('ignores batch token receivals', async () => {
      // given
      const data = newProduction(100, 1n * 10n ** 18n);

      // when
      const id = await createProduction(factory.connect(organizer), data);
      const escrow = await attachEscrow(productions, id);
      await escrow.onERC1155BatchReceived(
        token.address,
        organizer.address,
        [1000],
        [500],
        ethers.utils.solidityPack(['address'], ['0x0000000000000000000000000000000000000000'])
      );

      // then
      expect((await escrow.getProductionData()).id).to.equal(id);
    });

    it('reject batch mint in token contract', async () => {
      // given
      const data = newProduction(100, 1n * 10n ** 18n);

      // when
      const id = await createProduction(factory.connect(organizer), data);
      const escrow = await attachEscrow(productions, id);
      await expect(token.connect(owner).mintBatch(escrow.address, [99, 100], [100, 100], [])).to.be.revertedWith(
        'ERC1155: ERC1155Receiver rejected tokens'
      );

      // then
      expect((await escrow.getProductionData()).id).to.equal(id);
    });

    it('reject mint of more tokens in token contract', async () => {
      // given
      const data = newProduction(100, 1n * 10n ** 18n);

      // when
      const id = await createProduction(factory.connect(organizer), data);
      const escrow = await attachEscrow(productions, id);
      await expect(token.connect(owner).mint(escrow.address, id, 100, [])).to.be.revertedWith('Token already set');

      // then
      expect((await escrow.getProductionData()).id).to.equal(id);
    });

    it('reject creating a production with an unapproved ERC20', async () => {
      // given
      const data = newProduction(100, 1n * 10n ** 18n, [], 0, '0x0000000000000000000000000000000000000000');

      // when
      await expect(factory.connect(organizer).createProduction(data)).to.be.revertedWith('Unknown ERC20 token');
    });

    it('reject creating a production from unknown factory', async () => {
      // when
      await expect(
        productions.connect(organizer).mintProduction(organizer.address, organizer.address, 100)
      ).to.be.revertedWith('Untrusted Escrow Factory');
    });

    it('returns empty production for non-existing id', async () => {
      // givne
      const doesNotExist = 9999999;

      // when
      const empty = await productions.getProduction(doesNotExist);

      // then
      expect(empty.id).to.be.equal(doesNotExist);
      expect(empty.data.state).to.be.equal(0);
    });
  });
});
