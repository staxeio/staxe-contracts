import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { abi as SwapperABI } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json';
import { WETH } from '../../utils/swap';
import { IWETH__factory } from '../../typechain';

export const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
export const UNISWAP_QUOTER = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

export const getQuote = async (token: string, amount: bigint, chainId = 1337) => {
  const quoter = await ethers.getContractAt(QuoterABI, UNISWAP_QUOTER);
  const price = await quoter.callStatic.quoteExactOutputSingle(WETH(chainId), token, 3000, amount, 0);
  return price.toBigInt() as bigint;
};

export const buyToken = async (
  token: string,
  amount: bigint,
  price: bigint,
  recipient: SignerWithAddress,
  chainId = 1337
) => {
  const router = await ethers.getContractAt(SwapperABI, UNISWAP_ROUTER);
  const params = {
    tokenIn: WETH(chainId),
    tokenOut: token,
    fee: 3000,
    deadline: Math.floor(Date.now() / 1000 + 1800),
    recipient: recipient.address,
    amountOut: amount,
    amountInMaximum: price,
    sqrtPriceLimitX96: 0,
  };
  const wrapper = (await ethers.getContractAt(IWETH__factory.abi, WETH(chainId) || '0x')).connect(recipient);
  await wrapper.deposit({ value: price });
  await wrapper.connect(recipient).approve(UNISWAP_ROUTER, price);
  await router.connect(recipient).exactOutputSingle(params);
};
