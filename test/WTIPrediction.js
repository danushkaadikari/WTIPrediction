const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { BN, constants, expectEvent, expectRevert, time, ether, balance } = require("@openzeppelin/test-helpers");

const GAS_PRICE = 8000000000; // hardhat default
const BLOCK_COUNT_MULTPLIER = 5;
const DECIMALS = 8; // Chainlink default for BNB/USD
const INITIAL_PRICE = 10000000000; // $100, 8 decimal places
const INTERVAL_SECONDS = 20 * BLOCK_COUNT_MULTPLIER; // 20 seconds * multiplier
const BUFFER_SECONDS = 5 * BLOCK_COUNT_MULTPLIER; // 5 seconds * multplier, round must lock/end within this buffer
const MIN_BET_AMOUNT = ether("1"); // 1 BNB
const UPDATE_ALLOWANCE = 30 * BLOCK_COUNT_MULTPLIER; // 30s * multiplier
const INITIAL_REWARD_RATE = 0.9; // 90%
const INITIAL_TREASURY_RATE = 0.1; // 10%

// Enum: 0 = Bull, 1 = Bear
const Position = {
  Bull: 0,
  Bear: 1,
};

const calcGasCost = (gasUsed) => new BN(GAS_PRICE * gasUsed);

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
      MIN_BET_AMOUNT.toString(),
      UPDATE_ALLOWANCE,
      String(INITIAL_TREASURY_RATE * 10000),
    );
    await prediction.deployed()

    assert.equal(await balance.current(prediction.address), 0);
    assert.equal(await prediction.currentEpoch(), 0);
    assert.equal(await prediction.intervalSeconds(), INTERVAL_SECONDS);
    assert.equal(await prediction.adminAddress(), admin.address);
    assert.equal(await prediction.treasuryAmount(), 0);
    assert.equal(await prediction.minBetAmount(), MIN_BET_AMOUNT.toString());
    assert.equal(await prediction.oracleUpdateAllowance(), UPDATE_ALLOWANCE);
    assert.equal(await prediction.genesisStartOnce(), false);
    assert.equal(await prediction.genesisLockOnce(), false);
    assert.equal(await prediction.paused(), false);
  })

  it("Should start genesis rounds (round 1, round 2, round 3)", async () => {
    // Manual block calculation
    let currentTimestamp = (await time.latest()).toNumber();

    // Epoch 0
    assert.equal((await time.latest()).toNumber(), currentTimestamp);
    assert.equal(await prediction.currentEpoch(), 0);

    console.log(currentTimestamp);
    // Epoch 1: Start genesis round 1
    let tx = await prediction.connect(operator).genesisStartRound();
    currentTimestamp++;

    
    // expectEvent(tx, "StartRound", { epoch: new BN(1) });
    assert.equal(await prediction.currentEpoch(), 1);

    // Start round 1
    assert.equal(await prediction.genesisStartOnce(), true);
    assert.equal(await prediction.genesisLockOnce(), false);
    assert.equal((await prediction.rounds(1)).startTimestamp, currentTimestamp);
    assert.equal((await prediction.rounds(1)).lockTimestamp, currentTimestamp + INTERVAL_SECONDS);
    assert.equal((await prediction.rounds(1)).closeTimestamp, currentTimestamp + INTERVAL_SECONDS * 2);
    assert.equal((await prediction.rounds(1)).epoch, 1);
    assert.equal((await prediction.rounds(1)).totalAmount, 0);

    // Elapse 20 blocks
    currentTimestamp += INTERVAL_SECONDS;
    await time.increaseTo(currentTimestamp);

    // Epoch 2: Lock genesis round 1 and starts round 2
    tx = await prediction.connector(operator).genesisLockRound();
    currentTimestamp++;

    expectEvent(tx, "LockRound", {
      epoch: new BN(1),
      roundId: new BN(1),
      price: new BN(INITIAL_PRICE),
    });

    expectEvent(tx, "StartRound", { epoch: new BN(2) });
    assert.equal(await prediction.currentEpoch(), 2);

    // Lock round 1
    assert.equal(await prediction.genesisStartOnce(), true);
    assert.equal(await prediction.genesisLockOnce(), true);
    assert.equal((await prediction.rounds(1)).lockPrice, INITIAL_PRICE);

    // Start round 2
    assert.equal((await prediction.rounds(2)).startTimestamp, currentTimestamp);
    assert.equal((await prediction.rounds(2)).lockTimestamp, currentTimestamp + INTERVAL_SECONDS);
    assert.equal((await prediction.rounds(2)).closeTimestamp, currentTimestamp + 2 * INTERVAL_SECONDS);
    assert.equal((await prediction.rounds(2)).epoch, 2);
    assert.equal((await prediction.rounds(2)).totalAmount, 0);

    // Elapse 20 blocks
    currentTimestamp += INTERVAL_SECONDS;
    await time.increaseTo(currentTimestamp);

    // Epoch 3: End genesis round 1, locks round 2, starts round 3
    await oracle.updateAnswer(INITIAL_PRICE); // To update Oracle roundId
    tx = await prediction.executeRound();
    currentTimestamp += 2; // Oracle update and execute round

    expectEvent(tx, "EndRound", {
      epoch: new BN(1),
      roundId: new BN(2),
      price: new BN(INITIAL_PRICE),
    });

    expectEvent(tx, "LockRound", {
      epoch: new BN(2),
      roundId: new BN(2),
      price: new BN(INITIAL_PRICE),
    });

    expectEvent(tx, "StartRound", { epoch: new BN(3) });
    assert.equal(await prediction.currentEpoch(), 3);

    // End round 1
    assert.equal((await prediction.rounds(1)).closePrice, INITIAL_PRICE);

    // Lock round 2
    assert.equal((await prediction.rounds(2)).lockPrice, INITIAL_PRICE);
  });
});
