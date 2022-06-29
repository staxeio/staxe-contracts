import { expect } from 'chai';
import { StaxeProductionsFactoryV3, StaxeProductionsV3 } from '../../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { attachToken, buyTokens, createAndApproveProduction, harness, newProduction } from '../utils/harness';
import { USDT } from '../../utils/swap';

describe('StaxeProductionsV3: retrieve funding', () => {
  // contracts
  let productions: StaxeProductionsV3;
  let factory: StaxeProductionsFactoryV3;

  // actors
  let owner: SignerWithAddress;
  let approver: SignerWithAddress;
  let organizer: SignerWithAddress;
  let investor1: SignerWithAddress;
  let investor2: SignerWithAddress;

  const usdt = USDT(1337) as string;

  beforeEach(async () => {
    ({ productions, factory, owner, approver, organizer, investor1, investor2 } = await harness());
  });

  // --------------------------- Retrive funds ---------------------------

  describe('Transfer Funding to Organizer', () => {
    it('transfers all funding to organizer', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const funds1 = await buyTokens(productions.connect(investor1), investor1.address, id, 5);
      const funds2 = await buyTokens(productions.connect(investor2), investor1.address, id, 15);

      // when
      await productions.connect(organizer).transferFunding(id);

      // then
      const escrow = (await productions.getProduction(id)).escrow;
      const currency = await attachToken(usdt);
      const balanceEscrow = await currency.balanceOf(escrow);
      expect(balanceEscrow).to.be.equal(0);
      const balanceOrganizer = await currency.balanceOf(organizer.address);
      expect(balanceOrganizer).to.be.equal(((funds1 + funds2) * 90n) / 100n);
      const balanceOwner = await currency.balanceOf(owner.address);
      expect(balanceOwner).to.be.equal(((funds1 + funds2) * 10n) / 100n);
    });

    it('automatically transfers funding when finishing crowdsale', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const funds = await buyTokens(productions.connect(investor1), investor1.address, id, 5);

      // when
      await productions.connect(organizer).finishCrowdsale(id);

      // then
      const escrow = (await productions.getProduction(id)).escrow;
      const currency = await attachToken(usdt);
      const balanceEscrow = await currency.balanceOf(escrow);
      expect(balanceEscrow).to.be.equal(0);
      const balanceOrganizer = await currency.balanceOf(organizer.address);
      expect(balanceOrganizer).to.be.equal((funds * 90n) / 100n);
      const balanceOwner = await currency.balanceOf(owner.address);
      expect(balanceOwner).to.be.equal((funds * 10n) / 100n);
    });

    it('rejects transferring funds after finishing crowdsale', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      await buyTokens(productions.connect(investor1), investor1.address, id, 5);
      await productions.connect(organizer).finishCrowdsale(id);

      // when
      await expect(productions.connect(organizer).transferFunding(id)).to.be.revertedWith('Not in required state');
    });
  });
});
