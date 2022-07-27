import { expect } from 'chai';
import { StaxeProductionsFactoryV3, StaxeProductionsV3 } from '../../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { attachEscrow, createAndApproveProduction, harness, newProduction } from '../utils/harness';
import { getQuote } from '../utils/uniswap';
import { timeStampPlusDays } from '../utils/ethers-utils';

describe('StaxeProductionsV3: cancel production', () => {
  // contracts
  let productions: StaxeProductionsV3;
  let factory: StaxeProductionsFactoryV3;

  // actors
  let approver: SignerWithAddress;
  let organizer: SignerWithAddress;
  let investor1: SignerWithAddress;

  beforeEach(async () => {
    ({ productions, factory, approver, organizer, investor1 } = await harness());
  });

  describe('Cancel production', () => {
    it('should block buy, finish and funding operations after pausing', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const tokensToBuy = 10;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await productions
        .connect(investor1)
        .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 0, { value: swapPrice * 2n });

      // when
      await productions.connect(approver).pause(id);
      const data = await productions.getProduction(id);

      // then
      expect(data.paused).to.be.equal(true);
      await expect(
        productions
          .connect(investor1)
          .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 0, { value: swapPrice * 2n })
      ).to.be.revertedWith('Pausable: paused');
      await expect(productions.connect(organizer).transferFunding(id)).to.be.revertedWith('Pausable: paused');
      await expect(productions.connect(organizer).finishCrowdsale(id)).to.be.revertedWith('Pausable: paused');
    });

    it('should allow buy, finish and funding operations after unpausing', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const tokensToBuy = 10;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await productions
        .connect(investor1)
        .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 0, { value: swapPrice * 2n });

      // when
      await productions.connect(approver).pause(id);
      await productions.connect(approver).unpause(id);
      const data = await productions.getProduction(id);

      // then
      expect(data.paused).to.be.equal(false);
      await productions
        .connect(investor1)
        .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 0, { value: swapPrice * 2n });
      await productions.connect(organizer).transferFunding(id);
      await productions.connect(organizer).finishCrowdsale(id);
    });

    it('should move production to finished with closing time set and remaining funds transferred', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const tokensToBuy = 50;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await productions
        .connect(investor1)
        .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 0, { value: swapPrice * 2n });
      const timeToClose = await timeStampPlusDays(31);
      const timeToCloseTooShort = await timeStampPlusDays(15);

      // when
      await productions.connect(approver).pause(id);
      await expect(productions.connect(approver).cancel(id, timeToCloseTooShort)).to.be.revertedWith(
        'Refund period not long enough'
      );
      await productions.connect(approver).cancel(id, timeToClose);
      const productionData = await productions.getProduction(id);
      const investorData = await productions.connect(investor1).getTokenOwnerData(id, investor1.address);

      // then
      expect(productionData.paused).to.be.equal(false);
      expect(productionData.data.state).to.be.equal(3);
      expect(investorData.proceedsAvailable.toBigInt()).to.be.equal(price[1].toBigInt());
    });
  });

  // --------------------------- SECURITY CHECKS ---------------------------

  describe('Security and lifecycle checks', () => {
    it('cannot call functions directly on escrow', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const escrow = await attachEscrow(productions, id);

      // when
      await expect(escrow.pause(investor1.address)).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(escrow.unpause(investor1.address)).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(
        escrow.cancel(investor1.address, Math.floor((Date.now() + 1000 * 60 * 60 * 24 * 31) / 1000))
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('cannot call functions with other roles', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );

      // when
      await expect(productions.connect(investor1).pause(id)).to.be.revertedWith('Caller must be approver');
      await productions.connect(approver).pause(id);
      await expect(productions.connect(organizer).unpause(id)).to.be.revertedWith('Caller must be approver');
      await expect(
        productions.connect(organizer).cancel(id, Math.floor((Date.now() + 1000 * 60 * 60 * 24 * 31) / 1000))
      ).to.be.revertedWith('Caller must be approver');
    });
  });
});
