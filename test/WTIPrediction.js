const { inputToConfig } = require("@ethereum-waffle/compiler");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber, constants: { MaxUint256, AddressZero } } = require("ethers");

const timeLatest = async () => {
    const block = await hre.ethers.provider.getBlock('latest');
    return BigNumber.from(block.timestamp);
};

const setBlocktime = async (time) => {
    await hre.ethers.provider.send('evm_setNextBlockTimestamp', [time]);
    await hre.ethers.provider.send("evm_mine")
  };

describe("WTIPrediction", function() {
   it("initialize", async () => {

   })
});
