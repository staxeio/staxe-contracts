import { expect } from 'chai';
import { StaxeProductionsFactoryV3, StaxeProductionsV3, StaxeProductionTokenV3 } from '../../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { attachToken, createAndApproveProduction, harness, newProduction } from '../utils/harness';
import { USDT } from '../../utils/swap';
import { buyToken, getQuote } from '../utils/uniswap';

describe('StaxeProductionsV3: buy tokens', () => {
  // contracts
  let token: StaxeProductionTokenV3;
  let productions: StaxeProductionsV3;
  let factory: StaxeProductionsFactoryV3;

  // actors
  let approver: SignerWithAddress;
  let organizer: SignerWithAddress;
  let investor1: SignerWithAddress;

  const usdt = USDT(1337) as string;

  beforeEach(async () => {
    ({ token, productions, factory, approver, organizer, investor1 } = await harness());
  });

  it('buys tokens with native currency', async () => {
    // given
    const id = await createAndApproveProduction(
      factory.connect(organizer),
      newProduction(100, 10n ** 6n),
      productions.connect(approver)
    );
    const tokensToBuy = 10;
    const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
    const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);

    // when
    await productions
      .connect(investor1)
      .buyTokensWithCurrency(id, investor1.address, tokensToBuy, { value: swapPrice });

    // then
    const balance = await token.balanceOf(investor1.address, 1);
    expect(balance).to.be.equal(tokensToBuy);
    const escrow = (await productions.getProduction(id)).escrow;
    const balanceEscrow = await (await attachToken(usdt)).balanceOf(escrow);
    expect(balanceEscrow).to.be.equal(price[1]);
  });

  it('buys tokens with target token', async () => {
    // given
    const id = await createAndApproveProduction(
      factory.connect(organizer),
      newProduction(100, 10n ** 6n),
      productions.connect(approver)
    );
    const tokensToBuy = 10;
    const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
    const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
    await buyToken(price[0], price[1].toBigInt(), swapPrice, investor1);

    // when
    await (await attachToken(price[0])).connect(investor1).approve(productions.address, price[1]);
    await productions.connect(investor1).buyTokensWithTokens(id, investor1.address, tokensToBuy);

    // then
    const balance = await token.balanceOf(investor1.address, 1);
    expect(balance).to.be.equal(tokensToBuy);
    const escrow = (await productions.getProduction(id)).escrow;
    const balanceEscrow = await (await attachToken(usdt)).balanceOf(escrow);
    expect(balanceEscrow).to.be.equal(price[1]);
  });
});
