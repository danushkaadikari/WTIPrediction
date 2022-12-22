const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BN, constants, expectEvent, expectRevert, time, ether, balance } = require("@openzeppelin/test-helpers");

const BLOCK_COUNT_MULTPLIER = 5;
const DECIMALS = 8; // Chainlink default for BNB/USD
const INITIAL_PRICE = 10000000000; // $100, 8 decimal places
const INTERVAL_SECONDS = 20 * BLOCK_COUNT_MULTPLIER; // 20 seconds * multiplier
const BUFFER_SECONDS = 5 * BLOCK_COUNT_MULTPLIER; // 5 seconds * multplier, round must lock/end within this buffer
const MIN_BET_AMOUNT = ether("1"); // 1 BNB
const UPDATE_ALLOWANCE = 30 * BLOCK_COUNT_MULTPLIER; // 30s * multiplier
const INITIAL_REWARD_RATE = 0.9; // 90%
const INITIAL_TREASURY_RATE = 0.1; // 10%

describe("WTIPrediction", function() {
  let operator, admin, owner, bullUser1, bullUser2, bullUser3, bearUser1, bearUser2, bearUser3;
  let oracle, prediction;

  it("initialize", async () => {
    [operator, admin, owner, bullUser1, bullUser2, bullUser3, bearUser1, bearUser2, bearUser3] = await ethers.getSigners();

    const Oracle = await ethers.getContractFactory("MockAggregatorV3");
    oracle = await Oracle.deploy(DECIMALS, INITIAL_PRICE);
    await oracle.deployed();

    const WTIPrediction = await ethers.getContractFactory("WTIPrediction");
    prediction = await WTIPrediction.connect(owner).deploy(
      oracle.address,
      admin.address,
      operator.address,
      INTERVAL_SECONDS,
      BUFFER_SECONDS,
      MIN_BET_AMOUNT,
      UPDATE_ALLOWANCE,
      String(INITIAL_TREASURY_RATE * 10000),
    );
    await prediction.deployed()
  })
});
