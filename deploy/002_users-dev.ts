import { ethers } from 'hardhat';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { StaxeEvents } from '../typechain';

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying contracts account:', deployer.address);
  console.log('Account balance:', (await deployer.getBalance()).toString());

  // Events
  const eventsFactory = await ethers.getContractFactory('StaxeEvents');
  const events = (await eventsFactory.attach('0x697AD5edAccBd3f9eE45C2Eb73122c9165DcD641')) as StaxeEvents;
  console.log(`StaxeEvents attached to ${events.address}`);

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
    await events.grantRole(await events.DEFAULT_ADMIN_ROLE(), admin);
    console.log('Granted admin role to:', admin);
  }
  for (const organizer of organizers) {
    await events.grantRole(await events.ORGANIZER_ROLE(), organizer);
    console.log('Granted organizer role to:', organizer);
  }
  for (const investor of investors) {
    await events.grantRole(await events.INVESTOR_ROLE(), investor);
    console.log('Granted investor role to:', investor);
  }
  for (const approver of approvers) {
    await events.grantRole(await events.APPROVER_ROLE(), approver);
    console.log('Granted approver role to:', approver);
  }
};

module.exports = main;
module.exports.tags = ['develop'];
