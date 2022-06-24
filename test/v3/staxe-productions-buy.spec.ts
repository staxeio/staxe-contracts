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

  const usdt = USDT(1337) as string;

  beforeEach(async () => {
    ({ token, productions, factory, owner, approver, organizer, investor1 } = await harness());
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
        .buyTokensWithCurrency(id, investor1.address, tokensToBuy, { value: swapPrice });

      // then
      const balance = await token.balanceOf(investor1.address, id);
      expect(balance).to.be.equal(tokensToBuy);
      const escrow = (await productions.getProduction(id)).escrow;
      const balanceEscrow = await (await attachToken(usdt)).balanceOf(escrow);
      expect(balanceEscrow).to.be.equal(price[1]);
    });
  });

  /*
    Test cases:
    - Sending not enough funds
    - Sending too much funds (refund unused funds)
    - requesting too many tokens
    - buy non-existing token
    - token limit for non-investor buyer
    - Buying tokens for not-open production
    - Buying tokens for closed production
    - Verify events created
  */

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
      await productions.connect(investor1).buyTokensWithTokens(id, investor1.address, tokensToBuy);

      // then
      const balance = await token.balanceOf(investor1.address, id);
      expect(balance).to.be.equal(tokensToBuy);
      const escrow = (await productions.getProduction(id)).escrow;
      const balanceEscrow = await (await attachToken(usdt)).balanceOf(escrow);
      expect(balanceEscrow).to.be.equal(price[1]);
    });
  });

  /*
    Test cases:
    - Approving not enough tokens
  */

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
      await productions.connect(owner).buyTokensWithFiat(id, investor1.address, tokensToBuy);

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
        productions.connect(approver).buyTokensWithFiat(id, investor1.address, tokensToBuy)
      ).to.be.revertedWith('Only callable from forwarder proxy');

      // then
      const balance = await token.balanceOf(investor1.address, id);
      expect(balance).to.be.equal(0);
    });
  });

  /*
    Test cases:
    - Buy from non-approved forwarder
  */

  // --------------------------- SECURITY CHECKS ---------------------------

  describe('Security and lifecycle checks', () => {
    it('Cannot buy tokens directly on escrow', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 6n)
      );
      const escrow = await attachEscrow(productions, id);

      // when
      await expect(escrow.buyTokens(investor1.address, 1, 10n ** 6n)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
      // then
    });

    it('Cannot buy tokens on unapproved production', async () => {
      // given
      const id = await createProduction(factory.connect(organizer), newProduction(100, 10n ** 6n));
      const tokensToBuy = 2;
      const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await buyToken(price[0], price[1].toBigInt(), swapPrice, investor1);

      // when
      await (await attachToken(price[0])).connect(investor1).approve(productions.address, price[1]);
      await expect(productions.connect(investor1).buyTokensWithTokens(id, investor1.address, 1)).to.be.revertedWith(
        'Not in required state'
      );
    });
  });
});
