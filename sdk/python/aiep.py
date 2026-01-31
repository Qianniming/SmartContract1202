"""
AIEP (AI-Agent Identity & Execution Protocol) Python SDK
用于与 AetheriaAgentDID 智能合约交互的官方 Python SDK。
支持 DID 身份管理、EIP-712 委托支付和执行、以及反事实部署逻辑。
"""

import json
import time
from typing import Any, Dict, List, Optional
from decimal import Decimal
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_structured_data
from eth_utils import keccak, to_checksum_address

# --- 合约 ABI 定义 ---

ABI = [
    {"type":"function","name":"ownerOf","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"address"}]},
    {"type":"function","name":"setAgentSigner","stateMutability":"nonpayable","inputs":[{"name":"signer","type":"address"}],"outputs":[]},
    {"type":"function","name":"transferAgentOwnership","stateMutability":"nonpayable","inputs":[{"name":"newOwner","type":"address"}],"outputs":[]},
    {"type":"function","name":"getNonce","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"uint256"}]},
    {"type":"function","name":"depositToAgent","stateMutability":"payable","inputs":[],"outputs":[]},
    {"type":"function","name":"balanceOf","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"uint256"}]},
    {"type":"function","name":"delegatedPayEth","stateMutability":"nonpayable","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"},{"name":"deadline","type":"uint256"},{"name":"signature","type":"bytes"}],"outputs":[]},
    {"type":"function","name":"depositERC20","stateMutability":"nonpayable","inputs":[{"name":"token","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[]},
    {"type":"function","name":"balanceOfERC20","stateMutability":"view","inputs":[{"name":"token","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},
    {"type":"function","name":"delegatedPayERC20","stateMutability":"nonpayable","inputs":[{"name":"token","type":"address"},{"name":"to","type":"address"},{"name":"amount","type":"uint256"},{"name":"deadline","type":"uint256"},{"name":"signature","type":"bytes"}],"outputs":[]},
    {"type":"function","name":"updateMetadata","stateMutability":"nonpayable","inputs":[{"name":"metadataURI","type":"string"}],"outputs":[]},
    {"type":"function","name":"did","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"string"}]},
    {"type":"function","name":"isFrozen","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"bool"}]},
    {"type":"function","name":"getAgentSigner","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"address"}]},
    {"type":"function","name":"delegatedExecute","stateMutability":"nonpayable","inputs":[{"name":"target","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"},{"name":"deadline","type":"uint256"},{"name":"signature","type":"bytes"}],"outputs":[]}
]

FACTORY_ABI = [
    {"type":"function","name":"deployAgent","stateMutability":"nonpayable","inputs":[
        {"name":"owner","type":"address"}, {"name":"signer","type":"address"}, {"name":"metadataURI","type":"string"}, {"name":"salt","type":"bytes32"}
    ],"outputs":[{"name":"","type":"address"}]},
    {"type":"function","name":"computeAddress","stateMutability":"view","inputs":[
        {"name":"owner","type":"address"}, {"name":"signer","type":"address"}, {"name":"metadataURI","type":"string"}, {"name":"salt","type":"bytes32"}
    ],"outputs":[{"name":"","type":"address"}]},
    {"type":"function","name":"deployAndDelegatedPayERC20","stateMutability":"nonpayable","inputs":[
        {"name":"owner","type":"address"}, {"name":"signer","type":"address"}, {"name":"metadataURI","type":"string"}, {"name":"salt","type":"bytes32"},
        {"name":"token","type":"address"}, {"name":"to","type":"address"}, {"name":"amount","type":"uint256"}, {"name":"deadline","type":"uint256"}, {"name":"signature","type":"bytes"}
    ],"outputs":[{"name":"","type":"address"}]},
    {"type":"function","name":"deployAndDelegatedPayEth","stateMutability":"nonpayable","inputs":[
        {"name":"owner","type":"address"}, {"name":"signer","type":"address"}, {"name":"metadataURI","type":"string"}, {"name":"salt","type":"bytes32"},
        {"name":"to","type":"address"}, {"name":"amount","type":"uint256"}, {"name":"deadline","type":"uint256"}, {"name":"signature","type":"bytes"}
    ],"outputs":[{"name":"","type":"address"}]},
    {"type":"function","name":"deployAndDelegatedExecute","stateMutability":"nonpayable","inputs":[
        {"name":"owner","type":"address"}, {"name":"signer","type":"address"}, {"name":"metadataURI","type":"string"}, {"name":"salt","type":"bytes32"},
        {"name":"target","type":"address"}, {"name":"value","type":"uint256"}, {"name":"data","type":"bytes"}, {"name":"deadline","type":"uint256"}, {"name":"signature","type":"bytes"}
    ],"outputs":[{"name":"","type":"address"}]}
]

# --- EIP-712 配置 ---

TYPES = {
    "EIP712Domain": [
        {"name": "name", "type": "string"},
        {"name": "version", "type": "string"},
        {"name": "chainId", "type": "uint256"},
        {"name": "verifyingContract", "type": "address"}
    ],
    "PayEth": [
        {"name": "to", "type": "address"},
        {"name": "amount", "type": "uint256"},
        {"name": "nonce", "type": "uint256"},
        {"name": "deadline", "type": "uint256"}
    ],
    "PayERC20": [
        {"name": "token", "type": "address"},
        {"name": "to", "type": "address"},
        {"name": "amount", "type": "uint256"},
        {"name": "nonce", "type": "uint256"},
        {"name": "deadline", "type": "uint256"}
    ],
    "Execute": [
        {"name": "target", "type": "address"},
        {"name": "value", "type": "uint256"},
        {"name": "dataHash", "type": "bytes32"},
        {"name": "nonce", "type": "uint256"},
        {"name": "deadline", "type": "uint256"}
    ]
}

def get_domain(chain_id: int, verifying_contract: str) -> Dict[str, Any]:
    return {
        "name": "AetheriaAgentDID",
        "version": "1",
        "chainId": chain_id,
        "verifyingContract": to_checksum_address(verifying_contract)
    }

# --- 核心类实现 ---

class AIEP:
    """处理已部署 Agent 合约的交互"""
    def __init__(self, w3: Web3, contract_address: str):
        self.w3 = w3
        self.address = to_checksum_address(contract_address)
        self.contract = w3.eth.contract(address=self.address, abi=ABI)

    def _get_tx_params(self, from_address: str, value: int = 0) -> Dict[str, Any]:
        return {
            'from': from_address,
            'nonce': self.w3.eth.get_transaction_count(from_address),
            'value': value,
            'gasPrice': self.w3.eth.gas_price,
            'chainId': self.w3.eth.chain_id
        }

    def _send_tx(self, func, private_key: str, value: int = 0):
        acct = Account.from_key(private_key)
        params = self._get_tx_params(acct.address, value)
        tx = func.build_transaction(params)
        tx['gas'] = self.w3.eth.estimate_gas(tx)
        signed = Account.sign_transaction(tx, private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    # 状态查询
    def owner_of(self) -> str: return self.contract.functions.ownerOf().call()
    def get_nonce(self) -> int: return self.contract.functions.getNonce().call()
    def balance_of(self) -> int: return self.contract.functions.balanceOf().call()
    def balance_of_erc20(self, token: str) -> int: return self.contract.functions.balanceOfERC20(to_checksum_address(token)).call()
    def did(self) -> str: return self.contract.functions.did().call()

    # 委托操作签名
    def _sign_typed_data(self, primary_type: str, message: Dict[str, Any], private_key: str) -> bytes:
        structured_data = {
            "types": TYPES,
            "domain": get_domain(self.w3.eth.chain_id, self.address),
            "primaryType": primary_type,
            "message": message
        }
        signed = Account.sign_message(encode_structured_data(structured_data), private_key)
        return signed.signature

    def delegated_pay_eth(self, to: str, amount_wei: int, deadline: int, signer_private_key: str, relayer_private_key: str):
        nonce = self.get_nonce()
        message = {"to": to_checksum_address(to), "amount": amount_wei, "nonce": nonce, "deadline": deadline}
        signature = self._sign_typed_data("PayEth", message, signer_private_key)
        func = self.contract.functions.delegatedPayEth(to_checksum_address(to), amount_wei, deadline, signature)
        return self._send_tx(func, relayer_private_key)

    def delegated_execute(self, target: str, value_wei: int, data: bytes, deadline: int, signer_private_key: str, relayer_private_key: str):
        nonce = self.get_nonce()
        data_hash = keccak(data)
        message = {"target": to_checksum_address(target), "value": value_wei, "dataHash": data_hash, "nonce": nonce, "deadline": deadline}
        signature = self._sign_typed_data("Execute", message, signer_private_key)
        func = self.contract.functions.delegatedExecute(to_checksum_address(target), value_wei, data, deadline, signature)
        return self._send_tx(func, relayer_private_key)

class EasyAgent:
    """高级封装：支持反事实部署与自动资金管理"""
    def __init__(self, w3: Web3, factory_address: str, owner_private_key: str, agent_signer_private_key: str, metadata_uri: str = "ipfs://agent"):
        self.w3 = w3
        self.factory_address = to_checksum_address(factory_address)
        self.factory = w3.eth.contract(address=self.factory_address, abi=FACTORY_ABI)
        self.owner_acct = Account.from_key(owner_private_key)
        self.owner_pk = owner_private_key
        self.agent_acct = Account.from_key(agent_signer_private_key)
        self.agent_pk = agent_signer_private_key
        self.metadata_uri = metadata_uri
        
        # 确定性 Salt 生成
        salt_src = f"{self.owner_acct.address}:{self.agent_acct.address}".encode()
        self.salt = keccak(salt_src)
        self.address = self.factory.functions.computeAddress(
            self.owner_acct.address, self.agent_acct.address, self.metadata_uri, self.salt
        ).call()

    def is_deployed(self) -> bool:
        code = self.w3.eth.get_code(self.address)
        return len(code) > 0

    def ensure_deployed(self):
        if self.is_deployed(): return self.address
        func = self.factory.functions.deployAgent(
            self.owner_acct.address, self.agent_acct.address, self.metadata_uri, self.salt
        )
        self._send_factory_tx(func)
        return self.address

    def _send_factory_tx(self, func):
        params = {
            'from': self.owner_acct.address,
            'nonce': self.w3.eth.get_transaction_count(self.owner_acct.address),
            'gasPrice': self.w3.eth.gas_price,
            'chainId': self.w3.eth.chain_id
        }
        tx = func.build_transaction(params)
        tx['gas'] = self.w3.eth.estimate_gas(tx)
        signed = Account.sign_transaction(tx, self.owner_pk)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def pay_eth(self, to: str, amount_wei: int, deadline: Optional[int] = None):
        """自动处理部署并支付 ETH"""
        dl = deadline or int(time.time()) + 3600
        if not self.is_deployed():
            # 反事实部署并执行
            domain = get_domain(self.w3.eth.chain_id, self.address)
            message = {"to": to_checksum_address(to), "amount": amount_wei, "nonce": 0, "deadline": dl}
            structured_data = {"types": TYPES, "domain": domain, "primaryType": "PayEth", "message": message}
            sig = Account.sign_message(encode_structured_data(structured_data), self.agent_pk).signature
            
            func = self.factory.functions.deployAndDelegatedPayEth(
                self.owner_acct.address, self.agent_acct.address, self.metadata_uri, self.salt,
                to_checksum_address(to), amount_wei, dl, sig
            )
            return self._send_factory_tx(func)
        
        return AIEP(self.w3, self.address).delegated_pay_eth(to, amount_wei, dl, self.agent_pk, self.owner_pk)

    def fund_eth(self, amount_wei: int):
        """为 Agent 充值 ETH"""
        tx = {
            'from': self.owner_acct.address,
            'to': self.address,
            'value': amount_wei,
            'nonce': self.w3.eth.get_transaction_count(self.owner_acct.address),
            'gasPrice': self.w3.eth.gas_price,
            'chainId': self.w3.eth.chain_id
        }
        tx['gas'] = self.w3.eth.estimate_gas(tx)
        signed = Account.sign_transaction(tx, self.owner_pk)
        return self.w3.eth.wait_for_transaction_receipt(self.w3.eth.send_raw_transaction(signed.raw_transaction))

    def _normalize_erc20_amount(self, token: str, amount: Any) -> int:
        if isinstance(amount, (int, float, Decimal)):
            # 如果是数字，假设需要根据精度转换
            erc20 = self.w3.eth.contract(address=to_checksum_address(token), abi=[
                {"type":"function","name":"decimals","inputs":[],"outputs":[{"type":"uint8"}]}
            ])
            decimals = erc20.functions.decimals().call()
            return int(Decimal(str(amount)) * (Decimal(10) ** decimals))
        return int(amount)

# --- 工具函数 ---

def build_did(chain_id: int, address: str) -> str:
    """生成符合规范的 DID"""
    return f"did:ethr:{chain_id}:{to_checksum_address(address).lower()}"
