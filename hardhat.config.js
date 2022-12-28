require("@nomiclabs/hardhat-truffle5");
require('@nomiclabs/hardhat-ethers');
require("@nomiclabs/hardhat-etherscan");
const [ Operator, Admin, Owner ] = require("./wallets");

const alchemyApiKey = "zjgNU2S1-T4As5fLhUX0gJM5vBluW0Zj";

const apiKeyForEthereum = "7QWMD5IKX9QMS71U41E6IGU3NK5E8HMKM6";
const apiKeyForBscscan = "5YWE9Y6JAYQJ937Y16PT4I61644FSMBZ7P";
const apiKeyForPolygon = "B1USFRKHATXATRIM1GKWJGY3HS5B39MRV4";

const HARDFORK = 'london';

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      hardfork: HARDFORK,
    },
    bscTestnet: {
      url: `https://data-seed-prebsc-1-s1.binance.org:8545`,
      chainId: 97,
      accounts: [Operator, Admin, Owner]
    },
    
    bscMainnet: {
      url: `https://bsc-dataseed.binance.org/`,
      chainId: 56,
      accounts: [Operator, Admin, Owner]
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
   	version: "0.8.10",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      }
    }
  },
  
};
