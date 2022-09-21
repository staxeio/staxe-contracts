import { expect } from 'chai';
import { StaxeProductionsFactoryV3, StaxeProductionsV3, StaxeProductionTokenV3 } from '../../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  attachEscrow,
  attachToken,
  createAndApproveProduction,
  createProduction,
  harness,
  newProduction,
} from '../utils/harness';
import { USDT } from '../../utils/swap';
import { buyToken, getQuote } from '../utils/uniswap';
import { getContract } from '../../utils/deployment';

describe('StaxeProductionsV3: buy tokens', () => {
  // contracts
  let token: StaxeProductionTokenV3;
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
    ({ token, productions, factory, owner, approver, organizer, investor1, investor2 } = await harness());
  });

  // --------------------------- TOKEN DATA ---------------------------

  describe('Show token buyer data', () => {
    it('shows token buyers with balances after buying and transferring tokens', async () => {
      // given
      const id1 = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const id2 = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const tokensToBuy = 10;
      const price = await productions.connect(investor1).getTokenPrice(id1, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await productions
        .connect(investor1)
        .buyTokensWithCurrency(id1, investor1.address, tokensToBuy, 0, { value: swapPrice * 2n });
      await productions
        .connect(investor2)
        .buyTokensWithCurrency(id1, investor2.address, tokensToBuy * 2, 0, { value: swapPrice * 3n });
      await productions
        .connect(investor2)
        .buyTokensWithCurrency(id2, investor2.address, tokensToBuy * 2, 0, { value: swapPrice * 3n });
      await token.connect(investor2).safeTransferFrom(investor2.address, investor1.address, id2, tokensToBuy, []);
      const data1 = await productions.getProduction(id1);
      const data2 = await productions.getProduction(id2);

      // when
      const balance1 = await token.getTokenBalances(investor1.address);
      const balance2 = await token.getTokenBalances(investor2.address);
      const balance3 = await token.getTokenBalances(approver.address);
      const tokens1 = await token.getTokenOwners(id1);
      const tokens2 = await token.getTokenOwners(id2);
      const tokens3 = await token.getTokenOwners(id2 + 100);

      // then
      expect(balance1[0].map((b) => b.toNumber())).to.be.deep.equal([id1, id2]);
      expect(balance1[1].map((b) => b.toNumber())).to.be.deep.equal([tokensToBuy, tokensToBuy]);
      expect(balance2[0].map((b) => b.toNumber())).to.be.deep.equal([id1, id2]);
      expect(balance2[1].map((b) => b.toNumber())).to.be.deep.equal([tokensToBuy * 2, tokensToBuy]);
      expect(balance3[0].length).to.be.equal(0);
      expect(balance3[1].length).to.be.equal(0);
      expect(tokens1[0]).to.be.deep.equal([data1.escrow, investor1.address, investor2.address]);
      expect(tokens1[1].map((b) => b.toNumber())).to.be.deep.equal([
        100 - 3 * tokensToBuy,
        tokensToBuy,
        tokensToBuy * 2,
      ]);
      expect(tokens2[0]).to.be.deep.equal([data2.escrow, investor2.address, investor1.address]);
      expect(tokens2[1].map((b) => b.toNumber())).to.be.deep.equal([100 - 2 * tokensToBuy, tokensToBuy, tokensToBuy]);
      expect(tokens3[0].length).to.be.equal(0);
      expect(tokens3[1].length).to.be.equal(0);
    });
  });

  // --------------------------- BUY WITH MATIC ---------------------------

  describe('Buy tokens with native currency', () => {
    it('buys tokens with native currency', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const tokensToBuy = 10;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);

      // when
      await productions
        .connect(investor1)
        .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 0, { value: swapPrice });

      // then
      const balance = await token.balanceOf(investor1.address, id);
      expect(balance).to.be.equal(tokensToBuy);
      const escrow = (await productions.getProduction(id)).escrow;
      const balanceEscrow = await (await attachToken(usdt)).balanceOf(escrow);
      expect(balanceEscrow).to.be.equal(price[1]);
    });

    it('rejects buying tokens when sending not enough native currency', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const tokensToBuy = 10;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);

      // when
      await expect(
        productions
          .connect(investor1)
          .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 0, { value: swapPrice - 10000n })
      ).to.be.revertedWith('STF');

      // then
      const balance = await token.balanceOf(investor1.address, id);
      expect(balance).to.be.equal(0);
    });

    it('refunds Matic when sending over price', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const tokensToBuy = 3;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);

      // when
      await expect(
        await productions
          .connect(investor1)
          .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 0, { value: swapPrice * 2n })
      ).to.changeEtherBalance(investor1, -swapPrice);

      // then
      const balance = await token.balanceOf(investor1.address, id);
      expect(balance).to.be.equal(3);
    });
  });

  // --------------------------- BUY WITH TOKENS ---------------------------

  describe('Buy tokens with stable coins', () => {
    it('buys tokens with target token', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const tokensToBuy = 8;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await buyToken(price[0], price[1].toBigInt(), swapPrice, investor1);

      // when
      await (await attachToken(price[0])).connect(investor1).approve(productions.address, price[1]);
      await productions.connect(investor1).buyTokensWithTokens(id, investor1.address, tokensToBuy, 0);

      // then
      const balance = await token.balanceOf(investor1.address, id);
      expect(balance).to.be.equal(tokensToBuy);
      const escrow = (await productions.getProduction(id)).escrow;
      const balanceEscrow = await (await attachToken(usdt)).balanceOf(escrow);
      expect(balanceEscrow).to.be.equal(price[1]);
    });

    it('rejects buying tokens with too low balance', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const tokensToBuy = 5;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
      const priceTooLow = price[1].toBigInt() - 1000n;
      const swapPrice = await getQuote(price[0], priceTooLow, 1337);
      await buyToken(price[0], priceTooLow, swapPrice, owner);

      // when
      await (await attachToken(price[0])).connect(investor1).approve(productions.address, priceTooLow);
      await expect(
        productions.connect(investor1).buyTokensWithTokens(id, investor1.address, tokensToBuy, 0)
      ).to.be.revertedWith('Insufficient allowance');

      // then
      const balance = await token.balanceOf(investor1.address, id);
      expect(balance).to.be.equal(0);
    });
  });

  // --------------------------- BUY WITH FIAT / RELAY ---------------------------

  describe('Buy tokens over relay (meta transactions)', () => {
    it('buys tokens after fiat payment over relay', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const tokensToBuy = 5;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await buyToken(price[0], price[1].toBigInt(), swapPrice, owner);

      // when
      await (await attachToken(price[0])).connect(owner).approve(productions.address, price[1]);
      await productions.connect(owner).buyTokensWithFiat(id, investor1.address, tokensToBuy, 0);

      // then
      const balance = await token.balanceOf(investor1.address, id);
      expect(balance).to.be.equal(tokensToBuy);
      const escrow = (await productions.getProduction(id)).escrow;
      const balanceEscrow = await (await attachToken(usdt)).balanceOf(escrow);
      expect(balanceEscrow).to.be.equal(price[1]);
    });

    it('rejects buying tokens from untrusted relay', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const tokensToBuy = 5;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await buyToken(price[0], price[1].toBigInt(), swapPrice, owner);

      // when
      await expect(
        productions.connect(approver).buyTokensWithFiat(id, investor1.address, tokensToBuy, 0)
      ).to.be.revertedWith('Invalid token buyer');

      // then
      const balance = await token.balanceOf(investor1.address, id);
      expect(balance).to.be.equal(0);
    });
  });

  // --------------------------- PERKS ------------------------------

  describe('Buy with perks', () => {
    it('buys tokens with perk', async () => {
      // given
      const perkTracker = await getContract('PerkTrackerTest');
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(
          100,
          10n ** 6n,
          [
            { minTokensRequired: 1, total: 10 },
            { minTokensRequired: 5, total: 5 },
            { minTokensRequired: 10, total: 1 },
          ],
          0,
          USDT(1337),
          '',
          0,
          0,
          10,
          0,
          perkTracker.address
        )
      );
      const tokensToBuy = 10;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);

      // when
      await expect(
        productions
          .connect(investor1)
          .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 3, { value: swapPrice })
      )
        .to.emit(perkTracker, 'PerkClaimed')
        .withArgs(investor1.address, id, 3, tokensToBuy);

      // then
      const { balance, perksOwned, purchases } = await productions.getTokenOwnerData(id, investor1.address);
      expect(balance.toBigInt()).to.be.equal(10n);
      expect(perksOwned.length).to.be.equal(1);
      expect(perksOwned[0].id).to.be.equal(3);
      expect(perksOwned[0].claimed).to.be.equal(1);
      expect(perksOwned[0].minTokensRequired.toBigInt()).to.be.equal(10n);
      expect(purchases.length).to.be.equal(1);
      expect(purchases[0].tokens).to.be.equal(tokensToBuy);
      expect(purchases[0].price).to.be.equal(price[1]);
    });

    it('buys tokens with multiple perks', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n, [
          { minTokensRequired: 1, total: 10 },
          { minTokensRequired: 5, total: 5 },
          { minTokensRequired: 10, total: 1 },
        ])
      );
      const tokensToBuy = 1;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy * 5);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);

      // when
      await productions
        .connect(investor1)
        .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 1, { value: swapPrice });
      await productions
        .connect(investor1)
        .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 1, { value: swapPrice });
      await productions
        .connect(investor1)
        .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 1, { value: swapPrice });

      // then
      const { balance, perksOwned, proceedsClaimed, proceedsAvailable } = await productions.getTokenOwnerData(
        id,
        investor1.address
      );
      expect(balance.toBigInt()).to.be.equal(3n);
      expect(perksOwned.length).to.be.equal(1);
      expect(perksOwned[0].id).to.be.equal(1);
      expect(perksOwned[0].claimed).to.be.equal(3);
      expect(perksOwned[0].minTokensRequired.toBigInt()).to.be.equal(1n);
      expect(proceedsClaimed).to.be.equal(0);
      expect(proceedsAvailable).to.be.equal(0);
    });

    it('rejects buying when purchase not high enough for selected perk', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n, [
          { minTokensRequired: 1, total: 10 },
          { minTokensRequired: 5, total: 5 },
          { minTokensRequired: 10, total: 1 },
        ])
      );
      const tokensToBuy = 1;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy * 5);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);

      // when
      await expect(
        productions
          .connect(investor1)
          .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 3, { value: swapPrice })
      ).to.be.revertedWith('Not enough tokens to claim');
    });

    it('rejects buying with non-existing perk', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n, [
          { minTokensRequired: 1, total: 10 },
          { minTokensRequired: 5, total: 5 },
          { minTokensRequired: 10, total: 1 },
        ])
      );
      const tokensToBuy = 1;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy * 5);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);

      // when
      await expect(
        productions
          .connect(investor1)
          .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 5, { value: swapPrice })
      ).to.be.revertedWith('Invalid perk');
    });

    it('rejects buying when perk sold out', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n, [{ minTokensRequired: 1, total: 1 }])
      );
      const tokensToBuy = 1;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy * 3);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);

      // when
      productions.connect(investor1).buyTokensWithCurrency(id, investor1.address, tokensToBuy, 1, { value: swapPrice });
      await expect(
        productions
          .connect(investor1)
          .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 1, { value: swapPrice })
      ).to.be.revertedWith('Perk not available');
    });
  });

  // --------------------------- SECURITY CHECKS ---------------------------

  describe('Security and lifecycle checks', () => {
    it('cannot buy tokens directly on escrow', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const escrow = await attachEscrow(productions, id);

      // when
      await expect(escrow.buyTokens(investor1.address, 1, 10n ** 6n, 0)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
      // then
    });

    it('cannot buy tokens on unapproved production', async () => {
      // given
      const id = await createProduction(factory.connect(organizer), newProduction(100, 10n ** 6n));
      const tokensToBuy = 2;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await buyToken(price[0], price[1].toBigInt(), swapPrice, investor1);

      // when
      await (await attachToken(price[0])).connect(investor1).approve(productions.address, price[1]);
      await expect(productions.connect(investor1).buyTokensWithTokens(id, investor1.address, 1, 0)).to.be.revertedWith(
        'Not in required state'
      );
    });

    it('cannot buy tokens on canceled production', async () => {
      // given
      const id = await createProduction(factory.connect(organizer), newProduction(100, 10n ** 6n));
      const tokensToBuy = 2;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await buyToken(price[0], price[1].toBigInt(), swapPrice, investor1);

      // when
      await productions.connect(approver).decline(id);
      await expect(productions.connect(investor1).buyTokensWithTokens(id, investor1.address, 1, 0)).to.be.revertedWith(
        'Not in required state'
      );
    });

    it('cannot buy tokens for non-existing production', async () => {
      // given
      const id = await createProduction(factory.connect(organizer), newProduction(100, 10n ** 6n));
      const tokensToBuy = 2;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await buyToken(price[0], price[1].toBigInt(), swapPrice, investor1);

      // when
      await (await attachToken(price[0])).connect(investor1).approve(productions.address, price[1]);
      await expect(
        productions.connect(investor1).buyTokensWithTokens(id + 1, investor1.address, 1, 0)
      ).to.be.revertedWith('Production does not exist');
    });

    it('cannot more than token limit for non-investor buyer', async () => {
      // given
      const maxTokensUnknownBuyer = 5;
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n, [], maxTokensUnknownBuyer)
      );
      const buyer = approver;
      const tokensToBuy = maxTokensUnknownBuyer + 1;
      const price = await productions.connect(buyer).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await buyToken(price[0], price[1].toBigInt(), swapPrice, buyer);

      // when
      await (await attachToken(price[0])).connect(buyer).approve(productions.address, price[1]);
      await expect(
        productions.connect(approver).buyTokensWithTokens(id, buyer.address, tokensToBuy, 0)
      ).to.be.revertedWith('Needs investor role to buy amount of tokens');
    });
  });
});
