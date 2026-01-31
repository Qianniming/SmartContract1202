const hre = require("hardhat");

async function main() {
  console.log("Deploying AetheriaFactory...");

  const AetheriaFactory = await hre.ethers.getContractFactory("AetheriaFactory");
  const factory = await AetheriaFactory.deploy();

  await factory.waitForDeployment();

  const address = await factory.getAddress();
  console.log(`AetheriaFactory deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
