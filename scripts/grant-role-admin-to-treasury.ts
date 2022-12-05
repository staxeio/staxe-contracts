import { ethers, getChainId } from 'hardhat';
import { StaxeMembersV3 } from '../typechain';
import { getContract } from '../utils/deployment';

import deploymentData from '../deployments/deployments-v3.json';

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = await getChainId();
  console.log(`Deploying contracts account: ${deployer.address}, chainId: ${chainId}`);

  const contract = deploymentData.contracts.filter((value) => value.chainId === +chainId)[0];

  const members = (await getContract('StaxeMembersV3')) as StaxeMembersV3;
  await members.connect(deployer).grantRole(await members.DEFAULT_ADMIN_ROLE(), contract.treasury);

  console.log('Granted role admin to:', contract.treasury);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
