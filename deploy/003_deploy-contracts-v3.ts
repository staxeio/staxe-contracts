import { ethers, upgrades } from 'hardhat';
import { StaxeProductionsFactoryV3, StaxeMembersV3, StaxeProductionsV3, StaxeProductionTokenV3 } from '../typechain';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { promises as fs } from 'fs';

import deployments from '../deployments/deployments-v3.json';
import { WETH, USDT, DAI } from '../utils/swap';

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [owner, treasury] = await ethers.getSigners();
  console.log(`Deploying as ${owner.address}`);
  const chainId = +(await hre.getChainId());
  const contract = deployments.contracts.filter((contract) => contract.chainId === chainId)[0];
  const treasuryByChainId = contract?.treasury || treasury?.address;
  console.log(`Deploying to chainId=${chainId} with treasury=${treasuryByChainId}`);

  const wethAddress = WETH(chainId);
  const usdtAddress = USDT(chainId);
  const daiAddress = DAI(chainId);

  // -------------------------------------- CONTRACT DEPLOYMENT --------------------------------------

  // ----- Tokens
  const Token = await ethers.getContractFactory('StaxeProductionTokenV3');
  const token = (await Token.deploy()) as StaxeProductionTokenV3;
  await token.deployed();
  console.log(`StaxeProductionTokenV3 deployed to ${token.address}`);

  // ----- Members
  const Members = await ethers.getContractFactory('StaxeMembersV3');
  const members = (await upgrades.deployProxy(Members)) as StaxeMembersV3;
  await members.deployed();
  console.log(`StaxeMembersV3 deployed to ${members.address}`);

  // ----- Productions
  const Productions = await ethers.getContractFactory('StaxeProductionsV3');
  const productions = (await upgrades.deployProxy(
    Productions,
    [token.address, members.address, wethAddress, treasuryByChainId],
    {
      constructorArgs: [contract?.forwarder],
      unsafeAllow: ['constructor'],
    }
  )) as StaxeProductionsV3;
  await productions.deployed();
  console.log(
    `StaxeProductionsV3 deployed to ${productions.address} with treasury=${treasuryByChainId}, forwarder=${contract?.forwarder}`
  );

  // ----- Escrow Factory
  const EscrowFactory = await ethers.getContractFactory('StaxeProductionsFactoryV3');
  const factory = (await EscrowFactory.deploy(productions.address, members.address)) as StaxeProductionsFactoryV3;
  await factory.deployed();
  console.log(`StaxeProductionsFactoryV3 deployed to ${factory.address}`);

  // -------------------------------------- ASSIGN DATA --------------------------------------

  // Token
  await token.grantRole(await token.MINTER_ROLE(), productions.address);

  // Production
  await productions.addTrustedEscrowFactory(factory.address);
  if (usdtAddress) await productions.addTrustedErc20Coin(usdtAddress);
  if (daiAddress) await productions.addTrustedErc20Coin(daiAddress);

  // -------------------------------------- LOG RESULTS --------------------------------------

  if (contract && deployments) {
    contract.token = token.address;
    contract.members = members.address;
    contract.productions = productions.address;
    contract.factory = factory.address;
    contract.owner = owner.address;
    const newContent = JSON.stringify(deployments, null, 2);
    await fs.writeFile(__dirname + '/../deployments/deployments-v3.json', newContent);
  }
};

module.exports = main;
module.exports.tags = ['develop', 'test', 'prod', 'v3'];
