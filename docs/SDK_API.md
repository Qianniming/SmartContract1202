# SDK API 文档（AetheriaAgentDID）

本页覆盖 JavaScript 与 Python 两套 SDK 的核心 API，适配“反事实部署”（CREATE2 预计算地址、首次使用自动部署）与“一次性部署+支付/执行”的组合交易能力。

## JS SDK

- 入口：`sdk/aiep.js`
- 依赖：`ethers`

### 类：AIEP
- 构造：`new AIEP(providerOrSigner, contractAddress)`
- 只读：`ownerOf()`、`getNonce()`、`balanceOf()`、`balanceOfERC20(token)`、`did()`、`isFrozen()`、`getAgentSigner()`
- 配置：`updateMetadata(uri)`、`setAgentSigner(addr)`、`transferAgentOwnership(addr)`
- 入金：`depositToAgent(amountWei)`、`depositERC20(token, amount)`
- 委托：`delegatedPayEth(to, amountWei, deadline, signer)`、`delegatedPayERC20(token, to, amount, deadline, signer)`、`delegatedExecute(target, valueWei, data, deadline, signer)`

### 类：AIEPFactory
- 构造：`new AIEPFactory(providerOrSigner, factoryAddress)`
- 预计算：`computeAddress(owner, signer, metadataURI, salt) -> address`
- 部署：`deployAgent(owner, signer, metadataURI, salt)`
- 组合：
  - `deployAndDelegatedPayERC20(owner, signer, metadataURI, salt, token, to, amount, deadline, signature)`
  - `deployAndDelegatedPayEth(owner, signer, metadataURI, salt, to, amount, deadline, signature)`
  - `deployAndDelegatedExecute(owner, signer, metadataURI, salt, target, value, data, deadline, signature)`

### 类：EasyAgent（极简入口）
- 构造：`new EasyAgent(provider, factoryAddress, ownerSigner, agentSigner, { metadataURI?, salt? })`
  - `ownerSigner`：Owner 钱包（用于部署/配置交易）
  - `agentSigner`：Agent 本地私钥对应地址的 Signer（用于 EIP-712 委托签名）
  - `metadataURI`（可选）：Agent 元数据（默认 `ipfs://agent-profile`）
  - `salt`（可选）：CREATE2 盐，默认 `keccak(ownerAddr:agentAddr)` 保证幂等
- 地址：`getAddress() -> address`（立即得到可收款地址；未部署）
- 自动部署：`ensureDeployed() -> address`（检测未部署则部署）
- 支付：
  - `payERC20(token, to, amount, deadlineSec?)`
  - `payEth(to, amountWei, deadlineSec?)`
  - 未部署时自动走工厂“部署+支付”组合函数，使用 `nonce=0` 域签名
- 快捷配置：
  - `updateMetadata(uri)`（内部确保已部署）

### 使用示例（JS）
```js
const { ethers } = require('ethers');
const { EasyAgent } = require('../sdk/aiep');

const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
const ownerSigner = await provider.getSigner(0);
const agentSigner = await provider.getSigner(1); // 也可用本地 Wallet.fromPrivateKey
const factoryAddr = '0xFactory...';

const ea = new EasyAgent(provider, factoryAddr, ownerSigner, agentSigner, {
  metadataURI: 'ipfs://agent-profile-123',
});

const addr = await ea.getAddress(); // 立即可收款
await ea.payERC20('0xToken...', '0xShop...', ethers.parseUnits('10', 6));
```

## Python SDK

- 入口：`sdk/python/aiep.py`
- 依赖：`web3`, `eth-account`

### 类：AIEP
- 构造：`AIEP(w3, contract_address)`
- 只读：`owner_of()`、`get_nonce()`、`balance_of()`、`balance_of_erc20(token)`、`did()`、`is_frozen()`、`get_agent_signer()`
- 配置：`set_agent_signer(addr, owner_priv)`、`transfer_agent_ownership(addr, owner_priv)`、`update_metadata(uri, owner_priv)`
- 入金：`deposit_to_agent(amount_wei, owner_priv)`、`deposit_erc20(token, amount, owner_priv)`
- 委托：`delegated_pay_eth(to, amount_wei, deadline, agent_priv)`、`delegated_pay_erc20(token, to, amount, deadline, agent_priv)`、`delegated_execute(target, value_wei, data, deadline, agent_priv)`

### 类：AIEPFactory
- 构造：`AIEPFactory(w3, factory_address)`
- 预计算：`compute_address(owner, signer, metadata_uri, salt) -> address`
- 部署：`deploy_agent(owner_priv, owner, signer, metadata_uri, salt)`
- 组合：
  - `deploy_and_pay_erc20(owner_priv, owner, signer, metadata_uri, salt, token, to, amount, deadline, signature)`
  - `deploy_and_pay_eth(owner_priv, owner, signer, metadata_uri, salt, to, amount_wei, deadline, signature)`

### 类：EasyAgent（极简入口）
- 构造：`EasyAgent(w3, factory_address, owner_address, signer_private_key, metadata_uri='ipfs://agent-profile')`
  - 自动生成 `salt = keccak(owner:signer)` 并计算地址 `address`
- 自动部署：`ensure_deployed(owner_priv) -> address`
- 支付：
  - `pay_erc20(token, to, amount, owner_priv, deadline=None)`
  - `pay_eth(to, amount_wei, owner_priv, deadline=None)`
  - 未部署时自动走工厂“部署+支付”组合函数（内部构造 `nonce=0` 域签名）
- 快捷配置：
  - `update_metadata(uri, owner_priv)`

### 使用示例（Python）
```python
from web3 import Web3
from sdk.python.aiep import EasyAgent

w3 = Web3(Web3.HTTPProvider('http://127.0.0.1:8545'))
factory = '0xFactory...'
owner = '0xOwner...'
agent_priv = '0x...'  # Agent 本地私钥

ea = EasyAgent(w3, factory, owner, agent_priv, metadata_uri='ipfs://agent-profile-xyz')
addr = ea.address  # 立即可收款

ea.pay_erc20('0xToken...', '0xShop...', 10_000_000, owner_priv='0xOwnerPriv...')
```

## 反事实部署与组合交易注意事项
- 预计算地址：`computeAddress(owner, signer, metadataURI, salt)`/`compute_address(...)` 返回的地址可立即收款（合约未部署）。
- 首次调用：未部署时的首次支付/执行将使用 `nonce=0` 的 EIP-712 结构签名，并通过工厂组合函数“一次性部署+执行”。
- ETH 资金：需在部署前转入预计算地址；构造函数会同步 `ethBalance = address(this).balance`。
- ERC20 资金：可在部署前转入预计算地址；首次委托支付前，合约会同步 `balanceOf(token)` 到内部账本。

## 版本与兼容
- 域：`name = "AetheriaAgentDID"`、`version = "1"`
- Solidity：`pragma solidity ^0.8.19`（已在 L2 测试）
- 账户抽象：当前走 EIP-712 委托与外部 Relayer；Python SDK 已提供最小 ERC-4337 Bundler 客户端接口（`use_bundler`/`send_userop`）。

## Safe 模块（Gnosis Safe）
- 合约：`AetheriaSafeModule`
- JS：`SafeModule(providerOrSigner, moduleAddress)` → `delegatedPayEth/PayERC20/Execute`
- Python：`SafeModule(w3, module_address)` → 同名方法；由 Safe 执行 `execTransactionFromModule`

## Bundler（Python 最小适配）
- 客户端：`use_bundler(url) -> BundlerClient`
- 发送：`send_userop(client, entry_point, userop, max_retries=3, backoff_ms=500, on_retry=None, wait_receipt=True, receipt_timeout_sec=30)`
- 错误规范：`userop_expired`、`insufficient_funds`、`signature_invalid`、`execution_reverted`、`rpc_error: ...`

