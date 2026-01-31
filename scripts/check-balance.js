const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const address = await signer.getAddress();
  const balance = await hre.ethers.provider.getBalance(address);

  console.log(`Address: ${address}`);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} OG`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
