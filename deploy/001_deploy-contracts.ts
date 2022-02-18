import { ethers } from 'hardhat';
import { StaxeEscrowFactory, StaxeProductions, StaxeProductionToken, StaxeDAOToken, StaxeMembers } from '../typechain';

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import deployments from './deployments.json';

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [owner, treasury] = await ethers.getSigners();
  console.log(`Deploying as ${owner.address}`);
  const chainId = await hre.getChainId();
  const contract = deployments.contracts.filter((contract) => contract.chainId === chainId);
  const treasuryByChainId = contract[0]?.treasury || treasury.address;
  console.log(`Deploying to chainId=${chainId} with treasury=${treasuryByChainId}`);

  // Tokens
  const daoTokenFactory = await ethers.getContractFactory('StaxeDAOToken');
  const daoToken = (await daoTokenFactory.deploy(treasuryByChainId, 1_000_000, 1_000_000)) as StaxeDAOToken;
  await daoToken.deployed();
  console.log(`StaxeDAOToken deployed to ${daoToken.address} with treasury ${treasuryByChainId}`);

  const tokenFactory = await ethers.getContractFactory('StaxeProductionToken');
  const token = (await tokenFactory.deploy()) as StaxeProductionToken;
  await token.deployed();
  console.log(`StaxeProductionToken deployed to ${token.address}`);

  // Members
  const membersFactory = await ethers.getContractFactory('StaxeMembers');
  const members = (await membersFactory.deploy(daoToken.address)) as StaxeMembers;
  console.log(`StaxeMembers deployed to ${members.address}`);

  // Escrow Factory
  const escrowFactory = await ethers.getContractFactory('StaxeEscrowFactory');
  const factory = (await escrowFactory.deploy()) as StaxeEscrowFactory;
  await factory.deployed();

  // Productions
  const productionsFactory = await ethers.getContractFactory('StaxeProductions');
  const productions = (await productionsFactory.deploy(
    token.address,
    factory.address,
    members.address,
    treasuryByChainId
  )) as StaxeProductions;
  await productions.deployed();
  console.log(`StaxeProductions deployed to ${productions.address} with treasury ${treasuryByChainId}`);

  // Token
  await token.grantRole(await token.MINTER_ROLE(), productions.address);
};

module.exports = main;
module.exports.tags = ['develop', 'test', 'prod'];
