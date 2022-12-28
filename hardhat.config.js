require("@nomiclabs/hardhat-truffle5");
require('@nomiclabs/hardhat-ethers');
require("@nomiclabs/hardhat-etherscan");

const apiKeyForBscscan = "5YWE9Y6JAYQJ937Y16PT4I61644FSMBZ7P";
const HARDFORK = 'london';

// Contract Owner Private Key
const Owner = "ea93f376d5d478147963e272303bfcc6e123a45691156301d9f0b8aba3287b52";

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      hardfork: HARDFORK,
    },
    bscTestnet: {
      url: `https://data-seed-prebsc-1-s1.binance.org:8545`,
      chainId: 97,
      accounts: [Owner]
    },
    
    bscMainnet: {
      url: `https://bsc-dataseed.binance.org/`,
      chainId: 56,
      accounts: [Owner]
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
