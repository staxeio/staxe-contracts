import { ContractTransaction } from 'ethers';
import { ethers, deployments } from 'hardhat';

import deploymentData from '../../deployments/deployments-v3.json';

import {
  StaxeMembersV3,
  StaxeProductionEscrowV3,
  StaxeProductionsFactoryV3,
  StaxeProductionsV3,
  StaxeProductionTokenV3,
} from '../../typechain';
import { USDT } from '../../utils/swap';

export const harness = async () => {
  const [owner, organizer, approver, investor1, investor2, treasury, ...addresses] = await ethers.getSigners();
  await deployments.fixture(['v3']);

  const contract = deploymentData.contracts.filter((contract) => contract.chainId === 1337)[0];

  const Members = await ethers.getContractFactory('StaxeMembersV3');
  const members = (await Members.attach(contract.members)) as StaxeMembersV3;

  const Token = await ethers.getContractFactory('StaxeProductionTokenV3');
  const token = (await Token.attach(contract.token)) as StaxeProductionTokenV3;

  const Productions = await ethers.getContractFactory('StaxeProductionsV3');
  const productions = (await Productions.attach(contract.productions)) as StaxeProductionsV3;

  const Factory = await ethers.getContractFactory('StaxeProductionsFactoryV3');
  const factory = (await Factory.attach(contract.factory)) as StaxeProductionsFactoryV3;

  await members.grantRole(await members.INVESTOR_ROLE(), investor1.address);
  await members.grantRole(await members.INVESTOR_ROLE(), investor2.address);
  await members.grantRole(await members.ORGANIZER_ROLE(), organizer.address);
  await members.grantRole(await members.APPROVER_ROLE(), approver.address);

  return {
    members,
    token,
    productions,
    factory,
    owner,
    organizer,
    approver,
    investor1,
    investor2,
    treasury,
    addresses,
  };
};

export const newProduction = (
  totalSupply: number,
  tokenPrice: bigint,
  maxTokensUnknownBuyer = 0,
  perksReachedWithTokens = [] as number[],
  currency = USDT(1337),
  dataHash = ''
) => {
  return {
    totalSupply,
    tokenPrice,
    perksReachedWithTokens,
    currency,
    maxTokensUnknownBuyer,
    dataHash,
  };
};

export const attachEscrow = async (productions: StaxeProductionsV3, id: number) => {
  const escrowFactory = await ethers.getContractFactory('StaxeProductionEscrowV3');
  const escrow = (await productions.getProduction(id)).escrow;
  return escrowFactory.attach(escrow) as StaxeProductionEscrowV3;
};

export const productionId = async (tx: ContractTransaction): Promise<number> => {
  const receipt = await tx.wait();
  return +receipt.events?.filter((event) => event.event === 'ProductionCreated')[0].args?.id;
};
