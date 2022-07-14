import { ethers } from 'hardhat';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getContract = async (name: string): Promise<any> => {
  // eslint-disable-next-line
  // @ts-ignore
  return await ethers.getContract(name);
};
