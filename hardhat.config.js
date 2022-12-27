require("@nomiclabs/hardhat-truffle5");
require('@nomiclabs/hardhat-ethers');
require("@nomiclabs/hardhat-etherscan");

const alchemyApiKey = "zjgNU2S1-T4As5fLhUX0gJM5vBluW0Zj";

const apiKeyForEthereum = "7QWMD5IKX9QMS71U41E6IGU3NK5E8HMKM6";
const apiKeyForBscscan = "5YWE9Y6JAYQJ937Y16PT4I61644FSMBZ7P";
const apiKeyForPolygon = "B1USFRKHATXATRIM1GKWJGY3HS5B39MRV4";

// 0xEC2e9a1F960DAb18819f73ea6ba69c935023081e
const Operator = "bd5f7934cb8c85c8ca82bebe65d7b7fbadd2bb0efa2072248a92e43f848ec50a";
// 0x0202d07DDfc39dA9A186aF9E71C6bef08e0F0A0A
const Admin = "2c65d9cf7cd4372f9d20ff3a2117ef3653fb8b802e0080569de903f4cb1a428a";
// 0x74516476276F1dEbAc621A34C1638A83eB7B26Ad
const Owner = "ea93f376d5d478147963e272303bfcc6e123a45691156301d9f0b8aba3287b52";

const HARDFORK = 'london';

module.exports = {
  defaultNetwork: "bscTestnet",
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
