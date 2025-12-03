const { ethers } = require("ethers");
const { EasyAgent, BatchSender } = require("../sdk/aiep");

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const owner = await provider.getSigner(0);
  const agentSigner = await provider.getSigner(1);
  const factoryAddress = process.env.AIEP_FACTORY;
  const recipient = await (await provider.getSigner(2)).getAddress();

  const ea = new EasyAgent(provider, factoryAddress, owner, agentSigner, { metadataURI: "ipfs://agent-profile" });
  const addr = await ea.ensureDeployed();

  await ea.payEth(recipient, ethers.parseEther("0.05"), Math.floor(Date.now() / 1000) + 3600, {
    autoRefill: { minWei: ethers.parseEther("0.1"), refillWei: ethers.parseEther("0.2") }
  });

  const batch = new BatchSender(ea);
  batch.addPayEth(recipient, ethers.parseEther("0.01"), Math.floor(Date.now() / 1000) + 3600, {
    autoRefill: { minWei: ethers.parseEther("0.05"), refillWei: ethers.parseEther("0.1") }
  });
  batch.addExecute(addr, 0n, "0x", Math.floor(Date.now() / 1000) + 3600);
  await batch.send();
}

main().catch(console.error);
