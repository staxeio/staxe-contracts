import { ethers, deployments } from 'hardhat';
import { StaxeProductionsV3, StaxeProductionTokenV3 } from '../typechain';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { promises as fs } from 'fs';

import deploymentSettings from '../deployments/deployments-v3.json';
import { WETH, USDT, DAI, USDC, cEUR } from '../utils/swap';
import { getContract } from '../utils/deployment';

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy, log } = deployments;
  const { deployer } = await hre.getNamedAccounts();
  const [owner, treasury] = await ethers.getSigners();
  log(`Deploying as ${owner.address}`);
  const chainId = +(await hre.getChainId());
  const contract = deploymentSettings.contracts.filter((contract) => contract.chainId === chainId)[0];
  const treasuryByChainId = contract?.treasury || treasury?.address;
  const logDeploy = true;
  log(`Deploying to chainId=${chainId} with treasury=${treasuryByChainId}`);

  const wethAddress = WETH(chainId);
  const usdtAddress = USDT(chainId);
  const usdcAddress = USDC(chainId);
  const daiAddress = DAI(chainId);
  const ceurAddress = cEUR(chainId);

  // -------------------------------------- CONTRACT DEPLOYMENT --------------------------------------

  const minimalForwarder = await deploy('StaxeForwarder', {
    contract: 'StaxeForwarder',
    from: deployer,
    log: logDeploy,
    args: [],
  });

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
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [treasuryByChainId, contract.relayer],
      },
    },
  });
  log(`StaxeMembersV3 deployed to ${membersDeployment.address}`);

  // ----- Productions
  const productionsDeployment = await deploy('StaxeProductionsV3', {
    contract: 'StaxeProductionsV3',
    from: deployer,
    log: logDeploy,
    args: [minimalForwarder.address],
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [tokenDeployment.address, membersDeployment.address, wethAddress, treasuryByChainId, contract.relayer],
      },
    },
  });
  log(
    `StaxeProductionsV3 deployed to ${productionsDeployment.address} with treasury=${treasuryByChainId}, forwarder=${minimalForwarder.address}`
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
    log(`Granted minter role to ${productionsDeployment.address} in ${token.address}`);
  }

  // Production
  const productions = (await getContract('StaxeProductionsV3')) as StaxeProductionsV3;
  if (!(await productions.trustedEscrowFactories(factoryDeployment.address))) {
    await (await productions.addTrustedEscrowFactory(factoryDeployment.address)).wait();
    log(`Added trusted escrow factory: ${factoryDeployment.address} to ${productions.address}`);
  }
  if (usdtAddress && !(await productions.trustedErc20Coins(usdtAddress))) {
    await (await productions.addTrustedErc20Coin(usdtAddress)).wait();
    log(`Added USDT as trusted ERC20 token: ${usdtAddress} to ${productions.address}`);
  }
  if (usdcAddress && !(await productions.trustedErc20Coins(usdcAddress))) {
    await (await productions.addTrustedErc20Coin(usdcAddress)).wait();
    log(`Added USDC as trusted ERC20 token: ${usdcAddress} to ${productions.address}`);
  }
  if (daiAddress && !(await productions.trustedErc20Coins(daiAddress))) {
    await (await productions.addTrustedErc20Coin(daiAddress)).wait();
    log(`Added DAI as trusted ERC20 token: ${daiAddress}`);
  }
  if (ceurAddress && !(await productions.trustedErc20Coins(ceurAddress))) {
    await (await productions.addTrustedErc20Coin(ceurAddress)).wait();
    log(`Added DAI as trusted ERC20 token: ${daiAddress}`);
  }

  // -------------------------------------- LOG RESULTS --------------------------------------

  if (contract && deploymentSettings) {
    contract.token = token.address;
    contract.members = membersDeployment.address;
    contract.productions = productionsDeployment.address;
    contract.factory = factoryDeployment.address;
    contract.owner = owner.address;
    contract.forwarder = minimalForwarder.address;
    const newContent = JSON.stringify(deploymentSettings, null, 2);
    await fs.writeFile(__dirname + '/../deployments/deployments-v3.json', newContent);
    log(`Updated deployment addresses: ${JSON.stringify(contract, null, 2)}`);
  }
};

module.exports = main;
module.exports.tags = ['develop', 'test', 'prod', 'v3'];
