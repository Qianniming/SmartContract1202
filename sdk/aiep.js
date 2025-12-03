const { ethers } = require("ethers");

function getDomain(chainId, verifyingContract) {
  return { name: "AetheriaAgentDID", version: "1", chainId, verifyingContract };
}

const Types = {
  PayEth: [
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ],
  PayERC20: [
    { name: "token", type: "address" },
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ],
  Execute: [
    { name: "target", type: "address" },
    { name: "value", type: "uint256" },
    { name: "dataHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
};

const ABI = [
  "function ownerOf() view returns (address)",
  "function setAgentSigner(address)",
  "function transferAgentOwnership(address)",
  "function getNonce() view returns (uint256)",
  "function depositToAgent() payable",
  "function balanceOf() view returns (uint256)",
  "function delegatedPayEth(address,uint256,uint256,bytes)",
  "function depositERC20(address,uint256)",
  "function balanceOfERC20(address) view returns (uint256)",
  "function delegatedPayERC20(address,address,uint256,uint256,bytes)",
  "function updateMetadata(string)",
  "function did() view returns (string)",
  "function isFrozen() view returns (bool)",
  "function getAgentSigner() view returns (address)",
  "function delegatedExecute(address,uint256,bytes,uint256,bytes)"
];

const FACTORY_ABI = [
  "event AgentDeployed(address indexed agent, address indexed owner, address indexed signer)",
  "function deployAgent(address,address,string,bytes32) returns (address)",
  "function computeAddress(address,address,string,bytes32) view returns (address)",
  "function deployAndDelegatedPayERC20(address,address,string,bytes32,address,address,uint256,uint256,bytes) returns (address)",
  "function deployAndDelegatedPayEth(address,address,string,bytes32,address,uint256,uint256,bytes) returns (address)",
  "function deployAndDelegatedExecute(address,address,string,bytes32,address,uint256,bytes,uint256,bytes) returns (address)"
];

const SAFE_MODULE_ABI = [
  "function safe() view returns (address)",
  "function signer() view returns (address)",
  "function nonce() view returns (uint256)",
  "function frozen() view returns (bool)",
  "function setSigner(address)",
  "function freeze()",
  "function unfreeze()",
  "function delegatedPayEth(address,uint256,uint256,bytes)",
  "function delegatedPayERC20(address,address,uint256,uint256,bytes)",
  "function delegatedExecute(address,uint256,bytes,uint256,bytes)"
];

class AIEP {
  constructor(providerOrSigner, address) {
    this.provider = providerOrSigner;
    this.address = address;
    this.contract = new ethers.Contract(address, ABI, providerOrSigner);
  }
  async ownerOf() { return await this.contract.ownerOf(); }
  async setAgentSigner(signer) { return await this.contract.setAgentSigner(signer); }
  async transferAgentOwnership(to) { return await this.contract.transferAgentOwnership(to); }
  async getNonce() { return await this.contract.getNonce(); }
  async depositToAgent(amountWei) { return await this.contract.depositToAgent({ value: amountWei }); }
  async balanceOf() { return await this.contract.balanceOf(); }
  async depositERC20(token, amount) { return await this.contract.depositERC20(token, amount); }
  async balanceOfERC20(token) { return await this.contract.balanceOfERC20(token); }
  async updateMetadata(uri) { return await this.contract.updateMetadata(uri); }
  async did() { return await this.contract.did(); }
  async isFrozen() { return await this.contract.isFrozen(); }
  async getAgentSigner() { return await this.contract.getAgentSigner(); }
  async delegatedPayEth(to, amountWei, deadline, signer) {
    const chainId = (await this.provider.getNetwork()).chainId;
    const domain = getDomain(chainId, this.address);
    const nonce = Number(await this.getNonce());
    const value = { to, amount: amountWei, nonce, deadline };
    const signature = await signer.signTypedData(domain, { PayEth: Types.PayEth }, value);
    return await this.contract.delegatedPayEth(to, amountWei, deadline, signature);
  }
  async delegatedPayERC20(token, to, amount, deadline, signer) {
    const chainId = (await this.provider.getNetwork()).chainId;
    const domain = getDomain(chainId, this.address);
    const nonce = Number(await this.getNonce());
    const value = { token, to, amount, nonce, deadline };
    const signature = await signer.signTypedData(domain, { PayERC20: Types.PayERC20 }, value);
    return await this.contract.delegatedPayERC20(token, to, amount, deadline, signature);
  }
  async delegatedExecute(target, valueWei, data, deadline, signer) {
    const chainId = (await this.provider.getNetwork()).chainId;
    const domain = getDomain(chainId, this.address);
    const nonce = Number(await this.getNonce());
    const dataHash = ethers.keccak256(data);
    const v = { target, value: valueWei, dataHash, nonce, deadline };
    const signature = await signer.signTypedData(domain, { Execute: Types.Execute }, v);
    return await this.contract.delegatedExecute(target, valueWei, data, deadline, signature);
  }
}

const Permissions = {
  READ: 1,
  WRITE: 2,
  EDIT_PROFILE: 4,
  PAY: 8,
  REGISTER_SERVICE: 16,
  EXECUTE: 32
};

function buildDid(chainId, contract) {
  return `did:ethr:${chainId}:${contract}`;
}

module.exports = { AIEP, Types, getDomain, Permissions, buildDid };

class AIEPFactory {
  constructor(providerOrSigner, address) {
    this.provider = providerOrSigner;
    this.address = address;
    this.contract = new ethers.Contract(address, FACTORY_ABI, providerOrSigner);
  }
  async computeAddress(owner, signer, metadataURI, salt) {
    return await this.contract.computeAddress(owner, signer, metadataURI, salt);
  }
  async deployAgent(owner, signer, metadataURI, salt) {
    return await this.contract.deployAgent(owner, signer, metadataURI, salt);
  }
}

class EasyAgent {
  constructor(provider, factoryAddress, ownerSigner, agentSigner, opts = {}) {
    this.provider = provider;
    this.factory = new AIEPFactory(ownerSigner, factoryAddress);
    this.ownerSigner = ownerSigner;
    this.agentSigner = agentSigner;
    this.metadataURI = opts.metadataURI || "ipfs://agent-profile";
    this.customSalt = opts.salt; // optional
    this.addressPromise = null;
  }
  async getAddress() {
    if (this.addressPromise) return await this.addressPromise;
    const ownerAddr = await this.ownerSigner.getAddress();
    const agentAddr = await this.agentSigner.getAddress();
    const salt = this.customSalt || ethers.keccak256(ethers.toUtf8Bytes(ownerAddr + ":" + agentAddr));
    this.salt = salt;
    this.owner = ownerAddr;
    this.addressPromise = this.factory.computeAddress(ownerAddr, agentAddr, this.metadataURI, salt);
    return await this.addressPromise;
  }
  async ensureDeployed() {
    const addr = await this.getAddress();
    const code = await this.provider.getCode(addr);
    if (code && code !== "0x") return addr;
    const agentAddr = await this.agentSigner.getAddress();
    await this.factory.deployAgent(this.owner, agentAddr, this.metadataURI, this.salt);
    return addr;
  }
  async payERC20(token, to, amount, deadlineSec) {
    const addr = await this.getAddress();
    const deadline = deadlineSec || Math.floor(Date.now() / 1000) + 3600;
    const agent = new AIEP(this.ownerSigner, addr);
    const normalized = await normalizeAmountERC20(this.provider, token, amount);
    const code = await this.provider.getCode(addr);
    const toAddr = await resolveToAddress(this.provider, to);
    if (!code || code === "0x") {
      const sig = await this._signPayERC20(addr, token, toAddr, normalized, deadline);
      const agentAddr = await this.agentSigner.getAddress();
      return await this.factory.contract.deployAndDelegatedPayERC20(this.owner, agentAddr, this.metadataURI, this.salt, token, toAddr, normalized, deadline, sig);
    }
    return await agent.delegatedPayERC20(token, toAddr, normalized, deadline, this.agentSigner);
  }
  async payEth(to, amountWei, deadlineSec) {
    const addr = await this.getAddress();
    const deadline = deadlineSec || Math.floor(Date.now() / 1000) + 3600;
    const agent = new AIEP(this.ownerSigner, addr);
    const code = await this.provider.getCode(addr);
    const toAddr = await resolveToAddress(this.provider, to);
    const wei = await normalizeWei(amountWei);
    if (!code || code === "0x") {
      const sig = await this._signPayEth(addr, toAddr, wei, deadline);
      const agentAddr = await this.agentSigner.getAddress();
      return await this.factory.contract.deployAndDelegatedPayEth(this.owner, agentAddr, this.metadataURI, this.salt, toAddr, wei, deadline, sig);
    }
    return await agent.delegatedPayEth(toAddr, wei, deadline, this.agentSigner);
  }
  async updateMetadata(uri) {
    const addr = await this.ensureDeployed();
    const agent = new AIEP(this.ownerSigner, addr);
    return await agent.updateMetadata(uri);
  }
  async _signPayERC20(addr, token, to, amount, deadline) {
    const chainId = (await this.provider.getNetwork()).chainId;
    const domain = getDomain(chainId, addr);
    const nonce = 0;
    const value = { token, to, amount, nonce, deadline };
    return await this.agentSigner.signTypedData(domain, { PayERC20: Types.PayERC20 }, value);
  }
  async _signPayEth(addr, to, amountWei, deadline) {
    const chainId = (await this.provider.getNetwork()).chainId;
    const domain = getDomain(chainId, addr);
    const nonce = 0;
    const value = { to, amount: amountWei, nonce, deadline };
    return await this.agentSigner.signTypedData(domain, { PayEth: Types.PayEth }, value);
  }
}

async function normalizeAmountERC20(provider, token, amount) {
  if (typeof amount === 'bigint' || typeof amount === 'number') return amount;
  if (typeof amount === 'string') {
    const decAbi = ["function decimals() view returns (uint8)"];
    const erc20 = new ethers.Contract(token, decAbi, provider);
    const decimals = await erc20.decimals();
    return ethers.parseUnits(amount, decimals);
  }
  throw new Error("amount must be string|number|bigint");
}

async function resolveToAddress(provider, to) {
  if (typeof to !== 'string') return to;
  if (to.endsWith('.eth')) {
    const resolved = await provider.resolveName(to);
    if (!resolved) throw new Error('ENS name not resolved');
    return resolved;
  }
  return to;
}

async function normalizeWei(amount) {
  if (typeof amount === 'bigint') return amount;
  if (typeof amount === 'number') return BigInt(amount);
  if (typeof amount === 'string') return ethers.parseEther(amount);
  throw new Error('amount must be string|number|bigint');
}

EasyAgent.prototype.getStatus = async function(token) {
  const addr = await this.getAddress();
  const code = await this.provider.getCode(addr);
  const deployed = !!(code && code !== '0x');
  let ethBalance = 0n;
  let erc20Balance = null;
  if (deployed) {
    const agent = new AIEP(this.provider, addr);
    ethBalance = await agent.balanceOf();
    if (token) erc20Balance = await agent.balanceOfERC20(token);
  }
  return { address: addr, deployed, ethBalance, erc20Balance };
};

EasyAgent.prototype.fundEth = async function(amount) {
  const addr = await this.getAddress();
  const wei = await normalizeWei(amount);
  const code = await this.provider.getCode(addr);
  if (code && code !== '0x') {
    const agent = new AIEP(this.ownerSigner, addr);
    return await agent.depositToAgent(wei);
  }
  return await this.ownerSigner.sendTransaction({ to: addr, value: wei });
};

EasyAgent.prototype.fundERC20 = async function(token, amount) {
  const addr = await this.getAddress();
  const amt = await normalizeAmountERC20(this.provider, token, amount);
  const abi = ["function transfer(address to, uint256 amount) returns (bool)"];
  const erc20 = new ethers.Contract(token, abi, this.ownerSigner);
  return await erc20.transfer(addr, amt);
};

class SafeModule {
  constructor(providerOrSigner, moduleAddress) {
    this.provider = providerOrSigner;
    this.address = moduleAddress;
    this.contract = new ethers.Contract(moduleAddress, SAFE_MODULE_ABI, providerOrSigner);
  }
  async delegatedPayEth(to, amountWei, deadline, agentSigner) {
    const chainId = (await this.provider.getNetwork()).chainId;
    const domain = getDomain(chainId, this.address);
    const nonce = Number(await this.contract.nonce());
    const value = { to, amount: amountWei, nonce, deadline };
    const signature = await agentSigner.signTypedData(domain, { PayEth: Types.PayEth }, value);
    return await this.contract.delegatedPayEth(to, amountWei, deadline, signature);
  }
  async delegatedPayERC20(token, to, amount, deadline, agentSigner) {
    const chainId = (await this.provider.getNetwork()).chainId;
    const domain = getDomain(chainId, this.address);
    const nonce = Number(await this.contract.nonce());
    const value = { token, to, amount, nonce, deadline };
    const signature = await agentSigner.signTypedData(domain, { PayERC20: Types.PayERC20 }, value);
    return await this.contract.delegatedPayERC20(token, to, amount, deadline, signature);
  }
  async delegatedExecute(target, valueWei, data, deadline, agentSigner) {
    const chainId = (await this.provider.getNetwork()).chainId;
    const domain = getDomain(chainId, this.address);
    const nonce = Number(await this.contract.nonce());
    const dataHash = ethers.keccak256(data);
    const v = { target, value: valueWei, dataHash, nonce, deadline };
    const signature = await agentSigner.signTypedData(domain, { Execute: Types.Execute }, v);
    return await this.contract.delegatedExecute(target, valueWei, data, deadline, signature);
  }
}

module.exports.AIEPFactory = AIEPFactory;
module.exports.EasyAgent = EasyAgent;
module.exports.SafeModule = SafeModule;
