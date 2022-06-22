export const WETH = (chain: number) => {
  switch (chain) {
    case 1:
      return '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // main
    case 3:
    case 4:
      return '0xc778417E063141139Fce010982780140Aa0cD5Ab'; // ropsten & rinkeby
    case 5:
      return '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6'; // goerli
    case 42:
      return '0xd0A1E359811322d97991E03f863a0C30C2cF029C'; // kovan
    case 10:
      return '0x4200000000000000000000000000000000000006'; // optimism
    case 69:
      return '0x4200000000000000000000000000000000000006'; // optimistic kovan
    case 42161:
      return '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'; // arbitrum one
    case 421611:
      return '0xB47e6A5f8b33b3F17603C83a0535A9dcD7E32681'; // arbitrum rinkeby
    case 137:
      return '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'; // matic
    case 80001:
      return '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889'; // mumbai
    case 1337:
      return '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'; // hardhat -> matic
    default:
      throw Error(`Unknown chain ${chain}`);
  }
};

export const DAI = (chain: number) => {
  switch (chain) {
    case 1:
      return '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // main
    case 3:
      return '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // ropsten
    case 4:
      return '0x6A9865aDE2B6207dAAC49f8bCba9705dEB0B0e6D'; // rinkeby
    case 5:
      return '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // goerli
    case 42:
      return '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa'; // kovan
    default:
      throw Error(`Unknown chain ${chain}`);
  }
};

export const USDT = (chain: number) => {
  switch (chain) {
    case 1:
      return '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // main
    case 3:
      return '0x516de3a7a567d81737e3a46ec4ff9cfd1fcb0136'; // ropsten
    case 4:
      return '0xa689352b7c1cad82864beb1d90679356d3962f4d'; // rinkeby
    case 5:
      return '0xe583769738b6dd4e7caf8451050d1948be717679'; // goerli
    case 42:
      return '0xa325f1b1ebb748715dfbbaf62e0c6677e137f45d'; // kovan
    case 10:
      return '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'; // optimism
    case 69:
      return '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'; // optimistic kovan
    case 42161:
      return '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'; // arbitrum one
    case 421611:
      return '0x920b9301c2de92186299cd2abc7199e25b9728b3'; // arbitrum rinkeby
    case 137:
      return '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'; // matic
    case 80001:
      return '0xf7f730ffaec85455e3ba44f488c2bd2a741953b3'; // mumbai
    case 1337:
      return '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'; // hardhat -> matic
    default:
      throw Error(`Unknown chain ${chain}`);
  }
};
