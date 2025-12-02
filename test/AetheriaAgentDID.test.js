const { expect } = require("chai");

describe("AetheriaAgentDID", function () {
  let AetheriaAgentDID, did, owner, other, signer;

  beforeEach(async function () {
    [owner, other, signer] = await ethers.getSigners();
    AetheriaAgentDID = await ethers.getContractFactory("AetheriaAgentDID");
    did = await AetheriaAgentDID.deploy();
    await did.waitForDeployment();
  });

  it("register and owner", async function () {
    await did.registerAgent("ipfs://meta1");
    const agentId = 1n;
    expect(await did.ownerOf(agentId)).to.eq(owner.address);
    expect(await did.getMetadata(agentId)).to.eq("ipfs://meta1");
  });

  it("set agent key and verify", async function () {
    await did.registerAgent("m");
    const id = 1n;
    const key = ethers.keccak256(ethers.toUtf8Bytes("agent-key"));
    await did.setAgentKey(id, key, 0);
    expect(await did.verifyAgentKey(id, key)).to.eq(true);
  });

  it("agent key expire", async function () {
    await did.registerAgent("m");
    const id = 1n;
    const key = ethers.keccak256(ethers.toUtf8Bytes("agent-key"));
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await did.setAgentKey(id, key, BigInt(now + 10));
    expect(await did.verifyAgentKey(id, key)).to.eq(true);
    await ethers.provider.send("evm_increaseTime", [11]);
    await ethers.provider.send("evm_mine", []);
    expect(await did.verifyAgentKey(id, key)).to.eq(false);
  });

  it("authorized key create/verify/revoke", async function () {
    await did.registerAgent("m");
    const id = 1n;
    const k = ethers.keccak256(ethers.toUtf8Bytes("auth-key"));
    const perms = 0b1011;
    await did.createAuthorizedKey(id, k, 0, perms);
    expect(await did.verifyAuthorizedKey(id, k, 0b0011)).to.eq(true);
    expect(await did.verifyAuthorizedKey(id, k, 0b10000)).to.eq(false);
    await did.revokeAuthorizedKey(id, k);
    expect(await did.verifyAuthorizedKey(id, k, 0b0001)).to.eq(false);
  });

  it("authorized key expire boundary", async function () {
    await did.registerAgent("m");
    const id = 1n;
    const k = ethers.keccak256(ethers.toUtf8Bytes("auth-key"));
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await did.createAuthorizedKey(id, k, BigInt(now + 5), 0b111);
    expect(await did.verifyAuthorizedKey(id, k, 0b001)).to.eq(true);
    await ethers.provider.send("evm_increaseTime", [6]);
    await ethers.provider.send("evm_mine", []);
    expect(await did.verifyAuthorizedKey(id, k, 0b001)).to.eq(false);
  });

  it("freeze and unfreeze", async function () {
    await did.registerAgent("m");
    const id = 1n;
    const k = ethers.keccak256(ethers.toUtf8Bytes("auth-key"));
    await did.createAuthorizedKey(id, k, 0, 0b11);
    await did.freezeAgent(id);
    expect(await did.verifyAuthorizedKey(id, k, 0b01)).to.eq(false);
    await did.unfreezeAgent(id);
    expect(await did.verifyAuthorizedKey(id, k, 0b01)).to.eq(true);
  });

  it("ownership transfer", async function () {
    await did.registerAgent("m");
    const id = 1n;
    await did.transferAgentOwnership(id, other.address);
    expect(await did.ownerOf(id)).to.eq(other.address);
    await expect(did.updateMetadata(id, "ipfs://new")).to.be.revertedWith("not owner");
    await did.connect(other).updateMetadata(id, "ipfs://new");
    expect(await did.getMetadata(id)).to.eq("ipfs://new");
  });

  it("delegated create authorized key (EIP-712)", async function () {
    await did.registerAgent("m");
    const id = 1n;
    await did.setAgentSigner(id, signer.address);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = { name: "AetheriaAgentDID", version: "1", chainId, verifyingContract: await did.getAddress() };
    const types = {
      CreateAuthorizedKey: [
        { name: "agentId", type: "uint256" },
        { name: "keyHash", type: "bytes32" },
        { name: "expireAt", type: "uint256" },
        { name: "permissions", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };
    const key = ethers.keccak256(ethers.toUtf8Bytes("delegated-key"));
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const value = {
      agentId: Number(id),
      keyHash: key,
      expireAt: now + 1000,
      permissions: 0b10101,
      nonce: Number(await did.getNonce(id)),
      deadline: now + 1000
    };
    const signature = await signer.signTypedData(domain, types, value);
    await did.delegatedCreateAuthorizedKey(id, key, BigInt(value.expireAt), value.permissions, BigInt(value.deadline), signature);
    expect(await did.verifyAuthorizedKey(id, key, 0b00101)).to.eq(true);
    expect(Number(await did.getNonce(id))).to.eq(value.nonce + 1);
  });

  it("deposit and delegated pay eth", async function () {
    await did.registerAgent("m");
    const id = 1n;
    await did.depositToAgent(id, { value: ethers.parseEther("1") });
    expect(await did.balanceOf(id)).to.eq(ethers.parseEther("1"));

    await did.setAgentSigner(id, signer.address);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = { name: "AetheriaAgentDID", version: "1", chainId, verifyingContract: await did.getAddress() };
    const types = {
      PayEth: [
        { name: "agentId", type: "uint256" },
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const value = {
      agentId: Number(id),
      to: other.address,
      amount: ethers.parseEther("0.3"),
      nonce: Number(await did.getNonce(id)),
      deadline: now + 1000
    };
    const signature = await signer.signTypedData(domain, types, value);
    const balBefore = await ethers.provider.getBalance(other.address);
    await did.delegatedPayEth(id, other.address, value.amount, value.deadline, signature);
    const balAfter = await ethers.provider.getBalance(other.address);
    expect(balAfter - balBefore).to.eq(value.amount);
    expect(await did.balanceOf(id)).to.eq(ethers.parseEther("0.7"));
  });

  it("ERC20 deposit and delegated pay", async function () {
    await did.registerAgent("m");
    const id = 1n;
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy();
    await token.waitForDeployment();
    await token.mint(owner.address, ethers.parseEther("100"));
    await token.approve(await did.getAddress(), ethers.parseEther("10"));
    await did.depositERC20(id, await token.getAddress(), ethers.parseEther("10"));
    expect(await did.balanceOfERC20(id, await token.getAddress())).to.eq(ethers.parseEther("10"));

    await did.setAgentSigner(id, signer.address);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = { name: "AetheriaAgentDID", version: "1", chainId, verifyingContract: await did.getAddress() };
    const types = {
      PayERC20: [
        { name: "agentId", type: "uint256" },
        { name: "token", type: "address" },
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const value = {
      agentId: Number(id),
      token: await token.getAddress(),
      to: other.address,
      amount: ethers.parseEther("3"),
      nonce: Number(await did.getNonce(id)),
      deadline: now + 1000
    };
    const signature = await signer.signTypedData(domain, types, value);
    const balBefore = await token.balanceOf(other.address);
    await did.delegatedPayERC20(id, value.token, other.address, value.amount, value.deadline, signature);
    const balAfter = await token.balanceOf(other.address);
    expect(balAfter - balBefore).to.eq(value.amount);
    expect(await did.balanceOfERC20(id, value.token)).to.eq(ethers.parseEther("7"));
  });

  it("DID string and service endpoints", async function () {
    await did.registerAgent("ipfs://meta");
    const id = 1n;
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const expected = `did:ethr:${chainId}:${(await did.getAddress()).toLowerCase()}:${Number(id)}`;
    expect(await did.didOf(id)).to.eq(expected);

    await did.setServiceEndpoint(id, "email", "mailto:agent@aetheria.ai");
    await did.setServiceEndpoint(id, "social", "https://x.com/agent");
    expect(await did.getServiceEndpoint(id, "email")).to.eq("mailto:agent@aetheria.ai");
    const keys = await did.getServiceKeys(id);
    expect(keys.map(k=>k)).to.include.members(["email", "social"]);
  });

  it("delegated execute generic call", async function () {
    await did.registerAgent("m");
    const id = 1n;
    const MockTarget = await ethers.getContractFactory("MockTarget");
    const target = await MockTarget.deploy();
    await target.waitForDeployment();
    await did.setAgentSigner(id, signer.address);

    const data = target.interface.encodeFunctionData("setNumber", [42]);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = { name: "AetheriaAgentDID", version: "1", chainId, verifyingContract: await did.getAddress() };
    const types = {
      Execute: [
        { name: "agentId", type: "uint256" },
        { name: "target", type: "address" },
        { name: "value", type: "uint256" },
        { name: "dataHash", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const valueObj = {
      agentId: Number(id),
      target: await target.getAddress(),
      value: 0,
      dataHash: ethers.keccak256(data),
      nonce: Number(await did.getNonce(id)),
      deadline: now + 1000
    };
    const signature = await signer.signTypedData(domain, types, valueObj);
    await did.delegatedExecute(id, valueObj.target, valueObj.value, data, valueObj.deadline, signature);
    expect(await target.getNumber()).to.eq(42);
  });

  it("ERC20 fee-on-transfer deposit accounts received amount", async function () {
    await did.registerAgent("m");
    const id = 1n;
    const MockFeeToken = await ethers.getContractFactory("MockFeeToken");
    const feeToken = await MockFeeToken.deploy();
    await feeToken.waitForDeployment();
    await feeToken.mint(owner.address, ethers.parseEther("100"));
    await feeToken.approve(await did.getAddress(), ethers.parseEther("10"));
    await did.depositERC20(id, await feeToken.getAddress(), ethers.parseEther("10"));
    // 5% fee -> received 9.5
    expect(await did.balanceOfERC20(id, await feeToken.getAddress())).to.eq(ethers.parseEther("9.5"));
  });

  it("service keys length is limited", async function () {
    await did.registerAgent("meta");
    const id = 1n;
    for (let i = 0; i < 50; i++) {
      await did.setServiceEndpoint(id, `k${i}`, `v${i}`);
    }
    await expect(did.setServiceEndpoint(id, "k51", "v51")).to.be.revertedWith("service keys limit");
  });
});

