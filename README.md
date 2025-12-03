# AetheriaAgentDID 智能合约说明

本仓库实现了符合 Aetheria DID v2.0 规范的 AI Agent 链上身份与授权管理合约 `AetheriaAgentDID`，采用单 Agent 合约模型（一个合约仅代表一个 Agent），支持所有权与签名人控制、EIP-712 委托支付/执行、紧急冻结机制；配套 `AetheriaFactory` 提供 `CREATE2` 反事实部署与地址预计算，SDK 提供极简集成体验。

## 主要特性
- 链上身份根：合约地址即身份根，统一 DID 格式为 `did:ethr:<chainId>:<contract>`
- 所有权控制：`owner` 拥有最高权限，可转移所有权
- 签名人控制：`owner` 可设定/轮换 `signer`（Agent 本地私钥对应地址）
- 反事实部署：`AetheriaFactory` 支持 `CREATE2` 预计算地址，未部署即可收款，首次使用自动部署
- 委托操作：支持 EIP-712 typed data 的支付/执行，由第三方或 Relayer 上链，适配 gasless 体验
- 紧急冻结：`freezeAgent`/`unfreezeAgent` 控制 Agent 状态，冻结时验证直接失败

## 运行逻辑概述
- 单 Agent 架构：`{ owner, signer, metadataURI }`
- 验证规则：
  - 冻结态下所有委托操作拒绝
  - 基于 EIP-712 域 `name="AetheriaAgentDID"、version="1"、chainId、verifyingContract`
  - 校验 `deadline`、签名恢复地址与 `signer` 相等、`s <= secp256k1n/2`
  - 成功执行后 `nonce` 自增，防重放
- 委托执行：
  - Owner 绑定 `signer` 地址（Agent 云端私钥对应地址）
  - 云端生成 EIP-712 签名，第三方或 Relayer 上链调用 `delegatedPayEth`/`delegatedPayERC20`/`delegatedExecute`
  - 通过合约内部账本 `ethBalance/erc20Balances` 进行出入账

## 数据结构
- 合约状态：`owner`、`signer`、`metadataURI`、`nonce`、`ethBalance`、`erc20Balances[token]`

## 合约接口（external）
- 查询与基础
  - `ownerOf() view returns (address)`
  - `getMetadata() view returns (string)`
  - `getNonce() view returns (uint256)`
- 所有权与签名人管理
  - `transferAgentOwnership(address newOwner)`
  - `setAgentSigner(address signer)`
- 签名人与所有权
  - `transferAgentOwnership(address newOwner)`
  - `setAgentSigner(address signer)`
- 冻结机制
  - `freezeAgent()`
  - `unfreezeAgent()`

## 更多接口（扩展）
- 只读扩展
  - `isFrozen() view returns (bool)`
  - `getAgentSigner() view returns (address)`
- 资金（ETH / ERC20）
  - `depositToAgent()` payable
  - `balanceOf() view returns (uint256)`
  - `delegatedPayEth(address to, uint256 amount, uint256 deadline, bytes signature)`
  - `depositERC20(address token, uint256 amount)`
  - `balanceOfERC20(address token) view returns (uint256)`
  - `delegatedPayERC20(address token, address to, uint256 amount, uint256 deadline, bytes signature)`
- DID 标识
  - `did() view returns (string)`
- 通用委托执行
  - `delegatedExecute(address target, uint256 value, bytes data, uint256 deadline, bytes signature)`

## 事件（events）
- `AgentInitialized(owner, metadataURI)`
- `MetadataUpdated(metadataURI)`
- `AgentFrozen()` / `AgentUnfrozen()`
- `AgentSignerSet(signer)`
- `AgentOwnershipTransferred(previousOwner, newOwner)`
- `AgentDeposited(from, amount)` / `AgentPaid(to, amount)`
- `AgentDepositedERC20(token, from, amount)` / `AgentPaidERC20(token, to, amount)`
- `DelegatedExecuted(target, value, data)`

## EIP-712 委托规范
- 域分隔：`EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)`（`name="AetheriaAgentDID"，version="1"`）
- TypedData：
  - PayEth：`(to, amount, nonce, deadline)`
  - PayERC20：`(token, to, amount, nonce, deadline)`
  - Execute：`(target, value, dataHash, nonce, deadline)`
- 校验要点：`deadline` 未过期、`recovered == signer`、`s <= secp256k1n/2`、成功后 `nonce` 自增

## 验证逻辑
- 基于 `signer` 的单密钥范式：不再维护授权密钥与权限位，认证统一以 `signer` 地址为准
- 委托校验：`deadline` 未过期、`recovered == signer`、`s <= secp256k1n/2`、成功后 `nonce` 自增

## 文件结构
- 合约：`src/AetheriaAgentDID.sol`
- 测试：`test/AetheriaAgentDID.test.js`
- 配置：`hardhat.config.js`
- 包管理：`package.json`

## 本地开发与测试
- 安装依赖：`npm install`
- 运行测试：`npx hardhat test`
- 常见断言覆盖：签名人设置、冻结/解冻、所有权迁移、ETH/ERC20 入金与委托支付、DID 输出、通用委托执行与 `nonce` 自增

## 安全注意事项
- 建议将 `signer` 配置为安全的云端密钥，不与 `owner` 共用私钥
- 及时撤销不再使用的 Authorized Key，或设置合理的过期时间
- 对不同业务权限使用独立位，避免过度授权
- 委托支付/执行接口已加非重入保护（`nonReentrant`）
- 使用安全的 ERC20 交互封装，兼容不返回布尔值的代币

## 标准兼容建议
- DID：W3C DID Core（`did:ethr`）
- 签名：EIP-712 Typed Data
- 账户抽象：可与 ERC-4337 Bundler 集成（Python SDK 已提供最小 Bundler 客户端）

## 业务流程图
详见 `docs/ArchitectureFlow.md`（包含 Mermaid 与 ASCII 两种版本，兼容不支持图片的环境）。

-## 使用案例
- 邮箱注册与登录（生态应用）
  - 后台为 Agent 绑定 `signer`，生态应用通过链下恢复地址完成认证
- 电商支付（ERC20）（生态应用）
  - 用户或后台给 Agent 入金 `depositERC20`
  - Agent 云端签名，第三方上链 `delegatedPayERC20` 完成购物支付；商家链上监听 `AgentPaidERC20`
- 应急冻结（管理后台）
  - 突发风险时调用 `freezeAgent`；生态应用侧验证或委托均失败；恢复后 `unfreezeAgent`
- 通用委托执行（AA 迁移前奏）
  - Agent 云端签名某目标合约调用数据，第三方上链 `delegatedExecute`；后续可迁移到 ERC-4337 UserOp
