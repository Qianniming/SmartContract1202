AetheriaAgentDID 合约变量大白话指南（单 Agent 模型）

目标
- 用最直白的中文解释合约里的每个变量，包含作用、何时变化、谁来设置、默认值与注意事项。

顶层身份与配置
- `owner`：这份合约代表的 Agent 的“主人”地址。部署时自动设置为部署者。只有主人能改签名人、改密钥、转移所有权、更新元数据、冻结/解冻等。
- `signer`：Agent 的“云端签名人”。用于离线签名 EIP-712 消息，配合委托接口（如委托支付/委托执行）。可由主人设置或更改，默认没有（零地址）。
- `metadataURI`：Agent 的资料链接（比如 IPFS、HTTP）。包含头像、名称、描述或公开密钥等信息。初始化时可设置，之后主人可更新。

极简架构（单私钥）
- 不再维护 `agentKeys` 与 `authorizedKeys`。`signer` 即代表身份与授权来源，配合 EIP-712 进行签名与链上验签。

状态与余额
- `frozen`：冻结标记。为真时表示“紧急锁定”，所有验证与委托操作都会拒绝。主人可以执行冻结/解冻。
- `nonce`：签名随机数。每次委托方法（如 `delegatedPayEth`、`delegatedExecute`）成功执行后自增，用来防止重放攻击。构造 EIP-712 消息前应先读取它。
- `ethBalance`：Agent 的 ETH 余额（存放在合约里）。通过 `depositToAgent` 增加，委托支付或委托执行带 `value` 时扣减。反事实部署场景下，构造函数会同步 `address(this).balance`。
- `erc20Balances`（`mapping(address => uint256)`）：每种代币的余额账本。键是代币合约地址，值是该代币的余额。通过 `depositERC20` 增加，通过委托代币支付扣减。首次委托代币支付前，会同步链上 `IERC20(token).balanceOf(address(this))` 到账本以兼容预充值。

安全与限制
- `reentrancyLock`：防重入锁的标志位。触发委托型操作时会先上锁，执行完再解锁，避免重复进入同一流程导致资金或状态被多次修改。
- `frozen`（再次强调）：冻结后所有校验/委托都会失败；只读查询不受影响。遇到异常时先冻结再排障。

EIP-712 相关常量
- `EIP712_DOMAIN_TYPEHASH`：EIP-712 域类型哈希，用于构造域分隔（Domain Separator）。
- `PAY_ETH_TYPEHASH`：委托“ETH 支付”的 TypedData 类型哈希。对应消息字段：`(to, amount, nonce, deadline)`。
- `PAY_ERC20_TYPEHASH`：委托“代币支付”的 TypedData 类型哈希。对应消息字段：`(token, to, amount, nonce, deadline)`。
- `EXECUTE_TYPEHASH`：委托“通用合约调用”的 TypedData 类型哈希。对应消息字段：`(target, value, dataHash, nonce, deadline)`。
- `NAME_HASH`：EIP-712 域里 `name` 的哈希，固定为 `"AetheriaAgentDID"`。保证不同应用域名隔离。
- `VERSION_HASH`：EIP-712 域里 `version` 的哈希，固定为 `"1"`。用于协议版本隔离。
- `SECP256K1_N_DIV_2`：secp256k1 曲线阶的一半，用于签名 `s` 值的标准化检查（拒绝高 `s`，防止签名可塑性）。

结构体字段（简化）
- 本版本不包含密钥与授权结构体。

变量变化来源与生命周期（按场景）
- 部署：`owner`、`metadataURI` 初始化；可选设置 `signer`。Factory 支持 `CREATE2` 预计算地址与确定性部署。
- 配置：主人可设置或更新 `signer`、`metadataURI`；可冻结/解冻。
- 入金/支付：`ethBalance` 随 `depositToAgent` 增长，随委托 ETH 支付或委托执行 `value` 扣减；`erc20Balances[token]` 随 `depositERC20` 增长，随委托 ERC20 支付扣减。
- 委托：每次成功的委托操作都会自增 `nonce`；签名者需按最新 `nonce` 构造 EIP-712 消息。
- 安全：触发 `frozen` 后，委托接口返回失败；只读查询仍可用。

注意事项与最佳实践
- 单私钥架构：`signer` 既用于身份认证也用于委托执行；第三方可通过 `getAgentSigner` + 恢复地址完成链下认证。
- 资金安全：所有委托支付与执行都使用防重入锁，并进行签名、截止时间、余额与 `nonce` 检查。

