// @ts-ignore
import { ethers } from 'hardhat';
import { EventEscrowFactory, StaxeEvents, StaxeEventToken } from '../typechain';

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // Token
  const tokenFactory = await ethers.getContractFactory('StaxeEventToken');
  const token = (await tokenFactory.deploy()) as StaxeEventToken;
  await token.deployed();
  console.log(`StaxeEventToken deployed to ${token.address}`);

  // Escrow Factory
  const escrowFactory = await ethers.getContractFactory('EventEscrowFactory');
  const factory = (await escrowFactory.deploy()) as EventEscrowFactory;
  await factory.deployed();

  // Events
  const eventsFactory = await ethers.getContractFactory('StaxeEvents');
  const events = (await eventsFactory.deploy(token.address, factory.address)) as StaxeEvents;
  await events.deployed();
  console.log(`StaxeEvents deployed to ${events.address}`);

  // Token
  await token.grantRole(await token.MINTER_ROLE(), events.address);
};

module.exports = main;
module.exports.tags = ['develop', 'test', 'prod'];
