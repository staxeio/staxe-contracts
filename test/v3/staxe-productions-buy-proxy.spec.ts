import { expect } from 'chai';
import {
  MinimalForwarder,
  StaxeProductionsFactoryV3,
  StaxeProductionsV3,
  StaxeProductionTokenV3,
  StaxePurchaseProxyV3,
} from '../../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { attachToken, createAndApproveProduction, harness, newProduction } from '../utils/harness';
import { DAI, USDT } from '../../utils/swap';
import { buyToken, getQuote } from '../utils/uniswap';
import { getContract } from '../../utils/deployment';
import { signMetaTxRequest } from '../../utils/signer';

describe('StaxeProductionsV3: buy tokens', () => {
  // contracts
  let token: StaxeProductionTokenV3;
  let productions: StaxeProductionsV3;
  let factory: StaxeProductionsFactoryV3;
  let purchaseProxy: StaxePurchaseProxyV3;

  // actors
  let owner: SignerWithAddress;
  let approver: SignerWithAddress;
  let organizer: SignerWithAddress;
  let investor1: SignerWithAddress;
  let investor2: SignerWithAddress;

  const dai = DAI(1337) as string;

  beforeEach(async () => {
    ({
      token,
      productions,
      factory,
      transakProxy: purchaseProxy,
      owner,
      approver,
      organizer,
      investor1,
      investor2,
    } = await harness());
  });

  // --------------------------- BUY WITH TOKENS ---------------------------

  describe('Buy tokens with gasles purchase and proxy', () => {
    it('buys tokens with placing a purchase and then deposit', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 18n, [], 0, dai)
      );
      const transakOne = investor1;
      const tokensToBuy = 7;
      const price = await productions.connect(investor2).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await buyToken(price[0], 2n * price[1].toBigInt(), 3n * swapPrice, transakOne);

      const forwarder = ((await getContract('MinimalForwarder')) as MinimalForwarder).connect(owner);
      const { request, signature } = await signMetaTxRequest(owner.provider, forwarder, {
        from: investor2.address,
        to: purchaseProxy.address,
        data: purchaseProxy.interface.encodeFunctionData('placePurchase', [id, tokensToBuy, 0]),
      });

      // when
      await forwarder.execute(request, signature);

      // when
      await (await attachToken(price[0])).connect(transakOne).approve(purchaseProxy.address, price[1].toBigInt());
      await purchaseProxy.connect(transakOne).depositTo(investor2.address, price[1].toBigInt(), price[0]);

      // then
      const balance = await token.balanceOf(investor2.address, id);
      expect(balance).to.be.equal(tokensToBuy);
      const escrow = (await productions.getProduction(id)).escrow;
      const balanceEscrow = await (await attachToken(dai)).balanceOf(escrow);
      expect(balanceEscrow).to.be.equal(price[1]);
    });

    it('buys tokens with a deposit and then purchase', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 18n, [], 0, dai)
      );
      const transakOne = investor1;
      const tokensToBuy = 7;
      const price = await productions.connect(investor2).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await buyToken(price[0], 2n * price[1].toBigInt(), 3n * swapPrice, transakOne);

      // when
      await (await attachToken(price[0])).connect(transakOne).approve(purchaseProxy.address, price[1].toBigInt());
      await purchaseProxy.connect(transakOne).depositTo(investor2.address, price[1].toBigInt(), price[0]);

      const forwarder = ((await getContract('MinimalForwarder')) as MinimalForwarder).connect(owner);
      const { request, signature } = await signMetaTxRequest(owner.provider, forwarder, {
        from: investor2.address,
        to: purchaseProxy.address,
        data: purchaseProxy.interface.encodeFunctionData('purchase', [id, tokensToBuy, 0]),
      });

      // when
      await forwarder.execute(request, signature);

      // then
      const balance = await token.balanceOf(investor2.address, id);
      expect(balance).to.be.equal(tokensToBuy);
      const escrow = (await productions.getProduction(id)).escrow;
      const balanceEscrow = await (await attachToken(dai)).balanceOf(escrow);
      expect(balanceEscrow).to.be.equal(price[1]);
    });

    it('ignores purchase on deposit if balance too low to buy', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 18n, [], 0, dai)
      );
      const transakOne = investor1;
      const tokensToBuy = 10;
      const price = await productions.connect(investor2).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await buyToken(price[0], 2n * price[1].toBigInt(), 3n * swapPrice, transakOne);

      const forwarder = ((await getContract('MinimalForwarder')) as MinimalForwarder).connect(owner);
      const { request, signature } = await signMetaTxRequest(owner.provider, forwarder, {
        from: investor2.address,
        to: purchaseProxy.address,
        data: purchaseProxy.interface.encodeFunctionData('placePurchase', [id, tokensToBuy, 0]),
      });

      // when
      await forwarder.execute(request, signature);

      // when
      await (await attachToken(price[0])).connect(transakOne).approve(purchaseProxy.address, price[1].toBigInt() - 1n);
      await purchaseProxy.connect(transakOne).depositTo(investor2.address, price[1].toBigInt() - 1n, price[0]);

      // then
      const balance = await token.balanceOf(investor2.address, id);
      expect(balance).to.be.equal(0);
      const escrow = (await productions.getProduction(id)).escrow;
      const balanceEscrow = await (await attachToken(dai)).balanceOf(escrow);
      expect(balanceEscrow).to.be.equal(0);
    });

    it('fails purchase if balance too low', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 18n, [], 0, dai)
      );
      const transakOne = investor1;
      const tokensToBuy = 2;
      const price = await productions.connect(investor2).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await buyToken(price[0], 2n * price[1].toBigInt(), 3n * swapPrice, transakOne);

      // when
      await (await attachToken(price[0]))
        .connect(transakOne)
        .approve(purchaseProxy.address, price[1].toBigInt() - 1000000n);
      await purchaseProxy.connect(transakOne).depositTo(investor2.address, price[1].toBigInt() - 1000000n, price[0]);

      const forwarder = ((await getContract('MinimalForwarder')) as MinimalForwarder).connect(owner);
      const { request, signature } = await signMetaTxRequest(owner.provider, forwarder, {
        from: investor2.address,
        to: purchaseProxy.address,
        data: purchaseProxy.interface.encodeFunctionData('purchase', [id, tokensToBuy * 10, 0]),
      });

      // when
      await forwarder.execute(request, signature);

      // then
      const balance = await token.balanceOf(investor2.address, id);
      expect(balance).to.be.equal(0);
    });
  });

  describe('Withdraw deposit if not needed', () => {
    it('withdraws after deposit', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 18n, [], 0, dai)
      );
      const transakOne = investor1;
      const tokensToBuy = 4;
      const price = await productions.connect(investor2).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await buyToken(price[0], 2n * price[1].toBigInt(), 3n * swapPrice, transakOne);

      // when
      await (await attachToken(price[0])).connect(transakOne).approve(purchaseProxy.address, price[1].toBigInt());
      await purchaseProxy.connect(transakOne).depositTo(investor2.address, price[1].toBigInt(), price[0]);
      const balanceWrapper = await purchaseProxy.balanceOf(investor2.address);

      const forwarder = ((await getContract('MinimalForwarder')) as MinimalForwarder).connect(owner);
      const { request, signature } = await signMetaTxRequest(owner.provider, forwarder, {
        from: investor2.address,
        to: purchaseProxy.address,
        data: purchaseProxy.interface.encodeFunctionData('withdraw', [price[1].toBigInt()]),
      });

      // when
      await forwarder.execute(request, signature);

      // then
      expect(balanceWrapper).to.be.equal(price[1].toBigInt());
      expect(await purchaseProxy.balanceOf(investor2.address)).to.be.equal(0);
      const balance = await (await attachToken(price[0])).balanceOf(investor2.address);
      expect(balance).to.be.equal(price[1].toBigInt());
    });

    it('withdraws all after deposit', async () => {
      // given
      const id = await createAndApproveProduction(
        factory.connect(organizer),
        productions.connect(approver),
        newProduction(100, 10n ** 18n, [], 0, dai)
      );
      const transakOne = investor1;
      const tokensToBuy = 8;
      const price = await productions.connect(investor2).getTokenPrice(id, tokensToBuy);
      const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
      await buyToken(price[0], 2n * price[1].toBigInt(), 3n * swapPrice, transakOne);

      // when
      await (await attachToken(price[0])).connect(transakOne).approve(purchaseProxy.address, price[1].toBigInt());
      await purchaseProxy.connect(transakOne).depositTo(investor2.address, price[1].toBigInt(), price[0]);
      const balanceWrapper = await purchaseProxy.balanceOf(investor2.address);

      const forwarder = ((await getContract('MinimalForwarder')) as MinimalForwarder).connect(owner);
      const { request, signature } = await signMetaTxRequest(owner.provider, forwarder, {
        from: investor2.address,
        to: purchaseProxy.address,
        data: purchaseProxy.interface.encodeFunctionData('withdrawAll'),
      });

      // when
      await forwarder.execute(request, signature);

      // then
      expect(balanceWrapper).to.be.equal(price[1].toBigInt());
      expect(await purchaseProxy.balanceOf(investor2.address)).to.be.equal(0);
      const balance = await (await attachToken(price[0])).balanceOf(investor2.address);
      expect(balance).to.be.equal(price[1].toBigInt());
    });
  });
});
