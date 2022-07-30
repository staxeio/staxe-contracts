import { deployments } from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getContract } from '../utils/deployment';
import { PerkTrackerTest, StaxeProductionsFactoryV3 } from '../typechain';

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await hre.getNamedAccounts();
  const chainId = +(await hre.getChainId());
  const logDeploy = chainId !== 1337;

  // -------------------------------------- CONTRACT DEPLOYMENT --------------------------------------

  // ----- PerkTrackerTest
  const factory = (await getContract('StaxeProductionsFactoryV3')) as StaxeProductionsFactoryV3;
  await deploy('PerkTrackerTest', {
    contract: 'PerkTrackerTest',
    from: deployer,
    log: logDeploy,
    args: [factory.address],
  });
};

module.exports = main;
module.exports.tags = ['develop', 'v3'];
