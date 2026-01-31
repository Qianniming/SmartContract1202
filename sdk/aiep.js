/**
 * AIEP (AI-Agent Identity & Execution Protocol) JavaScript SDK
 * 用于与 AetheriaAgentDID 智能合约交互的官方 SDK。
 * 支持 DID 身份管理、EIP-712 委托支付和执行、以及反事实部署逻辑。
 */

const { ethers } = require("ethers");

/**
 * 获取 EIP-712 域信息
 * @param {number} chainId 链 ID
 * @param {string} verifyingContract 验证签名的合约地址
 */
function getDomain(chainId, verifyingContract) {
  return {
    name: "AetheriaAgentDID",
    version: "1",
    chainId,
    verifyingContract
  };
}

/**
 * EIP-712 结构化数据类型定义
 * 必须与 AetheriaAgentDID.sol 中的 TYPEHASH 定义保持完全一致
 */
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

/**
 * AetheriaAgentDID 核心合约 ABI
 */
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

/**
 * AetheriaFactory 工厂合约 ABI
 */
const FACTORY_ABI = [
  "event AgentDeployed(address indexed agent, address indexed owner, address indexed signer)",
  "function deployAgent(address,address,string,bytes32) returns (address)",
  "function computeAddress(address,address,string,bytes32) view returns (address)",
  "function deployAndDelegatedPayERC20(address,address,string,bytes32,address,address,uint256,uint256,bytes) returns (address)",
  "function deployAndDelegatedPayEth(address,address,string,bytes32,address,uint256,uint256,bytes) returns (address)",
  "function deployAndDelegatedExecute(address,address,string,bytes32,address,uint256,bytes,uint256,bytes) returns (address)"
];

/**
 * AetheriaSafeModule 模块 ABI (用于 Gnosis Safe 扩展)
 */
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

/**
 * AIEP 类：处理已部署 Agent 合约的交互
 */
class AIEP {
  /**
   * @param {ethers.Provider | ethers.Signer} providerOrSigner Ethers 提供者或签名者
   * @param {string} address Agent 合约地址
   */
  constructor(providerOrSigner, address) {
    this.provider = providerOrSigner;
    this.address = address;
    this.contract = new ethers.Contract(address, ABI, providerOrSigner);
  }

  // --- 基础状态查询 ---
  async ownerOf() { return await this.contract.ownerOf(); }
  async getNonce() { return await this.contract.getNonce(); }
  async balanceOf() { return await this.contract.balanceOf(); }
  async balanceOfERC20(token) { return await this.contract.balanceOfERC20(token); }
  async did() { return await this.contract.did(); }
  async isFrozen() { return await this.contract.isFrozen(); }
  async getAgentSigner() { return await this.contract.getAgentSigner(); }

  // --- 所有者权限操作 ---
  async setAgentSigner(signer) { return await this.contract.setAgentSigner(signer); }
  async transferAgentOwnership(to) { return await this.contract.transferAgentOwnership(to); }
  async updateMetadata(uri) { return await this.contract.updateMetadata(uri); }
  async depositToAgent(amountWei) { return await this.contract.depositToAgent({ value: amountWei }); }
  async depositERC20(token, amount) { return await this.contract.depositERC20(token, amount); }

  // --- 委托支付与执行 (EIP-712) ---

  /**
   * 委托支付原生 ETH
   * @param {string} to 接收者
   * @param {bigint} amountWei 金额
   * @param {number} deadline 截止时间戳
   * @param {ethers.Signer} signer 具备签名权限的热密钥
   */
  async delegatedPayEth(to, amountWei, deadline, signer) {
    const { domain, value, signature } = await this.signDelegatedPayEth(to, amountWei, deadline, signer);
    return await this.contract.delegatedPayEth(to, amountWei, deadline, signature);
  }

  async signDelegatedPayEth(to, amountWei, deadline, signer) {
    const network = await (signer.provider || this.provider).getNetwork();
    const chainId = network.chainId;
    const domain = getDomain(chainId, this.address);
    const nonce = await this.getNonce();
    const value = { to, amount: amountWei, nonce, deadline };
    const signature = await signer.signTypedData(domain, { PayEth: Types.PayEth }, value);
    return { domain, value, signature };
  }

  /**
   * 委托支付 ERC20 代币
   */
  async delegatedPayERC20(token, to, amount, deadline, signer) {
    const { signature } = await this.signDelegatedPayERC20(token, to, amount, deadline, signer);
    return await this.contract.delegatedPayERC20(token, to, amount, deadline, signature);
  }

  async signDelegatedPayERC20(token, to, amount, deadline, signer) {
    const network = await (signer.provider || this.provider).getNetwork();
    const chainId = network.chainId;
    const domain = getDomain(chainId, this.address);
    const nonce = await this.getNonce();
    const value = { token, to, amount, nonce, deadline };
    const signature = await signer.signTypedData(domain, { PayERC20: Types.PayERC20 }, value);
    return { domain, value, signature };
  }

  /**
   * 委托执行任意合约调用
   */
  async delegatedExecute(target, valueWei, data, deadline, signer) {
    const { signature } = await this.signDelegatedExecute(target, valueWei, data, deadline, signer);
    return await this.contract.delegatedExecute(target, valueWei, data, deadline, signature);
  }

  async signDelegatedExecute(target, valueWei, data, deadline, signer) {
    const network = await (signer.provider || this.provider).getNetwork();
    const chainId = network.chainId;
    const domain = getDomain(chainId, this.address);
    const nonce = await this.getNonce();
    const dataHash = ethers.keccak256(data);
    const value = { target, value: valueWei, dataHash, nonce, deadline };
    const signature = await signer.signTypedData(domain, { Execute: Types.Execute }, value);
    return { domain, value, signature };
  }
}

/**
 * AIEPFactory 类：处理 Agent 的创建和预计算地址
 */
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

/**
 * EasyAgent 类：高级封装，支持“即用即部署”的反事实逻辑
 */
class EasyAgent {
  /**
   * @param {ethers.Provider} provider 
   * @param {string} factoryAddress 
   * @param {ethers.Signer} ownerSigner 所有者签名者 (冷钱包)
   * @param {ethers.Signer} agentSigner 代理签名者 (热密钥)
   * @param {object} opts 配置项 (metadataURI, salt)
   */
  constructor(provider, factoryAddress, ownerSigner, agentSigner, opts = {}) {
    this.provider = provider;
    this.factory = new AIEPFactory(ownerSigner, factoryAddress);
    this.ownerSigner = ownerSigner;
    this.agentSigner = agentSigner;
    this.metadataURI = opts.metadataURI || "ipfs://aetheria-agent-profile";
    this.customSalt = opts.salt;
    this.addressPromise = null;
  }

  /**
   * 预计算 Agent 的合约地址
   */
  async getAddress() {
    if (this.addressPromise) return await this.addressPromise;
    const ownerAddr = await this.ownerSigner.getAddress();
    const agentAddr = await this.agentSigner.getAddress();
    // 如果没有提供自定义 salt，则根据所有者和签名者地址生成确定性 salt
    this.salt = this.customSalt || ethers.keccak256(ethers.toUtf8Bytes(`${ownerAddr}:${agentAddr}`));
    this.owner = ownerAddr;
    this.addressPromise = this.factory.computeAddress(ownerAddr, agentAddr, this.metadataURI, this.salt);
    return await this.addressPromise;
  }

  /**
   * 确保 Agent 已部署在链上
   */
  async ensureDeployed() {
    const addr = await this.getAddress();
    const code = await this.provider.getCode(addr);
    if (code && code !== "0x") return addr;
    const agentAddr = await this.agentSigner.getAddress();
    const tx = await this.factory.deployAgent(this.owner, agentAddr, this.metadataURI, this.salt);
    await tx.wait();
    return addr;
  }

  /**
   * 支付 ERC20 代币 (如果未部署，则合并部署与支付交易)
   */
  async payERC20(token, to, amount, deadlineSec, opts = {}) {
    const addr = await this.getAddress();
    const deadline = deadlineSec || Math.floor(Date.now() / 1000) + 3600;
    const agent = new AIEP(this.ownerSigner, addr);
    const normalizedAmount = await normalizeAmountERC20(this.provider, token, amount);
    const code = await this.provider.getCode(addr);
    const toAddr = await resolveToAddress(this.provider, to);

    // 自动补足资金逻辑
    if (opts.autoRefill) {
      const min = await normalizeAmountERC20(this.provider, token, opts.autoRefill.minToken || amount);
      const bal = (code && code !== "0x") ? await agent.balanceOfERC20(token) : 0n;
      if (bal < min) {
        const refillAmt = opts.autoRefill.refillAmount || (min - bal);
        await this.fundERC20(token, refillAmt);
      }
    }

    if (!code || code === "0x") {
      // 合并部署交易
      const chainId = (await this.provider.getNetwork()).chainId;
      const domain = getDomain(chainId, addr);
      const value = { token, to: toAddr, amount: normalizedAmount, nonce: 0, deadline };
      const signature = await this.agentSigner.signTypedData(domain, { PayERC20: Types.PayERC20 }, value);
      const agentAddr = await this.agentSigner.getAddress();
      return await this.factory.contract.deployAndDelegatedPayERC20(
        this.owner, agentAddr, this.metadataURI, this.salt, 
        token, toAddr, normalizedAmount, deadline, signature
      );
    }
    return await agent.delegatedPayERC20(token, toAddr, normalizedAmount, deadline, this.agentSigner);
  }

  /**
   * 支付 ETH (如果未部署，则合并部署与支付交易)
   */
  async payEth(to, amountWei, deadlineSec, opts = {}) {
    const addr = await this.getAddress();
    const deadline = deadlineSec || Math.floor(Date.now() / 1000) + 3600;
    const agent = new AIEP(this.ownerSigner, addr);
    const code = await this.provider.getCode(addr);
    const toAddr = await resolveToAddress(this.provider, to);
    const wei = await normalizeWei(amountWei);

    if (opts.autoRefill) {
      const min = await normalizeWei(opts.autoRefill.minWei || wei);
      const bal = (code && code !== "0x") ? await agent.balanceOf() : 0n;
      if (bal < min) {
        const refillWei = await normalizeWei(opts.autoRefill.refillWei || (min - bal));
        await this.fundEth(refillWei);
      }
    }

    if (!code || code === "0x") {
      const chainId = (await this.provider.getNetwork()).chainId;
      const domain = getDomain(chainId, addr);
      const value = { to: toAddr, amount: wei, nonce: 0, deadline };
      const signature = await this.agentSigner.signTypedData(domain, { PayEth: Types.PayEth }, value);
      const agentAddr = await this.agentSigner.getAddress();
      return await this.factory.contract.deployAndDelegatedPayEth(
        this.owner, agentAddr, this.metadataURI, this.salt, 
        toAddr, wei, deadline, signature
      );
    }
    return await agent.delegatedPayEth(toAddr, wei, deadline, this.agentSigner);
  }

  /**
   * 给 Agent 充值 ETH
   */
  async fundEth(amount) {
    const addr = await this.getAddress();
    const wei = await normalizeWei(amount);
    const code = await this.provider.getCode(addr);
    if (code && code !== '0x') {
      const agent = new AIEP(this.ownerSigner, addr);
      return await agent.depositToAgent(wei);
    }
    return await this.ownerSigner.sendTransaction({ to: addr, value: wei });
  }

  /**
   * 给 Agent 充值 ERC20
   */
  async fundERC20(token, amount) {
    const addr = await this.getAddress();
    const amt = await normalizeAmountERC20(this.provider, token, amount);
    const erc20 = new ethers.Contract(token, ["function transfer(address,uint256) returns (bool)"], this.ownerSigner);
    return await erc20.transfer(addr, amt);
  }

  async getStatus(token = null) {
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
  }
}

/**
 * 辅助函数：格式化 ERC20 金额 (支持字符串形式的单位，如 "1.5")
 */
async function normalizeAmountERC20(provider, token, amount) {
  if (typeof amount === 'bigint') return amount;
  if (typeof amount === 'number') return BigInt(amount);
  if (typeof amount === 'string') {
    const erc20 = new ethers.Contract(token, ["function decimals() view returns (uint8)"], provider);
    const decimals = await erc20.decimals();
    return ethers.parseUnits(amount, decimals);
  }
  throw new Error("Invalid amount type: must be string, number or bigint");
}

/**
 * 辅助函数：格式化 ETH 金额
 */
async function normalizeWei(amount) {
  if (typeof amount === 'bigint') return amount;
  if (typeof amount === 'number') return BigInt(amount);
  if (typeof amount === 'string') return ethers.parseEther(amount);
  throw new Error('Invalid wei amount: must be string, number or bigint');
}

/**
 * 辅助函数：解析地址 (支持 ENS，如 "vitalik.eth")
 */
async function resolveToAddress(provider, to) {
  if (typeof to !== 'string') return to;
  if (to.endsWith('.eth')) {
    const resolved = await provider.resolveName(to);
    if (!resolved) throw new Error(`ENS name could not be resolved: ${to}`);
    return resolved;
  }
  return to;
}

/**
 * 导出模块
 */
module.exports = {
  AIEP,
  AIEPFactory,
  EasyAgent,
  Types,
  getDomain,
  buildDid: (chainId, contract) => `did:ethr:${chainId}:${contract.toLowerCase()}`
};
