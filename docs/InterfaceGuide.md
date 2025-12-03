 AetheriaAgentDID 接口大白话指南（单 Agent 模型）

 目标
 - 一个合约只代表一个 Agent：不再有 `agentId` 概念，合约地址就是身份根。
- 支持登录认证（以 signer 为准）、收发钱、托管执行、应急冻结。

 接口分类总览（谁用它）
 - 管理后台（Owner 发起）
   - `transferAgentOwnership(address)`（转移 Agent 所有权）
   - `setAgentSigner(address)`（设置 Agent 签名人）
   - `updateMetadata(string)`（更新元数据）
   - `freezeAgent()` / `unfreezeAgent()`（冻结 / 解冻 Agent）
   - `depositToAgent()`（入金 ETH；任何人可入金）
   - `depositERC20(address,uint256)`（入金 ERC20；任何人可入金）
 - 生态应用（第三方/服务端/前端）
   - `delegatedPayEth(address,uint256,uint256,bytes)`
   - `delegatedPayERC20(address,address,uint256,uint256,bytes)`
   - `delegatedExecute(address,uint256,bytes,uint256,bytes)`
  - `ownerOf()` / `getMetadata()` / `did()`
  - `getNonce()` / `balanceOf()` / `balanceOfERC20(address)` / `isFrozen()` / `getAgentSigner()`

 接口逻辑（大白话）
 - 身份与所有权（单 Agent）
   - 构造函数：`constructor(address owner, address signer, string metadataURI)`
     - 由 Factory 或直接部署，初始化 `owner`、`metadataURI`，可选绑定 `signer`。
     - 事件：`AgentInitialized(owner, metadataURI)` 与可选 `AgentSignerSet(signer)`。
   - `ownerOf()`：查询该合约代表的 Agent 的所有者地址。
   - `transferAgentOwnership(address)`：校验 `newOwner!=0` 与未冻结，更新 `owner`，事件 `AgentOwnershipTransferred`。

 - 签名人与认证
   - `setAgentSigner(address)`：写入 `signer`，事件 `AgentSignerSet`。
   - 认证统一以 `signer` 进行 EIP-712 验证，不再提供授权令牌接口。

 - 委托（云端签+第三方上链）
   - `delegatedPayEth` / `delegatedPayERC20` / `delegatedExecute`：云端用 `signer` 私钥签 EIP-712，第三方/Relayer 上链；成功后 `nonce` 自增。
   - `getNonce()`：查询当前随机数，防重放。

- 资金与支付
  - `depositToAgent()`：入金 ETH；事件 `AgentDeposited`（仅记录事件，余额以链上实时值为准）。
  - `balanceOf()`：查询 ETH 链上实时余额（`address(this).balance`），不维护内部账本。
  - `delegatedPayEth(address,uint256,uint256,bytes)`：委托支付 ETH（基于链上余额校验）；事件 `AgentPaid`。
  - `depositERC20(address,uint256)`：入金 ERC20（先 `approve`）；事件 `AgentDepositedERC20`（记录实际到账金额）。
  - `balanceOfERC20(address)`：查询 ERC20 链上实时余额（`IERC20(token).balanceOf(agent)`）。
  - `delegatedPayERC20(address,address,uint256,uint256,bytes)`：委托支付 ERC20（基于链上余额校验）；事件 `AgentPaidERC20`。
  - 直接接收 ETH：允许直接向合约地址转入 ETH（`receive`/`fallback`）；同样触发 `AgentDeposited` 事件。

- 元数据
  - `updateMetadata(string)`：更新元数据；事件 `MetadataUpdated`。

 - DID 与应急
   - `did()`：返回 `did:ethr:<chainId>:<contract>`。
   - `isFrozen()`：查询冻结状态。
   - `freezeAgent()` / `unfreezeAgent()`：冻结 / 解冻；冻结时所有验证与委托失败。

 - 通用委托执行（AA 友好）
   - `delegatedExecute(address,uint256,bytes,uint256,bytes)`：云端签名任意调用（含可选 ETH `value`），第三方上链；成功事件 `DelegatedExecuted`。

 反事实部署（Factory 扩展）
 - `computeAddress(owner, signer, metadataURI, salt)`：预计算合约地址，可立即收款（未部署）。
 - `deployAgent(owner, signer, metadataURI, salt)`：确定性部署。
 - 组合交易：`deployAndDelegatedPayERC20/PayEth/Execute` 首次使用“一笔完成部署与执行”。

 典型使用流程
 - 初始化身份：Factory 预计算地址 → 入金 → 首次使用自动部署；或直接部署构造。
 - 登录与支付：云端 `signer` EIP-712 签名 → 第三方上链支付/执行。
  
 - 应急：后台 `freezeAgent` 阻断所有委托；恢复用 `unfreezeAgent`。

 生态开发注意点
 - 所有委托先查 `getNonce()`，并设置合理 `deadline`。
 - 冻结后所有委托失败，注意前端提示与重试策略。
  - 代币入金要先 `approve` 合约，再 `depositERC20`；若走反事实部署，可先直接转到预计算地址。
  - 余额来源为链上实时值：`balanceOf`/`balanceOfERC20` 直接读取链上余额，无内部记账；强制转账或直接转账均可用。
  - ETH 入金可以直接转账到 Agent 地址或调用 `depositToAgent`；两者都会记事件，余额一致。
  - 对手续费型代币（fee-on-transfer），`depositERC20` 事件记录的为实际到账金额。

 中英对照表（函数名翻译）
 - 查询所有者：`ownerOf`
 - 转移所有权：`transferAgentOwnership`
 - 设置签名人：`setAgentSigner`
 - 查询随机数：`getNonce`
 - 入金 ETH：`depositToAgent`
 - 查询 ETH 余额：`balanceOf`
 - 委托支付 ETH：`delegatedPayEth`
 - 入金 ERC20：`depositERC20`
 - 查询 ERC20 余额：`balanceOfERC20`
 - 委托支付 ERC20：`delegatedPayERC20`
 - 更新元数据：`updateMetadata`
 - 查询统一 DID 标识：`did`
 - 查询冻结状态：`isFrozen`
 - 查询签名人地址：`getAgentSigner`
 - 冻结 / 解冻：`freezeAgent` / `unfreezeAgent`
 - 委托通用合约执行：`delegatedExecute`
