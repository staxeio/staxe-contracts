import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { harness, newProduction } from '../test/utils/harness';

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const chainId = +(await hre.getChainId());
  if (chainId !== 1337) {
    console.error('Not a dev env, exiting');
    return;
  }

  const { factory, productions, approver, organizer } = await harness();

  const production = newProduction(100, 1n * 10n ** 6n, [
    { minTokensRequired: 1, total: 10 },
    { minTokensRequired: 5, total: 5 },
    { minTokensRequired: 10, total: 1 },
  ]);

  const tx = await factory.connect(organizer).createProduction(production);
  const confirmed = await tx.wait();
  const id = confirmed.events?.filter((val) => val.event === 'ProductionCreated').map((val) => val.args?.id)[0];
  await productions.connect(approver).approve(id);

  console.log('Production created:', id.toNumber(), production);
};

module.exports = main;
module.exports.tags = ['ui'];
