import { BigNumber, ethers } from 'ethers';
import { ethers as hardhat } from 'hardhat';

export function ethersParse(amount: number, unit: number): BigNumber {
  return ethers.utils.parseUnits(amount.toString(), unit);
}

export async function timeTravel(days: number) {
  await hardhat.provider.send('evm_increaseTime', [days * 24 * 60 * 60]);
}
