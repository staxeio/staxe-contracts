import { ethers } from 'hardhat';
import { StaxeEscrowFactoryV2, StaxeProductionsV2, StaxeProductionTokenV2, StaxeMembersV2 } from '../typechain';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { promises as fs } from 'fs';

import deployments from './deployments-v2.json';

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [owner, treasury] = await ethers.getSigners();
  console.log(`Deploying as ${owner.address}`);
  const chainId = +(await hre.getChainId());
  const contract = deployments.contracts.filter((contract) => contract.chainId === chainId)[0];
  const treasuryByChainId = contract?.treasury || treasury?.address;
  console.log(`Deploying to chainId=${chainId} with treasury=${treasuryByChainId}`);

  // Tokens
  const tokenFactory = await ethers.getContractFactory('StaxeProductionTokenV2');
  const token = (await tokenFactory.deploy()) as StaxeProductionTokenV2;
  await token.deployed();
  console.log(`StaxeProductionToken deployed to ${token.address}`);

  // Members
  const membersFactory = await ethers.getContractFactory('StaxeMembersV2');
  const members = (await membersFactory.deploy()) as StaxeMembersV2;
  console.log(`StaxeMembers deployed to ${members.address}`);

  // Escrow Factory
  const escrowFactory = await ethers.getContractFactory('StaxeEscrowFactoryV2');
  const factory = (await escrowFactory.deploy()) as StaxeEscrowFactoryV2;
  await factory.deployed();
  console.log(`StaxeEscrowFactory deployed to ${factory.address}`);

  // Productions
  const productionsFactory = await ethers.getContractFactory('StaxeProductionsV2');
  const productions = (await productionsFactory.deploy(
    token.address,
    factory.address,
    members.address,
    treasuryByChainId
  )) as StaxeProductionsV2;
  await productions.deployed();
  console.log(`StaxeProductions deployed to ${productions.address} with treasury ${treasuryByChainId}`);

  // Token
  await token.grantRole(await token.MINTER_ROLE(), productions.address);

  if (contract && deployments) {
    contract.token = token.address;
    contract.members = members.address;
    contract.productions = productions.address;
    contract.factory = factory.address;
    contract.owner = owner.address;
    const newContent = JSON.stringify(deployments, null, 2);
    await fs.writeFile(__dirname + '/deployments.json', newContent);
    console.log('Updated contract addresses', newContent);
  }
};

module.exports = main;
module.exports.tags = ['develop'];
