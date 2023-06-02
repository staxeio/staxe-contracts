import { ethers, getChainId } from 'hardhat';
import { newProduction } from '../test/utils/harness';
import { StaxeProductionsFactoryV3, StaxeProductionsV3 } from '../typechain';
import { getContract } from '../utils/deployment';
import { DAI /*, USDC*/, USDT, cEUR } from '../utils/swap';

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = +(await getChainId());
  console.log(`Deploying contracts account: ${deployer.address}, chainId: ${chainId}`);

  // -> 100 tokens for 0.001 USDC/DAI per token, 3 perks
  const production = newProduction(
    100,
    chainId === 5 || chainId === 44787
      ? 1n * 10n ** (18n - 3n) /* DAI / cEUR */
      : 1n * 10n ** (6n - 3n) /* USDC / USDT */,
    [
      { minTokensRequired: 1, total: 10 },
      { minTokensRequired: 5, total: 5 },
      { minTokensRequired: 10, total: 1 },
    ],
    0,
    chainId === 5 ? DAI(chainId) : chainId === 44787 ? cEUR(chainId) : USDT(chainId)
  );

  const productions = (await getContract('StaxeProductionsV3')) as StaxeProductionsV3;
  const factory = (await getContract('StaxeProductionsFactoryV3')) as StaxeProductionsFactoryV3;

  console.log(`Running with productions=${productions.address}, factory=${factory.address}`);

  const tx = await factory.connect(deployer).createProduction(production);
  const confirmed = await tx.wait();
  const id = confirmed.events?.filter((val) => val.event === 'ProductionCreated').map((val) => val.args?.id)[0];
  await productions.connect(deployer).approve(id);

  console.log('Production created:', id.toNumber(), production);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
