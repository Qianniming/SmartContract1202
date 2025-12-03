const { expect } = require("chai");

describe("AetheriaAgentDID", function () {
  let AetheriaAgentDID, did, owner, other, signer;

  beforeEach(async function () {
    [owner, other, signer] = await ethers.getSigners();
    AetheriaAgentDID = await ethers.getContractFactory("AetheriaAgentDID");
    did = await AetheriaAgentDID.deploy(owner.address, ethers.ZeroAddress, "ipfs://meta");
    await did.waitForDeployment();
  });

  it("owner and metadata", async function () {
    expect(await did.ownerOf()).to.eq(owner.address);
    expect(await did.getMetadata()).to.eq("ipfs://meta");
  });

  it("freeze and unfreeze blocks delegated ops", async function () {
    await did.depositToAgent({ value: ethers.parseEther("1") });
    await did.setAgentSigner(signer.address);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = { name: "AetheriaAgentDID", version: "1", chainId, verifyingContract: await did.getAddress() };
    const types = {
      PayEth: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const value = {
      to: other.address,
      amount: ethers.parseEther("0.1"),
      nonce: Number(await did.getNonce()),
      deadline: now + 1000
    };
    const signature = await signer.signTypedData(domain, types, value);
    await did.freezeAgent();
    await expect(did.delegatedPayEth(other.address, value.amount, value.deadline, signature)).to.be.revertedWith("frozen");
    await did.unfreezeAgent();
    await did.delegatedPayEth(other.address, value.amount, value.deadline, signature);
  });

  it("ownership transfer", async function () {
    await did.transferAgentOwnership(other.address);
    expect(await did.ownerOf()).to.eq(other.address);
    await expect(did.updateMetadata("ipfs://new")).to.be.revertedWith("not owner");
    await did.connect(other).updateMetadata("ipfs://new");
    expect(await did.getMetadata()).to.eq("ipfs://new");
  });


  it("deposit and delegated pay eth", async function () {
    await did.depositToAgent({ value: ethers.parseEther("1") });
    expect(await did.balanceOf()).to.eq(ethers.parseEther("1"));

    await did.setAgentSigner(signer.address);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = { name: "AetheriaAgentDID", version: "1", chainId, verifyingContract: await did.getAddress() };
    const types = {
      PayEth: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const value = {
      to: other.address,
      amount: ethers.parseEther("0.3"),
      nonce: Number(await did.getNonce()),
      deadline: now + 1000
    };
    const signature = await signer.signTypedData(domain, types, value);
    const balBefore = await ethers.provider.getBalance(other.address);
    await did.delegatedPayEth(other.address, value.amount, value.deadline, signature);
    const balAfter = await ethers.provider.getBalance(other.address);
    expect(balAfter - balBefore).to.eq(value.amount);
    expect(await did.balanceOf()).to.eq(ethers.parseEther("0.7"));
  });

  it("ERC20 deposit and delegated pay", async function () {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy();
    await token.waitForDeployment();
    await token.mint(owner.address, ethers.parseEther("100"));
    await token.approve(await did.getAddress(), ethers.parseEther("10"));
    await did.depositERC20(await token.getAddress(), ethers.parseEther("10"));
    expect(await did.balanceOfERC20(await token.getAddress())).to.eq(ethers.parseEther("10"));

    await did.setAgentSigner(signer.address);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = { name: "AetheriaAgentDID", version: "1", chainId, verifyingContract: await did.getAddress() };
    const types = {
      PayERC20: [
        { name: "token", type: "address" },
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const value = {
      token: await token.getAddress(),
      to: other.address,
      amount: ethers.parseEther("3"),
      nonce: Number(await did.getNonce()),
      deadline: now + 1000
    };
    const signature = await signer.signTypedData(domain, types, value);
    const balBefore = await token.balanceOf(other.address);
    await did.delegatedPayERC20(value.token, other.address, value.amount, value.deadline, signature);
    const balAfter = await token.balanceOf(other.address);
    expect(balAfter - balBefore).to.eq(value.amount);
    expect(await did.balanceOfERC20(value.token)).to.eq(ethers.parseEther("7"));
  });

  it("DID string", async function () {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const expected = `did:ethr:${chainId}:${(await did.getAddress()).toLowerCase()}`;
    expect(await did.did()).to.eq(expected);
  });

  it("delegated execute generic call", async function () {
    const MockTarget = await ethers.getContractFactory("MockTarget");
    const target = await MockTarget.deploy();
    await target.waitForDeployment();
    await did.setAgentSigner(signer.address);

    const data = target.interface.encodeFunctionData("setNumber", [42]);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = { name: "AetheriaAgentDID", version: "1", chainId, verifyingContract: await did.getAddress() };
    const types = {
      Execute: [
        { name: "target", type: "address" },
        { name: "value", type: "uint256" },
        { name: "dataHash", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const valueObj = {
      target: await target.getAddress(),
      value: 0,
      dataHash: ethers.keccak256(data),
      nonce: Number(await did.getNonce()),
      deadline: now + 1000
    };
    const signature = await signer.signTypedData(domain, types, valueObj);
    await did.delegatedExecute(valueObj.target, valueObj.value, data, valueObj.deadline, signature);
    expect(await target.getNumber()).to.eq(42);
  });

  it("ERC20 fee-on-transfer deposit accounts received amount", async function () {
    const MockFeeToken = await ethers.getContractFactory("MockFeeToken");
    const feeToken = await MockFeeToken.deploy();
    await feeToken.waitForDeployment();
    await feeToken.mint(owner.address, ethers.parseEther("100"));
    await feeToken.approve(await did.getAddress(), ethers.parseEther("10"));
    await did.depositERC20(await feeToken.getAddress(), ethers.parseEther("10"));
    // 5% fee -> received 9.5
    expect(await did.balanceOfERC20(await feeToken.getAddress())).to.eq(ethers.parseEther("9.5"));
  });

  
});

