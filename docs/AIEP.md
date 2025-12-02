# AIEP（Agent Identity & Economy Protocol）v1.0 规范

## 目标
- 统一 AI Agent 的链上身份标识、授权、支付与委托执行标准
- 提供跨生态的可验证登录、细粒度权限与不可抵赖的结算能力
- 以以太坊为基座，采用 EIP-712 进行离线签名与链上验签

## 术语
- Agent：具有独立身份与行为的数字智能体
- Owner：Agent 的链上所有者
- Signer：Agent 云端签名地址，用于离线签名
- AuthorizedKey：授权给外部应用的访问令牌，使用权限位控制
- ServiceEndpoint：Agent 暴露的服务端点键值
- DID：统一身份标识 `did:ethr:<chainId>:<contract>:<agentId>`

## 标识与对象
- 身份根：`agentId ∈ uint256`
- Agent 档案：`owner`、`signer`、`metadataURI`、`AgentKey{keyHash,expireAt,enabled}`、`AuthorizedKey{keyHash,expireAt,permissions,enabled}`
- 余额账本：`ethBalances[agentId]`、`erc20Balances[agentId][token]`
- 服务端点：`serviceEndpoints[agentId][key]=value`，并维护 `serviceKeys[agentId]`

## 权限位建议
- 1：读取消息
- 2：发送消息
- 4：修改资料
- 8：发起支付
- 16：注册服务端点
- 32：托管执行
- 可按产品扩展，组合校验使用 `(stored & required) == required`

## EIP-712 TypedData
- 域：`EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)`，`name="AetheriaAgentDID"`、`version="1"`
- 结构：
  - CreateAuthorizedKey：`(agentId,keyHash,expireAt,permissions,nonce,deadline)`
  - PayEth：`(agentId,to,amount,nonce,deadline)`
  - PayERC20：`(agentId,token,to,amount,nonce,deadline)`
  - Execute：`(agentId,target,value,dataHash,nonce,deadline)`
- 校验要求：签名 `s <= secp256k1n/2`、`v ∈ {27,28}`；`deadline` 未过期；`nonce` 自增防重放

## 接口规范（参考实现：AetheriaAgentDID）
- 身份管理：`registerAgent`、`ownerOf`、`transferAgentOwnership`、`updateMetadata`、`didOf`
- 签名人与密钥：`setAgentSigner`、`setAgentKey`、`disableAgentKey`、`verifyAgentKey`
- 授权令牌：`createAuthorizedKey`、`revokeAuthorizedKey`、`verifyAuthorizedKey`、`delegatedCreateAuthorizedKey`、`getAuthorizedKey`
- 资金与支付：`depositToAgent`、`balanceOf`、`delegatedPayEth`、`depositERC20`、`balanceOfERC20`、`delegatedPayERC20`
- 服务端点：`setServiceEndpoint`、`removeServiceEndpoint`、`getServiceEndpoint`、`getServiceKeys`
- 委托执行：`delegatedExecute`
- 状态只读：`getNonce`、`isFrozen`、`getAgentSigner`
- 安全：`freezeAgent`、`unfreezeAgent`

## 事件规范
- 身份：`AgentRegistered`、`AgentOwnershipTransferred`
- 密钥：`AgentKeySet`、`AgentKeyDisabled`
- 授权：`AuthorizedKeyCreated`、`AuthorizedKeyRevoked`、`DelegatedAuthorizedKeyCreated`
- 资金：`AgentDeposited`、`AgentPaid`、`AgentDepositedERC20`、`AgentPaidERC20`
- 服务：`ServiceEndpointSet`
- 执行：`DelegatedExecuted`

## 安全要求
- 所有委托接口使用 `nonReentrant` 防重入
- ERC20 交互使用安全封装兼容非标准代币返回
- 冻结态拒绝所有验证与委托
- 严格 EIP-712 校验与 `nonce`、`deadline` 控制

## 互操作与扩展
- DID 输出`did:ethr`，便于外部系统一致使用
- 可扩展权限位与服务键集合
- 可迁移到 ERC-4337，通过 `delegatedExecute` 过渡到 UserOp

## 参考实现
- 合约：`src/AetheriaAgentDID.sol`
- 测试：`test/AetheriaAgentDID.test.js`
- 示例目标合约与代币：`src/MockTarget.sol`、`src/MockERC20.sol`
