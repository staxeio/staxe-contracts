import { BigNumber, ethers } from 'ethers';
import { ethers as hardhat } from 'hardhat';

export function ethersParse(amount: number, unit: number): BigNumber {
  return ethers.utils.parseUnits(amount.toString(), unit);
}

export async function timeTravel(days: number) {
  await hardhat.provider.send('evm_increaseTime', [days * 24 * 60 * 60]);
}

export async function timeStamp() {
  const blockNumBefore = await hardhat.provider.getBlockNumber();
  const blockBefore = await hardhat.provider.getBlock(blockNumBefore);
  return blockBefore.timestamp;
}

export async function timeStampPlusDays(days: number) {
  const timestamp = await timeStamp();
  return timestamp + 60 * 60 * 24 * days;
}
