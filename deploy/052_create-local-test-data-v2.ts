import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { StaxeMembersV2, StaxeProductionsV2 } from '../typechain';
import { formatEther } from 'ethers/lib/utils';

import deploymentData from '../deployments/deployments-v2.json';

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const chainId = +(await hre.getChainId());
  if (chainId !== 1337) {
    console.error('Not a dev env, exiting');
    return;
  }
  const contract = deploymentData.contracts.filter((value) => value.chainId === 137)[0]; // forked data

  const [owner, organizer, approver, investor1] = await ethers.getSigners();
  console.log('Generating V2 test data...');

  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [contract.owner],
  });
  const signerV2 = await ethers.provider.getSigner(contract.owner);
  const productionsV2Factory = await ethers.getContractFactory('StaxeProductionsV2');
  const productionsV2 = productionsV2Factory.attach(contract.productions) as StaxeProductionsV2;

  // grant investor role to investor
  const membersV2Factory = await ethers.getContractFactory('StaxeMembersV2');
  const membersV2 = membersV2Factory.attach(contract.members) as StaxeMembersV2;
  await membersV2.connect(signerV2).grantRole(await membersV2.INVESTOR_ROLE(), investor1.address);

  const productionId = 14;
  const numTokens = 1;
  const price = await productionsV2.connect(investor1).getNextTokenPrice(productionId, numTokens);
  await productionsV2.connect(investor1).buyTokens(productionId, numTokens, investor1.address, { value: price });
  console.log(`Bought tokens for V2 id=${productionId}, numTokens=${numTokens}, investor=${investor1.address}`);

  await approver.sendTransaction({ to: contract.owner, value: price.mul(2) });
  await productionsV2.connect(signerV2).proceeds(productionId, { value: price.mul(2) });

  console.log(`Sending proceeds for V2 id=${productionId}, value=${formatEther(price.mul(2))}`);
};

module.exports = main;
module.exports.tags = ['ui'];
