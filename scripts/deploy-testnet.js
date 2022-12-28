const { ethers } = require("hardhat");
const { DECIMALS, INITIAL_PRICE, INITIAL_TREASURY_RATE, INTERVAL_SECONDS, BUFFER_SECONDS, MIN_BET_AMOUNT,UPDATE_ALLOWANCE } = require("./config");

async function main() {
  const [ operator, admin, owner ] = await ethers.getSigners();

  const Oracle = await ethers.getContractFactory("MockAggregatorV3");
  const oracle = await Oracle.connect(owner).deploy(DECIMALS, INITIAL_PRICE);
  oracle.deployed(); 

  console.log("WTI Price Oracle deployed to:", oracle.address);

  const WTIPrediction = await ethers.getContractFactory("WTIPrediction");
  const wtiPrediction = await WTIPrediction.connect(owner).deploy(
    oracle.address,
    admin.address,
    operator.address,
    INTERVAL_SECONDS,
    BUFFER_SECONDS,
    MIN_BET_AMOUNT,
    UPDATE_ALLOWANCE,
    String(INITIAL_TREASURY_RATE * 10000),
  );
  wtiPrediction.deployed();

  console.log("WTIPrediction deployed to:", wtiPrediction.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
