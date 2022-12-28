const hre = require("hardhat");
const { ADMIN, OPERATOR, DECIMALS, INITIAL_PRICE, INITIAL_TREASURY_RATE, INTERVAL_SECONDS, BUFFER_SECONDS, MIN_BET_AMOUNT,UPDATE_ALLOWANCE } = require("./config");

async function main() {
  const [ operator, admin, owner ] = await ethers.getSigners();
  const oracle = "0x26bc67F809b6c0028AB9B6614d5d4E425Ab7cfe3";
  const prediction = "0x181443333255ecE40db582cf44Dbac9EAB22dC90";

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
      ADMIN,
      OPERATOR,
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

