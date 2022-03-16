import { ethers } from 'hardhat';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { StaxeMembers } from '../typechain';

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import deployments from './deployments.json';

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying contracts account:', deployer.address);
  console.log('Account balance:', (await deployer.getBalance()).toString());

  const chainId = +(await hre.getChainId());
  const contract = deployments.contracts.filter((contract) => contract.chainId === chainId)[0];
  console.log('Working with chainId:', chainId);

  // Members
  const membersFactory = await ethers.getContractFactory('StaxeMembers');
  const members = (await membersFactory.attach(contract.members)) as StaxeMembers;
  console.log(`StaxeMembers attached to ${members.address}`);

  // Users
  const admins = ['0x47d99A63D7135E30b626209FEeabB91cF464A905'];
  const organizers = [admins[0], '0xf66342abe568291a35Fd80Fe8B33162341e66adD'];
  const investors = [
    admins[0],
    '0x3f41799963DE3bFd28802a3F9458f4E5222b522C',
    '0x9cd54Bc67088715734e10D45B146D472CA0582Ad',
  ];
  const approvers = [admins[0], '0xf66342abe568291a35Fd80Fe8B33162341e66adD'];

  for (const admin of admins) {
    await members.grantRole(await members.DEFAULT_ADMIN_ROLE(), admin);
    console.log('Granted admin role to:', admin);
  }
  for (const organizer of organizers) {
    await members.grantRole(await members.ORGANIZER_ROLE(), organizer);
    console.log('Granted organizer role to:', organizer);
  }
  for (const investor of investors) {
    await members.grantRole(await members.INVESTOR_ROLE(), investor);
    console.log('Granted investor role to:', investor);
  }
  for (const approver of approvers) {
    await members.grantRole(await members.APPROVER_ROLE(), approver);
    console.log('Granted approver role to:', approver);
  }
};

module.exports = main;
module.exports.tags = ['develop'];
