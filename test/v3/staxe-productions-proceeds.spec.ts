import { expect } from 'chai';
import { StaxeProductionsFactoryV3, StaxeProductionsV3, StaxeProductionTokenV3 } from '../../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  attachToken,
  buyTokens,
  buyUsdtAndApprove,
  createAndApproveProduction,
  harness,
  newProduction,
} from '../utils/harness';
import { USDT } from '../../utils/swap';

describe('StaxeProductionsV3: send and retrieve proceeds', () => {
  // contracts
  let productions: StaxeProductionsV3;
  let token: StaxeProductionTokenV3;
  let factory: StaxeProductionsFactoryV3;

  // actors
  let approver: SignerWithAddress;
  let organizer: SignerWithAddress;
  let investor1: SignerWithAddress;
  let investor2: SignerWithAddress;

  const usdt = USDT(1337) as string;

  beforeEach(async () => {
    ({ productions, token, factory, approver, organizer, investor1, investor2 } = await harness());
  });

  // --------------------------- Retrive funds ---------------------------

  describe('Send proceeds and retrieve by token holders', () => {
    it('sends proceeds and calculate token holder share', async () => {
      // given
      const proceeds = 10n ** 5n;
      const tokensToBuy1 = 20,
        tokensToBuy2 = 30;
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      await buyTokens(productions.connect(investor1), investor1.address, id, tokensToBuy1);
      await buyTokens(productions.connect(investor2), investor2.address, id, tokensToBuy2);
      await productions.connect(organizer).finishCrowdsale(id);
      await buyUsdtAndApprove(proceeds, organizer, productions.address);

      // when
      await productions.connect(organizer).depositProceedsInTokens(id, proceeds);
      const data1 = await productions.getTokenOwnerData(id, investor1.address);
      const data2 = await productions.getTokenOwnerData(id, investor2.address);

      await productions.connect(investor1).transferProceeds(id);
      await productions.connect(investor2).transferProceeds(id);
      const data3 = await productions.getTokenOwnerData(id, investor1.address);
      const data4 = await productions.getTokenOwnerData(id, investor2.address);

      // then
      expect(data1.balance).to.be.equal(tokensToBuy1);
      expect(data1.perksOwned.length).to.be.equal(0);
      expect(data1.proceedsClaimed).to.be.equal(0);
      expect(data1.proceedsAvailable).to.be.equal((proceeds / 100n) * BigInt(tokensToBuy1));

      expect(data2.balance).to.be.equal(tokensToBuy2);
      expect(data2.perksOwned.length).to.be.equal(0);
      expect(data2.proceedsClaimed).to.be.equal(0);
      expect(data2.proceedsAvailable).to.be.equal((proceeds / 100n) * BigInt(tokensToBuy2));

      expect(data3.balance).to.be.equal(tokensToBuy1);
      expect(data3.perksOwned.length).to.be.equal(0);
      expect(data3.proceedsAvailable).to.be.equal(0);
      expect(data3.proceedsClaimed).to.be.equal((proceeds / 100n) * BigInt(tokensToBuy1));

      expect(data4.balance).to.be.equal(tokensToBuy2);
      expect(data4.perksOwned.length).to.be.equal(0);
      expect(data4.proceedsAvailable).to.be.equal(0);
      expect(data4.proceedsClaimed).to.be.equal((proceeds / 100n) * BigInt(tokensToBuy2));

      const escrow = (await productions.getProduction(id)).escrow;
      const currency = await attachToken(usdt);
      const balanceEscrow = await currency.balanceOf(escrow);
      expect(balanceEscrow).to.be.equal(proceeds / 2n);
    });

    it('sends proceeds and calculate token holder share after token transfer', async () => {
      // given
      const proceeds = 10n ** 5n;
      const tokensToBuy = 20;
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      await buyTokens(productions.connect(investor1), investor1.address, id, tokensToBuy);
      await productions.connect(organizer).finishCrowdsale(id);
      await buyUsdtAndApprove(proceeds * 2n, organizer, productions.address);

      // when
      await productions.connect(organizer).depositProceedsInTokens(id, proceeds);
      await productions.connect(investor1).transferProceeds(id);
      await token.connect(investor1).safeTransferFrom(investor1.address, investor2.address, id, tokensToBuy / 2, []);
      const data1 = await productions.getTokenOwnerData(id, investor1.address);
      const data2 = await productions.getTokenOwnerData(id, investor2.address);

      await productions.connect(organizer).depositProceedsInTokens(id, proceeds);
      await productions.connect(investor1).transferProceeds(id);
      const data3 = await productions.getTokenOwnerData(id, investor1.address);
      const data4 = await productions.getTokenOwnerData(id, investor2.address);

      // then
      expect(data1.balance).to.be.equal(tokensToBuy / 2);
      expect(data1.perksOwned.length).to.be.equal(0);
      expect(data1.proceedsClaimed).to.be.equal((proceeds / 100n) * BigInt(tokensToBuy));
      expect(data1.proceedsAvailable).to.be.equal(0);

      expect(data2.balance).to.be.equal(tokensToBuy / 2);
      expect(data2.perksOwned.length).to.be.equal(0);
      expect(data2.proceedsClaimed).to.be.equal(0);
      expect(data2.proceedsAvailable).to.be.equal(0);

      expect(data3.proceedsClaimed).to.be.equal(
        (proceeds / 100n) * BigInt(tokensToBuy) + (proceeds / 100n) * BigInt(tokensToBuy / 2)
      );
      expect(data3.proceedsAvailable).to.be.equal(0);

      expect(data4.proceedsClaimed).to.be.equal(0);
      expect(data4.proceedsAvailable).to.be.equal((proceeds / 100n) * BigInt(tokensToBuy / 2));

      const escrow = (await productions.getProduction(id)).escrow;
      const currency = await attachToken(usdt);
      const balanceEscrow = await currency.balanceOf(escrow);
      expect(balanceEscrow).to.be.equal(proceeds * 2n - (proceeds * 2n * 15n) / 100n);
    });
  });
});
