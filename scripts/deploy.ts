import { ethers } from 'hardhat';
import { EventEscrowFactory } from '../typechain';

async function main() {
  // Token
  const tokenFactory = await ethers.getContractFactory('StaxeEventToken');
  const token = await tokenFactory.deploy();
  await token.deployed();
  console.log(`StaxeEventToken deployed to ${token.address}`);

  // Escrow Factory
  const escrowFactory = await ethers.getContractFactory('EventEscrowFactory');
  const factory = (await escrowFactory.deploy()) as EventEscrowFactory;
  await factory.deployed();

  // Events
  const eventsFactory = await ethers.getContractFactory('StaxeEvents');
  const events = await eventsFactory.deploy(token.address, factory.address);
  await events.deployed();
  console.log(`StaxeEvents deployed to ${events.address}`);

  await token.grantRole(await token.MINTER_ROLE(), events.address);
  console.log(`Minter role granted to ${events.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
