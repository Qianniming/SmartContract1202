# Aetheria: AI-Agent Identity & Execution Protocol (AIEP)

> **为 AI Agent 注入 Web3 的灵魂：身份、主权与受控的自由。**

## **1. 项目愿景 (Vision)**

在 AI 与 Web3 融合的时代，AI Agent 正在从简单的“对话助手”进化为能够自主进行金融交易的“机器实体”。然而，AI 进入 Web3 赛道面临着核心矛盾：**资产安全与自主化操作的冲突**。

**Aetheria** 是一套轻量级、高性能的链上身份与财务授权协议。它通过“所有权”与“执行权”的逻辑分离，让 AI 代理能够在不持有私钥的情况下，安全地调用链上资产，参与机器经济（Machine Economy）。

---

## **2. 核心技术架构 (Architecture)**

Aetheria 采用双层权限模型，构建在 [AetheriaAgentDID.sol](file:///Users/qianniming/Public/SmartContract1202/src/AetheriaAgentDID.sol) 核心合约之上：

*   **Owner (所有者/冷钱包)**：拥有最高控制权。负责管理 Agent 的生命周期、更换签名人、更新元数据以及紧急情况下的“冰封”合约。
*   **Signer (签名者/热密钥)**：由 AI 节点持有。仅具备“签名权”，负责签署具体的交易指令。Signer 无法直接动用资金，必须通过 EIP-712 委托机制触发执行。

### **关键特性：**
1.  **DID 身份标识**：原生支持 `did:ethr` 规范，通过 [did](file:///Users/qianniming/Public/SmartContract1202/src/AetheriaAgentDID.sol#L209) 函数生成全球唯一的 Agent 标识符。
2.  **EIP-712 委托执行**：实现 [delegatedExecute](file:///Users/qianniming/Public/SmartContract1202/src/AetheriaAgentDID.sol#L216) 逻辑，AI 在链下签署结构化数据，由转发者在链上校验执行，确保 Gas 效率与安全性。
3.  **反事实部署 (Counterfactual Deployment)**：利用 [AetheriaFactory.sol](file:///Users/qianniming/Public/SmartContract1202/src/AetheriaFactory.sol) 的 `CREATE2` 技术，支持 Agent“先收款、后部署”，极大降低了大规模 Agent 矩阵的启动成本。
4.  **紧急冰封机制**：提供 [freezeAgent](file:///Users/qianniming/Public/SmartContract1202/src/AetheriaAgentDID.sol#L87) 功能，一旦 Signer 环境受损，Owner 可立即锁定资产，实现秒级避险。

---

## **3. 开发者生态 (Developer Ecosystem)**

为了实现零门槛集成，Aetheria 提供了全栈 SDK 支持：

*   **JavaScript SDK ([aiep.js](file:///Users/qianniming/Public/SmartContract1202/sdk/aiep.js))**：适用于 Web 前端及 Node.js 环境。
*   **Python SDK ([aiep.py](file:///Users/qianniming/Public/SmartContract1202/sdk/python/aiep.py))**：专为 AI 工程师设计，支持与主流 AI 框架（如 Eliza, AutoGPT）原生对接。

### **快速集成示例 (JavaScript)：**
```javascript
const { EasyAgent } = require("./sdk/aiep");
// 创建一个具备财务主权的 Agent 实例
const agent = new EasyAgent(provider, factoryAddr, ownerSigner, agentSigner);
// 一键支付 ETH（如果合约未部署，SDK 会自动合并部署交易）
await agent.payEth("recipient.eth", "0.1");
```

---

## **4. 最佳应用场景 (Use Cases)**

1.  **AI 自动化交易员**：由 AI 签署签名，在限定预算内自动执行 DeFi 策略（如自动补仓、复利）。
2.  **去中心化社交代理**：AI 角色代表玩家在链上社交协议中进行高频交互、购买道具。
3.  **机器经济基础设施**：AI Agent 自主支付云服务费、存储费（如 0G Storage）或购买其他 AI 服务。
4.  **可交易的 Agent 资产**：通过将 Aetheria 身份与 NFT 标准（如 ERC-7844）结合，实现 Agent 整体所有权的二级市场转让。

---

## **5. 行业兼容性与未来 (Roadmap)**

*   **0G 生态深度集成**：计划原生支持 0G Storage 作为 Agent 元数据的持久化层，利用 0G DA 确保 AI 推理结果的可验证性。
*   **多链 DID 路由**：构建跨链身份解析器，让一个 Aetheria 身份在多条 EVM 兼容链上保持连贯性。
*   **安全审计计划**：即将启动针对 [AetheriaAgentDID](file:///Users/qianniming/Public/SmartContract1202/src/AetheriaAgentDID.sol) 的第三方专业审计。

---

## **6. 快速开始 (Quick Start)**

1.  克隆仓库：`git clone ...`
2.  安装依赖：`npm install` 或 `pip install -r requirements.txt`
3.  查看测试用例：[AetheriaAgentDID.test.js](file:///Users/qianniming/Public/SmartContract1202/test/AetheriaAgentDID.test.js)

---

**Aetheria —— 让 AI 真正“自主”地行走在 Web3 之上。**
