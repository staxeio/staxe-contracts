import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-etherscan';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import '@typechain/hardhat';
import 'solidity-coverage';
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import '@openzeppelin/hardhat-upgrades';
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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { etherscanApiKey, infuraProjectId, polygonscanApiKey, networkConfig, coinmarketcap } = require(secrets);

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
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 500,
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
      forking: {
        blockNumber: 32000000,
        url: `https://polygon-mainnet.g.alchemy.com/v2/${networkConfig?.hardhat?.alchemyApiKey}`,
      },
    },
    goerli: {
      url: `https://eth-goerli.g.alchemy.com/v2/${networkConfig?.goerli?.alchemyApiKey}`,
      accounts: [`0x${networkConfig?.goerli?.privateKey}`],
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
    alfajores: {
      chainId: 44787,
      url: 'https://alfajores-forno.celo-testnet.org',
      accounts: [`0x${networkConfig?.alfajores?.privateKey}`],
    },
  },
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
      1: 0, // similarly on mainnet it will take the first account as deployer. Note though that depending on how hardhat network are configured, the account 0 on one network can be different than on another
    },
  },
  etherscan: {
    apiKey: {
      mainnet: etherscanApiKey,
      goerli: etherscanApiKey,
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
    coinmarketcap: coinmarketcap,
    gasPrice: 27,
    token: 'MATIC',
  },
};

export default config;
