import { expect } from 'chai';
import { StaxeMembersV3, StaxeProductionsFactoryV3, StaxeProductionsV3, StaxeProductionTokenV3 } from '../../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  attachEscrow,
  attachToken,
  buyTokens,
  buyUsdtAndApprove,
  createAndApproveProduction,
  harness,
  newProduction,
} from '../utils/harness';
import { USDT } from '../../utils/swap';
import { timeStampPlusDays, timeTravel } from '../utils/ethers-utils';

describe('StaxeProductionsV3: send and retrieve proceeds', () => {
  // contracts
  let productions: StaxeProductionsV3;
  let token: StaxeProductionTokenV3;
  let factory: StaxeProductionsFactoryV3;
  let members: StaxeMembersV3;

  // actors
  let owner: SignerWithAddress;
  let approver: SignerWithAddress;
  let organizer: SignerWithAddress;
  let organizer2: SignerWithAddress;
  let investor1: SignerWithAddress;
  let investor2: SignerWithAddress;
  let delegate: SignerWithAddress;

  const usdt = USDT(1337) as string;

  beforeEach(async () => {
    ({ productions, token, factory, members, owner, approver, organizer, investor1, investor2, organizer2, delegate } =
      await harness());
  });

  // --------------------------- Retrive funds ---------------------------

  describe('Send proceeds and retrieve by token holders', () => {
    it('sends proceeds and calculate token holder share', async () => {
      // given
      const proceeds = 10n ** 5n;
      const tokensToBuy1 = 20,
        tokensToBuy2 = 30;
      const totalTokens = 100,
        tokensSold = 50n;
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(totalTokens, 10n ** 6n)
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
      await expect(productions.connect(organizer).transferProceeds(id)).to.be.revertedWith(
        'Only investors can claim proceeds'
      );
      const data3 = await productions.getTokenOwnerData(id, investor1.address);
      const data4 = await productions.getTokenOwnerData(id, investor2.address);

      // then
      expect(data1.balance).to.be.equal(tokensToBuy1);
      expect(data1.perksOwned.length).to.be.equal(0);
      expect(data1.proceedsClaimed).to.be.equal(0);
      expect(data1.proceedsAvailable).to.be.equal((proceeds / tokensSold) * BigInt(tokensToBuy1), 'proceeds data1');

      expect(data2.balance).to.be.equal(tokensToBuy2);
      expect(data2.perksOwned.length).to.be.equal(0);
      expect(data2.proceedsClaimed).to.be.equal(0);
      expect(data2.proceedsAvailable).to.be.equal((proceeds / tokensSold) * BigInt(tokensToBuy2), 'proceeds data2');

      expect(data3.balance).to.be.equal(tokensToBuy1);
      expect(data3.perksOwned.length).to.be.equal(0);
      expect(data3.proceedsAvailable).to.be.equal(0);
      expect(data3.proceedsClaimed).to.be.equal((proceeds / tokensSold) * BigInt(tokensToBuy1), 'proceeds data3');

      expect(data4.balance).to.be.equal(tokensToBuy2);
      expect(data4.perksOwned.length).to.be.equal(0);
      expect(data4.proceedsAvailable).to.be.equal(0);
      expect(data4.proceedsClaimed).to.be.equal((proceeds / tokensSold) * BigInt(tokensToBuy2), 'proceeds data4');

      const escrow = (await productions.getProduction(id)).escrow;
      const currency = await attachToken(usdt);
      const balanceEscrow = await currency.balanceOf(escrow);
      expect(balanceEscrow).to.be.equal(0);
    });

    it('sends proceeds and calculate token holder share after token transfer', async () => {
      // given
      const proceeds = 10n ** 5n;
      const tokensToBuy = 20,
        tokensSold = BigInt(tokensToBuy);
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
      expect(data1.proceedsClaimed).to.be.equal((proceeds / tokensSold) * BigInt(tokensToBuy));
      expect(data1.proceedsAvailable).to.be.equal(0);

      expect(data2.balance).to.be.equal(tokensToBuy / 2);
      expect(data2.perksOwned.length).to.be.equal(0);
      expect(data2.proceedsClaimed).to.be.equal(0);
      expect(data2.proceedsAvailable).to.be.equal(0);

      expect(data3.proceedsClaimed).to.be.equal(
        (proceeds / tokensSold) * BigInt(tokensToBuy) + (proceeds / tokensSold) * BigInt(tokensToBuy / 2)
      );
      expect(data3.proceedsAvailable).to.be.equal(0);

      expect(data4.proceedsClaimed).to.be.equal(0);
      expect(data4.proceedsAvailable).to.be.equal((proceeds / tokensSold) * BigInt(tokensToBuy / 2));

      const escrow = (await productions.getProduction(id)).escrow;
      const currency = await attachToken(usdt);
      const balanceEscrow = await currency.balanceOf(escrow);
      expect(balanceEscrow).to.be.equal(proceeds * 2n - (proceeds * 2n * 15n) / tokensSold);
    });

    it('empties leftover proceeds to organizer treasury on close', async () => {
      // given
      const currency = await attachToken(usdt);
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
      await productions.connect(organizer).depositProceedsInTokens(id, proceeds);
      const balanceBefore = await currency.balanceOf(organizer.address);

      // when
      await productions.connect(organizer).close(id);

      // then
      const balanceAfter = await currency.balanceOf(organizer.address);
      expect(balanceAfter.sub(balanceBefore).toBigInt()).to.be.equal((proceeds / 100n) * 90n);
      const escrow = (await productions.getProduction(id)).escrow;
      const balanceEscrow = await currency.balanceOf(escrow);
      expect(balanceEscrow.toBigInt()).to.be.equal(0n);
    });
  });

  describe('Lifecycle and security checks', () => {
    it('cannot finish crowdsale when not production creator, can as delegate', async () => {
      // given
      const totalTokens = 100;
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(totalTokens, 10n ** 6n)
      );

      // when
      await expect(productions.connect(organizer2).finishCrowdsale(id)).to.be.revertedWith(
        'Cannot be finished before finish date or only by creator'
      );
      await expect(productions.connect(owner).finishCrowdsale(id)).to.be.revertedWith(
        'Cannot be finished before finish date or only by creator'
      );
      await members.connect(organizer).addDelegate(delegate.address);
      await productions.connect(delegate).finishCrowdsale(id);
    });

    it('cannot finish crowdsale before end date, trusted relayer can after end date', async () => {
      // given
      const totalTokens = 100;
      const endDate = await timeStampPlusDays(1);
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(totalTokens, 10n ** 6n, [], 0, USDT(1337), '', endDate)
      );

      // when
      await expect(productions.connect(organizer).finishCrowdsale(id)).to.be.revertedWith(
        'Cannot be finished before finish date or only by creator'
      );
      await expect(productions.connect(owner).finishCrowdsale(id)).to.be.revertedWith(
        'Cannot be finished before finish date or only by creator'
      );
      await timeTravel(2);
      await expect(productions.connect(organizer2).finishCrowdsale(id)).to.be.revertedWith(
        'Cannot be finished before finish date or only by creator'
      );
      await productions.connect(owner).finishCrowdsale(id);
    });

    it('cannot finish crowdsale directly on escrow', async () => {
      // given
      const totalTokens = 100;
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(totalTokens, 10n ** 6n)
      );
      const escrow = await attachEscrow(productions, id);

      // when
      await expect(escrow.connect(organizer).finish(organizer.address, true, organizer.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('cannot close production when not production creator, can as delegate', async () => {
      // given
      const totalTokens = 100;
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(totalTokens, 10n ** 6n)
      );
      await productions.connect(organizer).finishCrowdsale(id);

      // when
      await expect(productions.connect(organizer2).close(id)).to.be.revertedWith(
        'Cannot be closed before close date or only by creator'
      );
      await expect(productions.connect(owner).close(id)).to.be.revertedWith(
        'Cannot be closed before close date or only by creator'
      );
      await members.connect(organizer).addDelegate(delegate.address);
      await productions.connect(delegate).close(id);
    });

    it('cannot close production before end date, trusted relayer can after end date', async () => {
      // given
      const totalTokens = 100;
      const endDate = await timeStampPlusDays(1);
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(totalTokens, 10n ** 6n, [], 0, USDT(1337), '', 0, endDate)
      );
      await productions.connect(organizer).finishCrowdsale(id);

      // when
      await expect(productions.connect(organizer).close(id)).to.be.revertedWith(
        'Cannot be closed before close date or only by creator'
      );
      await expect(productions.connect(owner).close(id)).to.be.revertedWith(
        'Cannot be closed before close date or only by creator'
      );
      await timeTravel(2);
      await expect(productions.connect(organizer2).close(id)).to.be.revertedWith(
        'Cannot be closed before close date or only by creator'
      );
      await productions.connect(owner).close(id);
    });

    it('cannot close production directly on escrow', async () => {
      // given
      const totalTokens = 100;
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(totalTokens, 10n ** 6n)
      );
      await productions.connect(organizer).finishCrowdsale(id);
      const escrow = await attachEscrow(productions, id);

      // when
      await expect(escrow.connect(organizer).close(organizer.address, true, organizer.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });
});
