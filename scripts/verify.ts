import { run, getChainId } from 'hardhat';

import deployments from '../deployments/deployments-v3.json';

async function main() {
  const chainId = +(await getChainId());
  const contract = deployments.contracts.filter((contract) => contract.chainId === chainId)[0];
  /*
  console.log('Verifying token contract');
  // Token Contract
  await run('verify:verify', {
    address: contract.token,
    constructorArguments: [],
  });

  console.log('Verifying members contract');
  // Members Contract
  await run('verify:verify', {
    address: contract.members,
    constructorArguments: [],
  });*/

  console.log('Verifying productions contract');
  // Productions Contract
  await run('verify:verify', {
    address: contract.productions,
    constructorArguments: [contract.forwarder],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
