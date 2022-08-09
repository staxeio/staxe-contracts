import { ethers, deployments } from 'hardhat';
import { StaxeProductionsV3, StaxeProductionTokenV3 } from '../typechain';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { promises as fs } from 'fs';

import deploymentSettings from '../deployments/deployments-v3.json';
import { WETH, USDT, DAI } from '../utils/swap';
import { getContract } from '../utils/deployment';

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy, log } = deployments;
  const { deployer } = await hre.getNamedAccounts();
  const [owner, treasury] = await ethers.getSigners();
  log(`Deploying as ${owner.address}`);
  const chainId = +(await hre.getChainId());
  const contract = deploymentSettings.contracts.filter((contract) => contract.chainId === chainId)[0];
  const treasuryByChainId = contract?.treasury || treasury?.address;
  const logDeploy = chainId !== 1337;
  log(`Deploying to chainId=${chainId} with treasury=${treasuryByChainId}`);

  const wethAddress = WETH(chainId);
  const usdtAddress = USDT(chainId);
  const daiAddress = DAI(chainId);

  // -------------------------------------- CONTRACT DEPLOYMENT --------------------------------------

  // ----- Tokens
  const tokenDeployment = await deploy('StaxeProductionTokenV3', {
    contract: 'StaxeProductionTokenV3',
    from: deployer,
    log: logDeploy,
    args: [],
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [],
      },
    },
  });
  log(`StaxeProductionTokenV3 deployed to ${tokenDeployment.address}`);

  // ----- Members
  const membersDeployment = await deploy('StaxeMembersV3', {
    contract: 'StaxeMembersV3',
    from: deployer,
    log: logDeploy,
    args: [contract?.forwarder],
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [],
      },
    },
  });
  log(`StaxeMembersV3 deployed to ${membersDeployment.address}`);

  // ----- Productions
  const productionsDeployment = await deploy('StaxeProductionsV3', {
    contract: 'StaxeProductionsV3',
    from: deployer,
    log: logDeploy,
    args: [contract?.forwarder],
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [tokenDeployment.address, membersDeployment.address, wethAddress, treasuryByChainId],
      },
    },
  });
  log(
    `StaxeProductionsV3 deployed to ${productionsDeployment.address} with treasury=${treasuryByChainId}, forwarder=${contract?.forwarder}`
  );

  // ----- Escrow Factory with Calculation Engine
  const calculationEngineDeployment = await deploy('StaticPriceCalculationEngine', {
    contract: 'StaticPriceCalculationEngine',
    from: deployer,
    log: logDeploy,
    args: [],
  });
  log(`StaticPriceCalculationEngine deployed to ${calculationEngineDeployment.address}`);

  const factoryDeployment = await deploy('StaxeProductionsFactoryV3', {
    contract: 'StaxeProductionsFactoryV3',
    from: deployer,
    log: logDeploy,
    args: [productionsDeployment.address, membersDeployment.address, calculationEngineDeployment.address],
  });
  log(`StaxeProductionsFactoryV3 deployed to ${factoryDeployment.address}`);

  // -------------------------------------- ASSIGN DATA --------------------------------------

  // Token
  const token = (await getContract('StaxeProductionTokenV3')) as StaxeProductionTokenV3;
  const isMinter = await token.hasRole(await token.MINTER_ROLE(), productionsDeployment.address);
  if (!isMinter) {
    await (await token.grantRole(await token.MINTER_ROLE(), productionsDeployment.address)).wait();
  }

  // Production
  const productions = (await getContract('StaxeProductionsV3')) as StaxeProductionsV3;
  if (!(await productions.trustedEscrowFactories(factoryDeployment.address))) {
    await (await productions.addTrustedEscrowFactory(factoryDeployment.address)).wait();
  }
  if (usdtAddress && !(await productions.trustedErc20Coins(usdtAddress))) {
    await (await productions.addTrustedErc20Coin(usdtAddress)).wait();
  }
  if (daiAddress && !(await productions.trustedErc20Coins(daiAddress))) {
    await (await productions.addTrustedErc20Coin(daiAddress)).wait();
  }

  // -------------------------------------- LOG RESULTS --------------------------------------

  if (contract && deploymentSettings) {
    contract.token = token.address;
    contract.members = membersDeployment.address;
    contract.productions = productionsDeployment.address;
    contract.factory = factoryDeployment.address;
    contract.owner = owner.address;
    const newContent = JSON.stringify(deploymentSettings, null, 2);
    await fs.writeFile(__dirname + '/../deployments/deployments-v3.json', newContent);
  }
};

module.exports = main;
module.exports.tags = ['develop', 'test', 'prod', 'v3'];
