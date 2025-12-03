const { expect } = require("chai");

describe("AetheriaFactory", function () {
  let owner, signer, Factory, factory, Agent;

  beforeEach(async function () {
    [owner, signer] = await ethers.getSigners();
    Factory = await ethers.getContractFactory("AetheriaFactory");
    factory = await Factory.deploy();
    await factory.waitForDeployment();
    Agent = await ethers.getContractFactory("AetheriaAgentDID");
  });

  it("computeAddress matches deployed address", async function () {
    const metadata = "ipfs://meta";
    const salt = ethers.keccak256(ethers.toUtf8Bytes("salt-1"));
    const computed = await factory.computeAddress(owner.address, signer.address, metadata, salt);
    const tx = await factory.deployAgent(owner.address, signer.address, metadata, salt);
    const rc = await tx.wait();
    const ev = rc.logs.find(l => l.fragment && l.fragment.name === "AgentDeployed");
    const deployed = ev.args.agent;
    expect(deployed).to.eq(computed);
    const agent = await ethers.getContractAt("AetheriaAgentDID", deployed);
    expect(await agent.ownerOf()).to.eq(owner.address);
    expect(await agent.getAgentSigner()).to.eq(signer.address);
  });
});

