import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-etherscan';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import '@typechain/hardhat';
import 'solidity-coverage';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import * as fs from 'fs';
import { task } from 'hardhat/config';
import { HardhatUserConfig } from 'hardhat/types';

// Load configuration. Fall back to template if not present
let secrets = './secrets.json';
if (!fs.existsSync(secrets)) {
  console.log('\x1b[33m%s\x1b[0m', '--- No secrets present - using defaults ---');
  secrets = './secrets.template.json';
}
const currentDir = __dirname;
const { etherscanApiKey, infuraProjectId, polygonscanApiKey, networkConfig } = require(secrets);

// Tasks
task('accounts', 'Prints the list of accounts', async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.13',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  typechain: {
    outDir: `${currentDir}/typechain`,
  },
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        mnemonic: 'throw ripple canoe glue typical soccer repeat enhance arch dolphin warm enough',
      },
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${infuraProjectId}`,
      accounts: [`0x${networkConfig?.rinkeby?.privateKey}`],
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${infuraProjectId}`,
      accounts: [`0x${networkConfig?.kovan?.privateKey}`],
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${infuraProjectId}`,
      accounts: [`0x${networkConfig?.mainnet?.privateKey}`],
    },
    mumbai: {
      chainId: 80001,
      url: `https://polygon-mumbai.g.alchemy.com/v2/${networkConfig?.mumbai?.alchemyApiKey}`,
      accounts: [`0x${networkConfig?.mumbai?.privateKey}`],
    },
    matic: {
      chainId: 137,
      url: `https://polygon-mainnet.g.alchemy.com/v2/${networkConfig?.matic?.alchemyApiKey}`,
      accounts: [`0x${networkConfig?.matic?.privateKey}`],
    },
  },
  etherscan: {
    apiKey: {
      mainnet: etherscanApiKey,
      ropsten: etherscanApiKey,
      rinkeby: etherscanApiKey,
      goerli: etherscanApiKey,
      kovan: etherscanApiKey,
      polygon: polygonscanApiKey,
      polygonMumbai: polygonscanApiKey,
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 21,
  },
};

export default config;
