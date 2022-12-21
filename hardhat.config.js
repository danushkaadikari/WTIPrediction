require("@nomiclabs/hardhat-waffle");
require('hardhat-deploy');
require('@nomiclabs/hardhat-ethers');
require("@nomiclabs/hardhat-etherscan");

const alchemyApiKey = "zjgNU2S1-T4As5fLhUX0gJM5vBluW0Zj";

const apiKeyForEthereum = "7QWMD5IKX9QMS71U41E6IGU3NK5E8HMKM6";
const apiKeyForBscscan = "5YWE9Y6JAYQJ937Y16PT4I61644FSMBZ7P";
const apiKeyForPolygon = "B1USFRKHATXATRIM1GKWJGY3HS5B39MRV4";

const DEFAULT_BLOCK_GAS_LIMIT = 12450000;
const HARDFORK = 'london';

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      hardfork: HARDFORK,
      blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
      gas: DEFAULT_BLOCK_GAS_LIMIT,
      gasPrice: 8000000000,
      allowUnlimitedContractSize: true,
    },
    polygonMainnet: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
      chainId: 137,
      accounts: []
    },
    mumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${alchemyApiKey}`,
      chainId: 80001,
      accounts: []
    },
    ethereumMainnet: {
      url: `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`,
      chainId: 1,
      accounts: []
    },
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${alchemyApiKey}`,
      chainId: 4,
      accounts: []
    },
    bscTestnet: {
      url: `https://data-seed-prebsc-1-s1.binance.org:8545`,
      chainId: 97,
      accounts: []
    },
    bscMainnet: {
      url: `https://bsc-dataseed.binance.org/`,
      chainId: 56,
      accounts: []
    }
  },
  paths:{
    sources: "./contracts",
    artifacts: "./artifacts"
  },
  etherscan: {
    apiKey: apiKeyForBscscan
  },
  solidity: {
   	version: "0.8.0",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      }
    }
  },
};
