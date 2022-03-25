import { run, ethers, getChainId } from 'hardhat';

import deployments from '../deploy/deployments.json';

async function main() {
  const chainId = +(await getChainId());
  const contract = deployments.contracts.filter((contract) => contract.chainId === chainId)[0];

  // Token Contract
  await run('verify:verify', {
    address: contract.token,
    constructorArguments: [],
  });

  // Members Contract
  await run('verify:verify', {
    address: contract.members,
    constructorArguments: [],
  });

  // Productions Contract
  await run('verify:verify', {
    address: contract.productions,
    constructorArguments: [contract.token, contract.factory, contract.members, contract.treasury],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
