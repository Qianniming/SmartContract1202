# AIEP（Agent Identity & Economy Protocol）v1.1 规范（单 Agent 合约模型 + 反事实部署 + Safe 模块）

## 目标
- 统一 AI Agent 的链上身份标识、授权、支付与委托执行标准
- 提供跨生态的可验证登录、细粒度权限与不可抵赖的结算能力
- 以以太坊为基座，采用 EIP-712 进行离线签名与链上验签

## 术语
- Agent：具有独立身份与行为的数字智能体
- Owner：Agent 的链上所有者
- Signer：Agent 云端签名地址，用于离线签名
- DID：统一身份标识 `did:ethr:<chainId>:<contract>`

## 标识与对象
- 单 Agent 合约：每个合约即一个 Agent，身份根为合约地址
- Agent 档案：`owner`、`signer`、`metadataURI`
- 余额账本：`ethBalance`、`erc20Balances[token]`

## 权限与认证
- 简化架构不再提供授权令牌权限位，认证统一以 `signer` 地址为准。

## EIP-712 TypedData
- 域：`EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)`，`name="AetheriaAgentDID"、version="1"`
- 结构：
  - PayEth：`(to,amount,nonce,deadline)`
  - PayERC20：`(token,to,amount,nonce,deadline)`
  - Execute：`(target,value,dataHash,nonce,deadline)`
- 校验要求：签名 `s <= secp256k1n/2`、`v ∈ {27,28}`；`deadline` 未过期；`nonce` 自增防重放

## 接口规范（参考实现：AetheriaAgentDID）
## 接口规范（参考实现：AetheriaAgentDID）
- 身份管理：`ownerOf`、`transferAgentOwnership`、`updateMetadata`、`did`
- 签名人与认证：`setAgentSigner`、`getAgentSigner`
- 资金与支付：`depositToAgent`、`balanceOf`、`delegatedPayEth`、`depositERC20`、`balanceOfERC20`、`delegatedPayERC20`
- 委托执行：`delegatedExecute`
- 状态只读：`getNonce`、`isFrozen`、`getAgentSigner`
- 安全：`freezeAgent`、`unfreezeAgent`

## 事件规范
- 身份：`AgentInitialized`、`AgentOwnershipTransferred`、`AgentSignerSet`、`MetadataUpdated`、`AgentFrozen/Unfrozen`
- 资金：`AgentDeposited`、`AgentPaid`、`AgentDepositedERC20`、`AgentPaidERC20`
- 执行：`DelegatedExecuted`

## 安全要求
- 所有委托接口使用 `nonReentrant` 防重入
- ERC20 交互使用安全封装兼容非标准代币返回
- 冻结态拒绝所有验证与委托
- 严格 EIP-712 校验与 `nonce`、`deadline` 控制
- 反事实部署：构造时同步 `ethBalance = address(this).balance`；首次代币委托支付前同步链上 `balanceOf(token)` 到账本

## 互操作与扩展
- DID 输出 `did:ethr`，便于外部系统一致使用
- 可扩展服务键集合
- 反事实部署（Factory）：`computeAddress` 预计算、`deployAgent` 部署；组合交易 `deployAndDelegatedPayERC20/PayEth/Execute`
- Safe 模块（Gnosis Safe）：在 Safe 中启用 `AetheriaSafeModule`，用 EIP-712 委托路径执行 `execTransactionFromModule`
- 账户抽象（ERC-4337）：可与 Bundler 集成（Python SDK 提供最小客户端），将“部署+执行”封装为 `UserOperation`

## 参考实现
- 合约：`src/AetheriaAgentDID.sol`、`src/AetheriaFactory.sol`、`src/AetheriaSafeModule.sol`
- 测试：`test/AetheriaAgentDID.test.js`、`test/AetheriaFactory.test.js`
- 示例目标合约与代币：`src/MockTarget.sol`、`src/MockERC20.sol`
