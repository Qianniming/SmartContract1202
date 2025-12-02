# AetheriaAgentDID 智能合约说明

本仓库实现了符合 Aetheria DID v2.0 规范的 AI Agent 链上身份与授权管理合约 `AetheriaAgentDID`，支持多 Agent、所有权与签名人控制、密钥管理、权限位校验、EIP-712 委托操作以及紧急冻结机制。

## 主要特性
- 链上身份根：每个 Agent 以 `agentId` 标识，形成统一可验证的 DID 身份根
- 所有权控制：`owner` 对对应 `agentId` 拥有最高权限，可转移所有权
- 可轮换密钥：Agent Key 与 Authorized Key 支持启用/过期/撤销，低成本管理凭证
- 细粒度权限：Authorized Key 使用 `permissions` 位掩码控制权限集合
- 委托操作：支持 EIP-712 typed data 签名的授权创建，由第三方上链执行，适配 gas relayer
- 紧急冻结：`freezeAgent`/`unfreezeAgent` 控制 Agent 状态，冻结时验证直接失败

## 运行逻辑概述
- 多 Agent 架构：`agentId -> AgentInfo{ owner, signer, metadataURI, agentKeys, authorizedKeys }`
- 验证规则：
  - 冻结的 Agent 所有验证失败
  - `expireAt == 0` 表示永不过期；超过 `expireAt` 视为过期
  - 权限位校验：`(storedPermissions & requiredPermissions) == requiredPermissions`
- 委托授权：
  - Owner 为 Agent 绑定 `signer` 地址（云端私钥对应地址）
  - 云端生成 EIP-712 签名，第三方提交到 `delegatedCreateAuthorizedKey`，合约使用 `ecrecover` 校验并执行
  - 使用 `nonces[agentId]` 防重放，签名有效期由 `deadline` 控制

## 数据结构
- AgentKey：`keyHash`、`expireAt`、`enabled`
- AuthorizedKey：`keyHash`、`expireAt`、`permissions`、`enabled`
- AgentInfo：`owner`、`signer`、`metadataURI`，以及密钥映射

## 合约接口（external）
- 注册与查询
  - `registerAgent(string metadataURI) returns (uint256 agentId)`
  - `ownerOf(uint256 agentId) view returns (address)`
  - `getMetadata(uint256 agentId) view returns (string)`
  - `getNonce(uint256 agentId) view returns (uint256)`
- 所有权与签名人管理
  - `transferAgentOwnership(uint256 agentId, address newOwner)`
  - `setAgentSigner(uint256 agentId, address signer)`
- Agent Key（Agent 自用密钥）
  - `setAgentKey(uint256 agentId, bytes32 keyHash, uint256 expireAt)`
  - `verifyAgentKey(uint256 agentId, bytes32 keyHash) view returns (bool)`
- Authorized Key（外部应用访问令牌）
  - `createAuthorizedKey(uint256 agentId, bytes32 keyHash, uint256 expireAt, uint256 permissions)`
  - `delegatedCreateAuthorizedKey(uint256 agentId, bytes32 keyHash, uint256 expireAt, uint256 permissions, uint256 deadline, bytes signature)`
  - `revokeAuthorizedKey(uint256 agentId, bytes32 keyHash)`
  - `verifyAuthorizedKey(uint256 agentId, bytes32 keyHash, uint256 requiredPermissions) view returns (bool)`
- 冻结机制
  - `freezeAgent(uint256 agentId)`
  - `unfreezeAgent(uint256 agentId)`

## 更多接口（扩展）
- 只读扩展
  - `isFrozen(uint256 agentId) view returns (bool)`
  - `getAuthorizedKey(uint256 agentId, bytes32 keyHash) view returns (uint256 expireAt, uint256 permissions, bool enabled)`
  - `getAgentSigner(uint256 agentId) view returns (address)`
- Agent Key 管理扩展
  - `disableAgentKey(uint256 agentId, bytes32 keyHash)`
- 资金（ETH / ERC20）
  - `depositToAgent(uint256 agentId)` payable
  - `balanceOf(uint256 agentId) view returns (uint256)`
  - `delegatedPayEth(uint256 agentId, address to, uint256 amount, uint256 deadline, bytes signature)`
  - `depositERC20(uint256 agentId, address token, uint256 amount)`
  - `balanceOfERC20(uint256 agentId, address token) view returns (uint256)`
  - `delegatedPayERC20(uint256 agentId, address token, address to, uint256 amount, uint256 deadline, bytes signature)`
- 服务端点
  - `setServiceEndpoint(uint256 agentId, string key, string value)`
  - `removeServiceEndpoint(uint256 agentId, string key)`
  - `getServiceEndpoint(uint256 agentId, string key) view returns (string)`
  - `getServiceKeys(uint256 agentId) view returns (string[])`
- DID 标识
  - `didOf(uint256 agentId) view returns (string)`
- 通用委托执行
  - `delegatedExecute(uint256 agentId, address target, uint256 value, bytes data, uint256 deadline, bytes signature)`

## 事件（events）
- `AgentRegistered(agentId, owner, metadataURI)`
- `AgentKeySet(agentId, keyHash, expireAt, enabled)`
- `AuthorizedKeyCreated(agentId, keyHash, expireAt, permissions, enabled)`
- `AuthorizedKeyRevoked(agentId, keyHash)`
- `MetadataUpdated(agentId, metadataURI)`
- `AgentFrozen(agentId)` / `AgentUnfrozen(agentId)`
- `AgentSignerSet(agentId, signer)`
- `DelegatedAuthorizedKeyCreated(agentId, keyHash, expireAt, permissions)`
- `AgentOwnershipTransferred(agentId, previousOwner, newOwner)`

## EIP-712 委托授权规范
- 域分隔：`EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)`
  - `name = "AetheriaAgentDID"`、`version = "1"`
- TypedData：`CreateAuthorizedKey(uint256 agentId,bytes32 keyHash,uint256 expireAt,uint256 permissions,uint256 nonce,uint256 deadline)`
- 校验要点：
  - `deadline` 未过期
  - `recovered == signer`
  - `s <= secp256k1n/2`（防签名可塑性）
  - 将 `nonces[agentId]` 自增，防重放

示例（前端/云端构造并签名）：
- 域：`{ name: "AetheriaAgentDID", version: "1", chainId, verifyingContract }`
- 数据：`{ agentId, keyHash, expireAt, permissions, nonce, deadline }`
- 签名：`signature = signer.signTypedData(domain, types, value)`
- 上链：`delegatedCreateAuthorizedKey(agentId, keyHash, expireAt, permissions, deadline, signature)`

## 验证逻辑
- `verifyAgentKey`：检查 `owner` 存在、未冻结、key 启用、未过期、哈希匹配
- `verifyAuthorizedKey`：在上述基础上，额外检查权限位包含 `requiredPermissions`

## 文件结构
- 合约：`src/AetheriaAgentDID.sol`
- 测试：`test/AetheriaAgentDID.test.js`
- 配置：`hardhat.config.js`
- 包管理：`package.json`

## 本地开发与测试
- 安装依赖：`npm install`
- 运行测试：`npx hardhat test`
- 常见断言覆盖：注册、AgentKey 设置与过期、AuthorizedKey 创建/权限/过期/撤销、冻结/解冻、所有权迁移、EIP-712 委托授权与 nonce 自增

## 安全注意事项
- 建议将 `signer` 配置为安全的云端密钥，不与 `owner` 共用私钥
- 及时撤销不再使用的 Authorized Key，或设置合理的过期时间
- 对不同业务权限使用独立位，避免过度授权
- 委托支付/执行接口已加非重入保护（`nonReentrant`）
- 使用安全的 ERC20 交互封装，兼容不返回布尔值的代币

## 标准兼容建议
- DID 参考：W3C DID Core（可用 did:ethr 表示）
- 授权签名：EIP-712 Typed Data
- 身份根记录：可参考 ERC-725
- 账户抽象：可选集成 ERC-4337 以增强执行体验

## 业务流程图
详见 `docs/ArchitectureFlow.md`（包含 Mermaid 与 ASCII 两种版本，兼容不支持图片的环境）。

## 使用案例
- 邮箱注册与登录（生态应用）
  - 后台为 Agent 创建 `authorizedKey` 指定邮箱权限位或走委托创建
  - 邮箱应用调用 `verifyAuthorizedKey(agentId, keyHash, requiredPermissions)` 完成登录校验
  - Agent 在云端签名变更，第三方上链 `delegatedCreateAuthorizedKey` 完成授权更新
- 社交应用消息接收（生态应用）
  - 后台 `setServiceEndpoint(agentId, "social", "https://x.com/agent")`
  - 生态应用读取 `getServiceEndpoint` 获取端点，使用授权 key 校验后投递消息
- 电商支付（ERC20）（生态应用）
  - 用户或后台给 Agent 入金 `depositERC20`
  - Agent 云端签名，第三方上链 `delegatedPayERC20` 完成购物支付；商家链上监听 `AgentPaidERC20`
- 应急冻结（管理后台）
  - 突发风险时调用 `freezeAgent`；生态应用侧验证或委托均失败；恢复后 `unfreezeAgent`
- 通用委托执行（AA 迁移前奏）
  - Agent 云端签名某目标合约调用数据，第三方上链 `delegatedExecute`；后续可迁移到 ERC-4337 UserOp
