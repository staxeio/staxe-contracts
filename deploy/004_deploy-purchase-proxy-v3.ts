import { ethers, deployments } from 'hardhat';
import { StaxeForwarder, StaxeMembersV3, StaxeProductionsV3 } from '../typechain';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { promises as fs } from 'fs';

import deploymentSettings from '../deployments/deployments-v3.json';
import { USDC } from '../utils/swap';
import { getContract } from '../utils/deployment';

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy, log } = deployments;
  const { deployer } = await hre.getNamedAccounts();
  const [owner] = await ethers.getSigners();
  log(`Deploying as ${owner.address}`);
  const chainId = +(await hre.getChainId());
  const contract = deploymentSettings.contracts.filter((contract) => contract.chainId === chainId)[0];
  const logDeploy = true;
  log(`Deploying to chainId=${chainId}`);

  const usdcAddress = USDC(chainId);

  // -------------------------------------- CONTRACT DEPLOYMENT --------------------------------------

  const forwarder = (await getContract('StaxeForwarder')) as StaxeForwarder;
  const productions = (await getContract('StaxeProductionsV3')) as StaxeProductionsV3;

  // ----- Staxe Purchase Proxy
  const purchaseProxyDeployment = await deploy('StaxePurchaseProxyV3', {
    contract: 'StaxePurchaseProxyV3',
    from: deployer,
    log: logDeploy,
    args: [forwarder.address],
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [productions.address, usdcAddress],
      },
    },
  });
  log(`StaxePurchaseProxyV3 deployed to ${purchaseProxyDeployment.address}`);

  // -------------------------------------- ASSIGN DATA --------------------------------------

  const members = (await getContract('StaxeMembersV3')) as StaxeMembersV3;
  if (!(await members.hasRole(await members.INVESTOR_ROLE(), purchaseProxyDeployment.address))) {
    await (await members.grantRole(await members.INVESTOR_ROLE(), purchaseProxyDeployment.address)).wait();
  }

  // -------------------------------------- LOG RESULTS --------------------------------------

  if (contract && deploymentSettings) {
    contract.purchaseProxy = purchaseProxyDeployment.address;
    const newContent = JSON.stringify(deploymentSettings, null, 2);
    await fs.writeFile(__dirname + '/../deployments/deployments-v3.json', newContent);
  }
};

module.exports = main;
module.exports.tags = ['develop', 'test', 'v3'];
