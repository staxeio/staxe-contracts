import { ethers } from 'hardhat';
import { EventEscrowFactory, StaxeEvents, StaxeEventToken } from '../typechain';

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying contracts account:', deployer.address);
  console.log('Account balance:', (await deployer.getBalance()).toString());

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

  // Users
  const admins = ['0xef5c870723Af027274a09610546ffC55D6eB117f'];
  const organizers = [
    '0xAa2201E89A21d0B5398e57Da3789961e2515c647',
    '0x723265936ec47139d543c63f081dE65e587cF5c1',
    '0xef5c870723Af027274a09610546ffC55D6eB117f',
  ];
  const investors = [
    '0xb079B2Ae3edE893AB8223EBf9F3fF38EE4BAcA4A',
    '0xe948a813bb8808dfd5fbd41ee072e3badd076fd3',
    '0xaCBcf5d2970EEF25F02a27E9d9cd31027B058B9b',
    '0xef5c870723Af027274a09610546ffC55D6eB117f',
  ];
  const approvers = [
    '0xAa2201E89A21d0B5398e57Da3789961e2515c647',
    '0x723265936ec47139d543c63f081dE65e587cF5c1',
    '0xef5c870723Af027274a09610546ffC55D6eB117f',
  ];

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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
