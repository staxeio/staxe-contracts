import { ContractTransaction } from 'ethers';
import { ethers, deployments } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import deploymentData from '../../deployments/deployments-v3.json';

import {
  ERC20,
  StaxeMembersV3,
  StaxeProductionEscrowV3,
  StaxeProductionsFactoryV3,
  StaxeProductionsV3,
  StaxeProductionTokenV3,
} from '../../typechain';
import { USDT } from '../../utils/swap';
import { buyToken, getQuote } from './uniswap';

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

export type ProductionData = {
  totalSupply: number;
  organizerTokens: number;
  tokenPrice: string;
  currency: string;
  maxTokensUnknownBuyer: number;
  perks: Perk[];
  dataHash: string;
  crowdsaleEndDate: number;
  productionEndDate: number;
  platformSharePercentage: number;
  perkTracker: string;
};

export type Perk = {
  total: number;
  minTokensRequired: number;
};

export const newProduction = (
  totalSupply: number,
  tokenPrice: bigint,
  perks: Perk[] = [],
  maxTokensUnknownBuyer = 0,
  currency = USDT(1337),
  dataHash = '',
  crowdsaleEndDate = 0,
  productionEndDate = 0,
  platformSharePercentage = 10,
  organizerTokens = 0,
  perkTracker = ethers.constants.AddressZero
): ProductionData => {
  return {
    totalSupply,
    organizerTokens,
    tokenPrice: tokenPrice + '',
    currency,
    maxTokensUnknownBuyer,
    perks,
    dataHash,
    crowdsaleEndDate,
    productionEndDate,
    platformSharePercentage,
    perkTracker,
  } as ProductionData;
};

export const createProduction = async (factory: StaxeProductionsFactoryV3, data: ProductionData) => {
  const tx = await factory.createProduction(data);
  return await productionId(tx);
};

export const createAndApproveProduction = async (
  factory: StaxeProductionsFactoryV3,
  productions: StaxeProductionsV3,
  data: ProductionData
) => {
  const tx = await factory.createProduction(data);
  const id = await productionId(tx);
  await productions.approve(id);
  return id;
};

export const buyUsdt = async (amount: bigint, recipient: SignerWithAddress) => {
  const usdt = USDT(1337) as string;
  const swapPrice = await getQuote(usdt, amount, 1337);
  await buyToken(usdt, amount, swapPrice, recipient);
};

export const buyUsdtAndApprove = async (amount: bigint, recipient: SignerWithAddress, approveTo: string) => {
  await buyUsdt(amount, recipient);
  const usdt = USDT(1337) as string;
  (await attachToken(usdt)).connect(recipient).approve(approveTo, amount);
};

export const buyTokens = async (
  productions: StaxeProductionsV3,
  address: string,
  id: number,
  tokensToBuy: number,
  perk = 0
) => {
  const price = await productions.getTokenPrice(id, tokensToBuy);
  const swapPrice = await getQuote(price[0], price[1].toBigInt(), 1337);
  await productions.buyTokensWithCurrency(id, address, tokensToBuy, perk, { value: swapPrice });
  return price[1].toBigInt();
};

export const attachEscrow = async (productions: StaxeProductionsV3, id: number) => {
  const escrowFactory = await ethers.getContractFactory('StaxeProductionEscrowV3');
  const escrow = (await productions.getProduction(id)).escrow;
  return escrowFactory.attach(escrow) as StaxeProductionEscrowV3;
};

export const attachToken = async (address: string) => {
  const Token = await ethers.getContractFactory('ERC20');
  return Token.attach(address) as ERC20;
};

export const productionId = async (tx: ContractTransaction): Promise<number> => {
  const receipt = await tx.wait();
  return +receipt.events?.filter((event) => event.event === 'ProductionCreated')[0].args?.id;
};
