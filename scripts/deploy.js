const hre = require("hardhat");

async function main() {

  const PoolAddressesProvider = await hre.ethers.getContractFactory("PoolAddressesProvider");
  const poolAddressesProvider = await PoolAddressesProvider.deploy();

  console.log("PoolAddressesProvider deployed to:", poolAddressesProvider.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
