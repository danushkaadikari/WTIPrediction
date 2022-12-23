const { expect, assert } = require("chai");
const { ethers, artifacts, contract } = require("hardhat");
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

const assertBNArray = (arr1, arr2) => {
  assert.equal(arr1.length, arr2.length);
  arr1.forEach((n1, index) => {
    assert.equal(n1.toString(), new BN(arr2[index]).toString());
  });
};

const WTIPrediction = artifacts.require("WTIPrediction");
const Oracle = artifacts.require("MockAggregatorV3");

contract(
  "WTIPrediction",
  ([operator, admin, owner, bullUser1, bullUser2, bullUser3, bearUser1, bearUser2, bearUser3]) => {
    let oracle, prediction, currentEpoch;

    async function nextEpoch() {
      await time.increaseTo((await time.latest()).toNumber() + INTERVAL_SECONDS); // Elapse 20 seconds
    }

    beforeEach(async () => {
      oracle = await Oracle.new(DECIMALS, INITIAL_PRICE);

      prediction = await WTIPrediction.new(
        oracle.address,
        admin,
        operator,
        INTERVAL_SECONDS,
        BUFFER_SECONDS,
        MIN_BET_AMOUNT,
        UPDATE_ALLOWANCE,
        String(INITIAL_TREASURY_RATE * 10000),
        { from: owner }
      );
    })

    it("Initialize", async () => {
      assert.equal(await balance.current(prediction.address), 0);
      assert.equal(await prediction.currentEpoch(), 0);
      assert.equal(await prediction.intervalSeconds(), INTERVAL_SECONDS);
      assert.equal(await prediction.adminAddress(), admin);
      assert.equal(await prediction.treasuryAmount(), 0);
      assert.equal(await prediction.minBetAmount(), MIN_BET_AMOUNT.toString());
      assert.equal(await prediction.oracleUpdateAllowance(), UPDATE_ALLOWANCE);
      assert.equal(await prediction.genesisStartOnce(), false);
      assert.equal(await prediction.genesisLockOnce(), false);
      assert.equal(await prediction.paused(), false);
    });

    it("Should start genesis rounds (round 1, round 2, round 3)", async () => {
      // Manual block calculation
      let currentTimestamp = (await time.latest()).toNumber();

      // Epoch 0
      assert.equal((await time.latest()).toNumber(), currentTimestamp);
      assert.equal(await prediction.currentEpoch(), 0);

      // Epoch 1: Start genesis round 1
      let tx = await prediction.genesisStartRound();
      currentTimestamp++;
      expectEvent(tx, "StartRound", { epoch: new BN(1) });
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
      tx = await prediction.genesisLockRound();
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

    it("Should not start rounds before genesis start and lock round has triggered", async () => {
      await expectRevert(prediction.genesisLockRound(), "Can only run after genesisStartRound is triggered");
      await expectRevert(
        prediction.executeRound(),
        "Can only run after genesisStartRound and genesisLockRound is triggered"
      );

      await prediction.genesisStartRound();
      await expectRevert(
        prediction.executeRound(),
        "Can only run after genesisStartRound and genesisLockRound is triggered"
      );

      await nextEpoch();
      await prediction.genesisLockRound(); // Success

      await nextEpoch();
      await oracle.updateAnswer(INITIAL_PRICE); // To update Oracle roundId
      await prediction.executeRound(); // Success
    });

    it("Should not lock round before lockTimestamp and end round before closeTimestamp", async () => {
      await prediction.genesisStartRound();
      await expectRevert(prediction.genesisLockRound(), "Can only lock round after lockTimestamp");
      await nextEpoch();
      await prediction.genesisLockRound();
      await oracle.updateAnswer(INITIAL_PRICE); // To update Oracle roundId
      await expectRevert(prediction.executeRound(), "Can only lock round after lockTimestamp");

      await nextEpoch();
      await prediction.executeRound(); // Success
    });

    it("Should record data and user bets", async () => {
      // Epoch 1
      await prediction.genesisStartRound();
      currentEpoch = await prediction.currentEpoch();

      await prediction.betBull(currentEpoch, { from: bullUser1, value: ether("1.1") }); // 1.1 BNB
      await prediction.betBull(currentEpoch, { from: bullUser2, value: ether("1.2") }); // 1.2 BNB
      await prediction.betBear(currentEpoch, { from: bearUser1, value: ether("1.4") }); // 1.4 BNB

      assert.equal((await balance.current(prediction.address)).toString(), ether("3.7").toString()); // 3.7 BNB
      assert.equal((await prediction.rounds(1)).totalAmount, ether("3.7").toString()); // 3.7 BNB
      assert.equal((await prediction.rounds(1)).bullAmount, ether("2.3").toString()); // 2.3 BNB
      assert.equal((await prediction.rounds(1)).bearAmount, ether("1.4").toString()); // 1.4 BNB
      assert.equal((await prediction.ledger(1, bullUser1)).position, Position.Bull);
      assert.equal((await prediction.ledger(1, bullUser1)).amount, ether("1.1").toString());
      assert.equal((await prediction.ledger(1, bullUser2)).position, Position.Bull);
      assert.equal((await prediction.ledger(1, bullUser2)).amount, ether("1.2").toString());
      assert.equal((await prediction.ledger(1, bearUser1)).position, Position.Bear);
      assert.equal((await prediction.ledger(1, bearUser1)).amount, ether("1.4").toString());
      assertBNArray((await prediction.getUserRounds(bullUser1, 0, 1))[0], [1]);
      assertBNArray((await prediction.getUserRounds(bullUser2, 0, 1))[0], [1]);
      assertBNArray((await prediction.getUserRounds(bearUser1, 0, 1))[0], [1]);
      assert.equal(await prediction.getUserRoundsLength(bullUser1), 1);

      // Epoch 2
      await nextEpoch();
      await prediction.genesisLockRound(); // For round 1
      currentEpoch = await prediction.currentEpoch();

      await prediction.betBull(currentEpoch, { from: bullUser1, value: ether("2.1") }); // 2.1 BNB
      await prediction.betBull(currentEpoch, { from: bullUser2, value: ether("2.2") }); // 2.2 BNB
      await prediction.betBear(currentEpoch, { from: bearUser1, value: ether("2.4") }); // 2.4 BNB

      assert.equal((await balance.current(prediction.address)).toString(), ether("10.4").toString()); // 10.4 BNB (3.7+6.7)
      assert.equal((await prediction.rounds(2)).totalAmount, ether("6.7").toString()); // 6.7 BNB
      assert.equal((await prediction.rounds(2)).bullAmount, ether("4.3").toString()); // 4.3 BNB
      assert.equal((await prediction.rounds(2)).bearAmount, ether("2.4").toString()); // 2.4 BNB
      assert.equal((await prediction.ledger(2, bullUser1)).position, Position.Bull);
      assert.equal((await prediction.ledger(2, bullUser1)).amount, ether("2.1").toString());
      assert.equal((await prediction.ledger(2, bullUser2)).position, Position.Bull);
      assert.equal((await prediction.ledger(2, bullUser2)).amount, ether("2.2").toString());
      assert.equal((await prediction.ledger(2, bearUser1)).position, Position.Bear);
      assert.equal((await prediction.ledger(2, bearUser1)).amount, ether("2.4").toString());
      assertBNArray((await prediction.getUserRounds(bullUser1, 0, 2))[0], [1, 2]);
      assertBNArray((await prediction.getUserRounds(bullUser2, 0, 2))[0], [1, 2]);
      assertBNArray((await prediction.getUserRounds(bearUser1, 0, 2))[0], [1, 2]);
      assert.equal(await prediction.getUserRoundsLength(bullUser1), 2);

      // Epoch 3
      await nextEpoch();
      await oracle.updateAnswer(INITIAL_PRICE); // To update Oracle roundId
      await prediction.executeRound();
      currentEpoch = await prediction.currentEpoch();

      await prediction.betBull(currentEpoch, { from: bullUser1, value: ether("3.1").toString() }); // 3.1 BNB
      await prediction.betBull(currentEpoch, { from: bullUser2, value: ether("3.2").toString() }); // 3.2 BNB
      await prediction.betBear(currentEpoch, { from: bearUser1, value: ether("3.4").toString() }); // 4.3 BNB

      assert.equal((await balance.current(prediction.address)).toString(), ether("20.1").toString()); // 20.1 BNB (3.7+6.7+9.7)
      assert.equal((await prediction.rounds(3)).totalAmount, ether("9.7").toString()); // 9.7 BNB
      assert.equal((await prediction.rounds(3)).bullAmount, ether("6.3").toString()); // 6.3 BNB
      assert.equal((await prediction.rounds(3)).bearAmount, ether("3.4").toString()); // 3.4 BNB
      assert.equal((await prediction.ledger(3, bullUser1)).position, Position.Bull);
      assert.equal((await prediction.ledger(3, bullUser1)).amount, ether("3.1").toString());
      assert.equal((await prediction.ledger(3, bullUser2)).position, Position.Bull);
      assert.equal((await prediction.ledger(3, bullUser2)).amount, ether("3.2").toString());
      assert.equal((await prediction.ledger(3, bearUser1)).position, Position.Bear);
      assert.equal((await prediction.ledger(3, bearUser1)).amount, ether("3.4").toString());
      assertBNArray((await prediction.getUserRounds(bullUser1, 0, 3))[0], [1, 2, 3]);
      assertBNArray((await prediction.getUserRounds(bullUser2, 0, 3))[0], [1, 2, 3]);
      assertBNArray((await prediction.getUserRounds(bearUser1, 0, 3))[0], [1, 2, 3]);
      assert.equal(await prediction.getUserRoundsLength(bullUser1), 3);

      // Epoch 4
      await nextEpoch();
      await oracle.updateAnswer(INITIAL_PRICE); // To update Oracle roundId
      await prediction.executeRound();
      currentEpoch = await prediction.currentEpoch();

      await prediction.betBull(currentEpoch, { from: bullUser1, value: ether("4.1").toString() }); // 4.1 BNB
      await prediction.betBull(currentEpoch, { from: bullUser2, value: ether("4.2").toString() }); // 4.2 BNB
      await prediction.betBear(currentEpoch, { from: bearUser1, value: ether("4.4").toString() }); // 4.4 BNB

      assert.equal((await balance.current(prediction.address)).toString(), ether("32.8").toString()); // 32.8 BNB (3.7+6.7+9.7+12.7)
      assert.equal((await prediction.rounds(4)).totalAmount, ether("12.7").toString()); // 12.7 BNB
      assert.equal((await prediction.rounds(4)).bullAmount, ether("8.3").toString()); // 8.3 BNB
      assert.equal((await prediction.rounds(4)).bearAmount, ether("4.4").toString()); // 4.4 BNB
      assert.equal((await prediction.ledger(4, bullUser1)).position, Position.Bull);
      assert.equal((await prediction.ledger(4, bullUser1)).amount, ether("4.1").toString());
      assert.equal((await prediction.ledger(4, bullUser2)).position, Position.Bull);
      assert.equal((await prediction.ledger(4, bullUser2)).amount, ether("4.2").toString());
      assert.equal((await prediction.ledger(4, bearUser1)).position, Position.Bear);
      assert.equal((await prediction.ledger(4, bearUser1)).amount, ether("4.4").toString());
      assertBNArray((await prediction.getUserRounds(bullUser1, 0, 4))[0], [1, 2, 3, 4]);
      assertBNArray((await prediction.getUserRounds(bullUser2, 0, 4))[0], [1, 2, 3, 4]);
      assertBNArray((await prediction.getUserRounds(bearUser1, 0, 4))[0], [1, 2, 3, 4]);
      assert.equal(await prediction.getUserRoundsLength(bullUser1), 4);
    });

    it("Should record rewards", async () => {
      // Epoch 1
      const price110 = 11000000000; // $110
      await oracle.updateAnswer(price110);
      await prediction.genesisStartRound();
      currentEpoch = await prediction.currentEpoch();

      await prediction.betBull(currentEpoch, { from: bullUser1, value: ether("1.1") }); // 1.1 BNB
      await prediction.betBull(currentEpoch, { from: bullUser2, value: ether("1.2") }); // 1.2 BNB
      await prediction.betBear(currentEpoch, { from: bearUser1, value: ether("1.4") }); // 1.4 BNB

      assert.equal((await prediction.rounds(1)).rewardBaseCalAmount, 0);
      assert.equal((await prediction.rounds(1)).rewardAmount, 0);
      assert.equal(await prediction.treasuryAmount(), 0);
      assert.equal((await balance.current(prediction.address)).toString(), ether("3.7").toString());

      // Epoch 2
      await nextEpoch();
      const price120 = 12000000000; // $120
      await oracle.updateAnswer(price120);
      await prediction.genesisLockRound(); // For round 1
      currentEpoch = await prediction.currentEpoch();

      await prediction.betBull(currentEpoch, { from: bullUser1, value: ether("2.1") }); // 2.1 BNB
      await prediction.betBull(currentEpoch, { from: bullUser2, value: ether("2.2") }); // 2.2 BNB
      await prediction.betBear(currentEpoch, { from: bearUser1, value: ether("2.4") }); // 2.4 BNB

      assert.equal((await prediction.rounds(1)).rewardBaseCalAmount, 0);
      assert.equal((await prediction.rounds(1)).rewardAmount, 0);
      assert.equal((await prediction.rounds(2)).rewardBaseCalAmount, 0);
      assert.equal((await prediction.rounds(2)).rewardAmount, 0);
      assert.equal(await prediction.treasuryAmount(), 0);
      assert.equal((await balance.current(prediction.address)).toString(), ether("3.7").add(ether("6.7")).toString());

      // Epoch 3, Round 1 is Bull (130 > 120)
      await nextEpoch();
      const price130 = 13000000000; // $130
      await oracle.updateAnswer(price130);
      await prediction.executeRound();
      currentEpoch = await prediction.currentEpoch();

      await prediction.betBull(currentEpoch, { from: bullUser1, value: ether("3.1").toString() }); // 3.1 BNB
      await prediction.betBull(currentEpoch, { from: bullUser2, value: ether("3.2").toString() }); // 3.2 BNB
      await prediction.betBear(currentEpoch, { from: bearUser1, value: ether("3.4").toString() }); // 3.4 BNB

      assert.equal((await prediction.rounds(1)).rewardBaseCalAmount, ether("2.3").toString()); // 2.3 BNB, Bull total
      assert.equal((await prediction.rounds(1)).rewardAmount, ether("3.7") * INITIAL_REWARD_RATE); // 3.33 BNB, Total * rewardRate
      assert.equal((await prediction.rounds(2)).rewardBaseCalAmount, 0);
      assert.equal((await prediction.rounds(2)).rewardAmount, 0);
      assert.equal(await prediction.treasuryAmount(), ether("3.7") * INITIAL_TREASURY_RATE); // 3.7 BNB, Total * treasuryRate
      assert.equal(
        (await balance.current(prediction.address)).toString(),
        ether("3.7").add(ether("6.7")).add(ether("9.7")).toString()
      );

      // Epoch 4, Round 2 is Bear (100 < 130)
      await nextEpoch();
      const price100 = 10000000000; // $100
      await oracle.updateAnswer(price100);
      await prediction.executeRound();
      currentEpoch = await prediction.currentEpoch();

      await prediction.betBull(currentEpoch, { from: bullUser1, value: ether("4.1").toString() }); // 4.1 BNB
      await prediction.betBull(currentEpoch, { from: bullUser2, value: ether("4.2").toString() }); // 4.2 BNB
      await prediction.betBear(currentEpoch, { from: bearUser1, value: ether("4.4").toString() }); // 4.4 BNB

      assert.equal((await prediction.rounds(1)).rewardBaseCalAmount, ether("2.3").toString()); // 2.3 BNB, Bull total
      assert.equal((await prediction.rounds(1)).rewardAmount, ether("3.7") * INITIAL_REWARD_RATE); // 3.33 BNB, Total * rewardRate
      assert.equal((await prediction.rounds(2)).rewardBaseCalAmount, ether("2.4").toString()); // 2.4 BNB, Bear total
      assert.equal((await prediction.rounds(2)).rewardAmount, ether("6.7") * INITIAL_REWARD_RATE); // 6.7 BNB, Total * rewardRate
      assert.equal(await prediction.treasuryAmount(), ether("3.7").add(ether("6.7")) * INITIAL_TREASURY_RATE); // 10.4, Accumulative treasury
      assert.equal(
        (await balance.current(prediction.address)).toString(),
        ether("3.7").add(ether("6.7")).add(ether("9.7")).add(ether("12.7")).toString()
      );
    });
  }
)