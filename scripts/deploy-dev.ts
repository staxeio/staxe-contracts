import { ethers } from 'hardhat';
import { EventEscrowFactory, StaxeEvents, StaxeEventToken } from '../typechain';

async function main() {
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
  const admin = '0x47d99A63D7135E30b626209FEeabB91cF464A905';
  const organizers = [admin, '0xf66342abe568291a35Fd80Fe8B33162341e66adD'];
  const investors = [admin, '0x3f41799963DE3bFd28802a3F9458f4E5222b522C', '0x9cd54Bc67088715734e10D45B146D472CA0582Ad'];

  await events.grantRole(await events.DEFAULT_ADMIN_ROLE(), admin);
  organizers.forEach(async (address) => {
    await events.grantRole(await events.ORGANIZER_ROLE(), address);
  });
  investors.forEach(async (address) => {
    await events.grantRole(await events.INVESTOR_ROLE(), address);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
