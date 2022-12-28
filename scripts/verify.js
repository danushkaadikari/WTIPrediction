const hre = require("hardhat");
const { DECIMALS, INITIAL_PRICE, INITIAL_TREASURY_RATE, INTERVAL_SECONDS, BUFFER_SECONDS, MIN_BET_AMOUNT,UPDATE_ALLOWANCE } = require("./config");

async function main() {
  const [ operator, admin, owner ] = await ethers.getSigners();
  const oracle = "0xd4AF54E633166ae0651722Dd522d89154Aa365b2";
  const prediction = "0x12C4D32eB09F48678aCB0304CD344a1cfb4dF059";

  await hre.run("verify:verify", {
    address: oracle,
    constructorArguments: [
      DECIMALS, INITIAL_PRICE
    ]
  })

  await hre.run("verify:verify", {
    address: prediction,
    constructorArguments: [
      oracle,
      admin.address,
      operator.address,
      INTERVAL_SECONDS,
      BUFFER_SECONDS,
      MIN_BET_AMOUNT,
      UPDATE_ALLOWANCE,
      String(INITIAL_TREASURY_RATE * 10000),
    ]
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

