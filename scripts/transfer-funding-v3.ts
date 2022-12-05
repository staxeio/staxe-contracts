import { ethers } from 'hardhat';
import { StaxeProductionsV3 } from '../typechain';
import { getContract } from '../utils/deployment';

async function main() {
  const [deployer] = await ethers.getSigners();
  const productions = (await getContract('StaxeProductionsV3')) as StaxeProductionsV3;

  console.log(`Running with productions=${productions.address}`);
  await productions.connect(deployer).transferFunding(1);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
