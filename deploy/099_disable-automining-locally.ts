import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const chainId = +(await hre.getChainId());
  if (chainId !== 1337) {
    console.error('Not a dev env, exiting');
    return;
  }
  // Disable automining as last step. This allows to have a realistic wait time for transactions on the UI.
  await hre.network.provider.send('evm_setAutomine', [false]);
  await hre.network.provider.send('evm_setIntervalMining', [5000]);
};

module.exports = main;
module.exports.tags = ['ui'];
