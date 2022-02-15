import { ethers } from 'hardhat';
import { StaxeEscrowFactory, StaxeProductions, StaxeProductionToken, StaxeDAOToken, StaxeMembers } from '../typechain';

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [owner, treasury] = await ethers.getSigners();
  console.log(`Deploying as ${owner.address}`);

  // Tokens
  const daoTokenFactory = await ethers.getContractFactory('StaxeDAOToken');
  const daoToken = (await daoTokenFactory.deploy(treasury.address, 1_000_000, 1_000_000)) as StaxeDAOToken;
  await daoToken.deployed();
  console.log(`StaxeDAOToken deployed to ${daoToken.address} with treasury ${treasury.address}`);

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
    treasury.address
  )) as StaxeProductions;
  await productions.deployed();
  console.log(`StaxeProductions deployed to ${productions.address} with treasury ${treasury.address}`);

  // Token
  await token.grantRole(await token.MINTER_ROLE(), productions.address);
};

module.exports = main;
module.exports.tags = ['develop', 'test', 'prod'];
