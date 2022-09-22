import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { harness, newProduction } from '../test/utils/harness';
import { buyToken, getQuote } from '../test/utils/uniswap';
import { DAI } from '../utils/swap';
import { BigNumber } from 'ethers';

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const chainId = +(await hre.getChainId());
  if (chainId !== 1337) {
    console.error('Not a dev env, exiting');
    return;
  }

  const { factory, productions, owner, approver, investor1, organizer } = await harness();

  const production = newProduction(
    100,
    // 1n * 10n ** 6n, // USDT
    1n * 10n ** 18n, // DAI
    [
      { minTokensRequired: 1, total: 10 },
      { minTokensRequired: 5, total: 5 },
      { minTokensRequired: 10, total: 1 },
    ],
    0,
    DAI(chainId)
  );

  const tx = await factory.connect(organizer).createProduction(production);
  const confirmed = await tx.wait();
  const id = confirmed.events?.filter((val) => val.event === 'ProductionCreated').map((val) => val.args?.id)[0];
  await productions.connect(approver).approve(id);

  console.log('Production created:', id.toNumber(), production);
  const tokensToBuy = 10;
  const price = await productions.connect(investor1).getTokenPrice(id, tokensToBuy);
  const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
  const tx2 = await productions
    .connect(investor1)
    .buyTokensWithCurrency(id, investor1.address, tokensToBuy, 3, { value: swapPrice });
  await tx2.wait();
  console.log(`Investor ${investor1.address} bought ${tokensToBuy} tokens`);

  await investor1.sendTransaction({
    to: '0xef5c870723Af027274a09610546ffC55D6eB117f',
    value: BigNumber.from('100000000000000000000'),
  });

  const priceAll = await productions.connect(owner).getTokenPrice(id, 100);
  const swapPriceAll = await getQuote(priceAll[0], priceAll[1].toBigInt(), 1337);
  await buyToken(priceAll[0], priceAll[1].toBigInt(), swapPriceAll, owner);
};

module.exports = main;
module.exports.tags = ['ui'];
