import { ethers } from 'hardhat';
import { StaxeEvents } from '../typechain';

async function assignRole(events: StaxeEvents, roleBytes: string, address: string, roleName: string) {
  const hasRole = await events.hasRole(roleBytes, address);
  if (!hasRole) {
    await events.grantRole(roleBytes, address);
    console.log(`Granted ${roleName} role to ${address}`);
  } else {
    console.log(`Skipping address ${address} as address has already ${roleName} role`);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying contracts account:', deployer.address);
  console.log('Account balance:', (await deployer.getBalance()).toString());

  // Events
  const eventsFactory = await ethers.getContractFactory('StaxeEvents');
  const events = (await eventsFactory.attach('0xC9306EaEfD8D604d52833e82f7B81B65C87fA44e')) as StaxeEvents;
  console.log(`StaxeEvents attached to ${events.address}`);

  // Users
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
    '0xafe84Eb73De8CA0129dcEC594A3a945dF88594e2',
    '0x51C03CD4eA6923023d560088acA94Bc867337BA9',
    '0xED298690a98cEFcf8792b63A821Ff8a64386f6Cb',
    '0xeeb83ebf45978d1d1A277398D74EB72CBF0ea98A',
    '0xa4c5502D3Aafdd44155F750D7BeE023347CfD819',
    '0x1d4600D945fD428A6933c94a5D704573627793D7',
    '0x9647737ffF0448a2225dc8cDdaD88127480f517F',
    '0x968bf178bFA8fDdeE87D4aA4DC83F5eAd9bf9F2C',
  ];
  const approvers = [
    '0xAa2201E89A21d0B5398e57Da3789961e2515c647',
    '0x723265936ec47139d543c63f081dE65e587cF5c1',
    '0xef5c870723Af027274a09610546ffC55D6eB117f',
  ];

  for (const organizer of organizers) {
    await assignRole(events, await events.ORGANIZER_ROLE(), organizer, 'Organizer');
  }
  for (const investor of investors) {
    await assignRole(events, await events.INVESTOR_ROLE(), investor, 'Investor');
  }
  for (const approver of approvers) {
    await assignRole(events, await events.APPROVER_ROLE(), approver, 'Approver');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
