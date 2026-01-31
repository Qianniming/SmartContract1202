const hre = require("hardhat");

async function main() {
  const factoryAddress = "0xe6AE68CE10f2558C118941e77bEd2E806bD196F9"; // Deployed address
  console.log(`Verifying AetheriaFactory at: ${factoryAddress}`);

  // 1. Check if code exists at the address
  const code = await hre.ethers.provider.getCode(factoryAddress);
  if (code === "0x") {
    console.error("❌ No contract code found at the address! Deployment might have failed or is not on this network.");
    return;
  }
  console.log("✅ Contract code found at the address.");

  // 2. Attach to the contract
  const AetheriaFactory = await hre.ethers.getContractFactory("AetheriaFactory");
  const factory = AetheriaFactory.attach(factoryAddress);

  // 3. Prepare parameters for a test deployment
  const [signer] = await hre.ethers.getSigners();
  const owner = signer.address;
  const agentSigner = signer.address; // Use same address for simplicity
  const metadataURI = "ipfs://test-verification";
  const salt = hre.ethers.randomBytes(32);

  console.log(`\nTesting deployAgent...`);
  console.log(`Owner: ${owner}`);
  console.log(`Signer: ${agentSigner}`);
  console.log(`Metadata: ${metadataURI}`);

  // 4. Compute expected address
  const expectedAddress = await factory.computeAddress(owner, agentSigner, metadataURI, salt);
  console.log(`Computed Agent Address: ${expectedAddress}`);

  // 5. Deploy Agent
  console.log("Sending deployment transaction...");
  const tx = await factory.deployAgent(owner, agentSigner, metadataURI, salt);
  console.log(`Transaction Hash: ${tx.hash}`);
  
  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

  // 6. Verify Agent Deployment
  // Find AgentDeployed event
  const event = receipt.logs.find(log => {
      try {
          const parsed = factory.interface.parseLog(log);
          return parsed.name === 'AgentDeployed';
      } catch (e) {
          return false;
      }
  });

  if (event) {
      const parsedEvent = factory.interface.parseLog(event);
      const deployedAgentAddress = parsedEvent.args[0];
      console.log(`✅ Agent deployed at: ${deployedAgentAddress}`);

      if (deployedAgentAddress.toLowerCase() === expectedAddress.toLowerCase()) {
          console.log("✅ Deployed address matches computed address.");
      } else {
          console.error("❌ Address mismatch!");
          console.error(`Expected: ${expectedAddress}`);
          console.error(`Actual:   ${deployedAgentAddress}`);
      }

      // 7. Verify Agent Contract Data
      const AetheriaAgentDID = await hre.ethers.getContractFactory("AetheriaAgentDID");
      const agent = AetheriaAgentDID.attach(deployedAgentAddress);
      
      const agentOwner = await agent.ownerOf();
      const agentMeta = await agent.getMetadata();

      console.log(`\nVerifying Agent State:`);
      console.log(`Agent Owner: ${agentOwner} ${agentOwner === owner ? "✅" : "❌"}`);
      console.log(`Agent Metadata: ${agentMeta} ${agentMeta === metadataURI ? "✅" : "❌"}`);

  } else {
      console.error("❌ AgentDeployed event not found in transaction receipt.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
