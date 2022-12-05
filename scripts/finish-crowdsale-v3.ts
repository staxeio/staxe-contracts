import { BigNumber } from 'ethers';
import { ethers, getChainId } from 'hardhat';
import { StaxeProductionsV3 } from '../typechain';
import { getContract } from '../utils/deployment';

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = await getChainId();
  console.log(`Deploying contracts account: ${deployer.address}, chainId: ${chainId}`);

  const id = BigNumber.from(1);
  const productions = (await getContract('StaxeProductionsV3')) as StaxeProductionsV3;

  const data = await productions.connect(deployer).getProduction(id);
  console.log({ data });
  await productions.connect(deployer).finishCrowdsale(id);

  console.log('Finished crowdsale:', id);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
