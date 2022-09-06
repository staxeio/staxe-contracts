import { StaxeProductionsV3 } from '../typechain';
import { getContract } from '../utils/deployment';

async function main() {
  const productions = (await getContract('StaxeProductionsV3')) as StaxeProductionsV3;

  console.log(`Running with productions=${productions.address}`);
  const data = await productions.getProduction(1);

  console.log('Production data:', data);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
