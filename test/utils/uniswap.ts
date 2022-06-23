import { ethers } from 'hardhat';

import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { WETH } from '../../utils/swap';

export const getQuote = async (token: string, amount: bigint, chainId = 1337) => {
  const quoter = await ethers.getContractAt(QuoterABI, '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6');
  const price = await quoter.callStatic.quoteExactOutputSingle(WETH(chainId), token, 3000, amount, 0);
  return price.toBigInt() as bigint;
};
