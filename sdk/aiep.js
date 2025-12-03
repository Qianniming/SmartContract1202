const { ethers } = require("ethers");

function getDomain(chainId, verifyingContract) {
  return { name: "AetheriaAgentDID", version: "1", chainId, verifyingContract };
}

const Types = {
  CreateAuthorizedKey: [
    { name: "agentId", type: "uint256" },
    { name: "keyHash", type: "bytes32" },
    { name: "expireAt", type: "uint256" },
    { name: "permissions", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ],
  PayEth: [
    { name: "agentId", type: "uint256" },
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ],
  PayERC20: [
    { name: "agentId", type: "uint256" },
    { name: "token", type: "address" },
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ],
  Execute: [
    { name: "agentId", type: "uint256" },
    { name: "target", type: "address" },
    { name: "value", type: "uint256" },
    { name: "dataHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
};

const ABI = [
  "function registerAgent(string metadataURI, address signer) returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function setAgentSigner(uint256,address)",
  "function transferAgentOwnership(uint256,address)",
  "function setAgentKey(uint256,bytes32,uint256)",
  "function disableAgentKey(uint256,bytes32)",
  "function createAuthorizedKey(uint256,bytes32,uint256,uint256)",
  "function revokeAuthorizedKey(uint256,bytes32)",
  "function verifyAgentKey(uint256,bytes32) view returns (bool)",
  "function verifyAuthorizedKey(uint256,bytes32,uint256) view returns (bool)",
  "function delegatedCreateAuthorizedKey(uint256,bytes32,uint256,uint256,uint256,bytes)",
  "function getNonce(uint256) view returns (uint256)",
  "function depositToAgent(uint256) payable",
  "function balanceOf(uint256) view returns (uint256)",
  "function delegatedPayEth(uint256,address,uint256,uint256,bytes)",
  "function depositERC20(uint256,address,uint256)",
  "function balanceOfERC20(uint256,address) view returns (uint256)",
  "function delegatedPayERC20(uint256,address,address,uint256,uint256,bytes)",
  "function updateMetadata(uint256,string)",
  "function setServiceEndpoint(uint256,string,string)",
  "function removeServiceEndpoint(uint256,string)",
  "function getServiceEndpoint(uint256,string) view returns (string)",
  "function getServiceKeys(uint256) view returns (string[])",
  "function didOf(uint256) view returns (string)",
  "function isFrozen(uint256) view returns (bool)",
  "function getAuthorizedKey(uint256,bytes32) view returns (uint256,uint256,bool)",
  "function getAgentSigner(uint256) view returns (address)",
  "function delegatedExecute(uint256,address,uint256,bytes,uint256,bytes)"
];

class AIEP {
  constructor(providerOrSigner, address) {
    this.provider = providerOrSigner;
    this.address = address;
    this.contract = new ethers.Contract(address, ABI, providerOrSigner);
  }
  async registerAgent(metadataURI, signer = "0x0000000000000000000000000000000000000000") { return await this.contract.registerAgent(metadataURI, signer); }
  async ownerOf(agentId) { return await this.contract.ownerOf(agentId); }
  async setAgentSigner(agentId, signer) { return await this.contract.setAgentSigner(agentId, signer); }
  async transferAgentOwnership(agentId, to) { return await this.contract.transferAgentOwnership(agentId, to); }
  async setAgentKey(agentId, keyHash, expireAt) { return await this.contract.setAgentKey(agentId, keyHash, expireAt); }
  async disableAgentKey(agentId, keyHash) { return await this.contract.disableAgentKey(agentId, keyHash); }
  async createAuthorizedKey(agentId, keyHash, expireAt, permissions) { return await this.contract.createAuthorizedKey(agentId, keyHash, expireAt, permissions); }
  async revokeAuthorizedKey(agentId, keyHash) { return await this.contract.revokeAuthorizedKey(agentId, keyHash); }
  async verifyAgentKey(agentId, keyHash) { return await this.contract.verifyAgentKey(agentId, keyHash); }
  async verifyAuthorizedKey(agentId, keyHash, requiredPermissions) { return await this.contract.verifyAuthorizedKey(agentId, keyHash, requiredPermissions); }
  async getNonce(agentId) { return await this.contract.getNonce(agentId); }
  async depositToAgent(agentId, amountWei) { return await this.contract.depositToAgent(agentId, { value: amountWei }); }
  async balanceOf(agentId) { return await this.contract.balanceOf(agentId); }
  async depositERC20(agentId, token, amount) { return await this.contract.depositERC20(agentId, token, amount); }
  async balanceOfERC20(agentId, token) { return await this.contract.balanceOfERC20(agentId, token); }
  async updateMetadata(agentId, uri) { return await this.contract.updateMetadata(agentId, uri); }
  async setServiceEndpoint(agentId, key, value) { return await this.contract.setServiceEndpoint(agentId, key, value); }
  async removeServiceEndpoint(agentId, key) { return await this.contract.removeServiceEndpoint(agentId, key); }
  async getServiceEndpoint(agentId, key) { return await this.contract.getServiceEndpoint(agentId, key); }
  async getServiceKeys(agentId) { return await this.contract.getServiceKeys(agentId); }
  async didOf(agentId) { return await this.contract.didOf(agentId); }
  async isFrozen(agentId) { return await this.contract.isFrozen(agentId); }
  async getAuthorizedKey(agentId, keyHash) { return await this.contract.getAuthorizedKey(agentId, keyHash); }
  async getAgentSigner(agentId) { return await this.contract.getAgentSigner(agentId); }
  async delegatedCreateAuthorizedKey(agentId, keyHash, expireAt, permissions, deadline, signer) {
    const chainId = (await this.provider.getNetwork()).chainId;
    const domain = getDomain(chainId, this.address);
    const nonce = Number(await this.getNonce(agentId));
    const value = { agentId: Number(agentId), keyHash, expireAt, permissions, nonce, deadline };
    const signature = await signer.signTypedData(domain, { CreateAuthorizedKey: Types.CreateAuthorizedKey }, value);
    return await this.contract.delegatedCreateAuthorizedKey(agentId, keyHash, expireAt, permissions, deadline, signature);
  }
  async delegatedPayEth(agentId, to, amountWei, deadline, signer) {
    const chainId = (await this.provider.getNetwork()).chainId;
    const domain = getDomain(chainId, this.address);
    const nonce = Number(await this.getNonce(agentId));
    const value = { agentId: Number(agentId), to, amount: amountWei, nonce, deadline };
    const signature = await signer.signTypedData(domain, { PayEth: Types.PayEth }, value);
    return await this.contract.delegatedPayEth(agentId, to, amountWei, deadline, signature);
  }
  async delegatedPayERC20(agentId, token, to, amount, deadline, signer) {
    const chainId = (await this.provider.getNetwork()).chainId;
    const domain = getDomain(chainId, this.address);
    const nonce = Number(await this.getNonce(agentId));
    const value = { agentId: Number(agentId), token, to, amount, nonce, deadline };
    const signature = await signer.signTypedData(domain, { PayERC20: Types.PayERC20 }, value);
    return await this.contract.delegatedPayERC20(agentId, token, to, amount, deadline, signature);
  }
  async delegatedExecute(agentId, target, valueWei, data, deadline, signer) {
    const chainId = (await this.provider.getNetwork()).chainId;
    const domain = getDomain(chainId, this.address);
    const nonce = Number(await this.getNonce(agentId));
    const dataHash = ethers.keccak256(data);
    const v = { agentId: Number(agentId), target, value: valueWei, dataHash, nonce, deadline };
    const signature = await signer.signTypedData(domain, { Execute: Types.Execute }, v);
    return await this.contract.delegatedExecute(agentId, target, valueWei, data, deadline, signature);
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

function buildDid(chainId, contract, agentId) {
  return `did:ethr:${chainId}:${contract}:${Number(agentId)}`;
}

module.exports = { AIEP, Types, getDomain, Permissions, buildDid };
