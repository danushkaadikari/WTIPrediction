const hre = require("hardhat");

async function main() {
  const WTIPrediction = await hre.ethers.getContractFactory("WTIPrediction");
  const wtiPrediction = await WTIPrediction.deploy();

  console.log("WTIPrediction deployed to:", wtiPrediction.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
