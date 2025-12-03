from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Callable
import json
import time
import urllib.request
import urllib.error
from web3 import Web3
from eth_account import Account
try:
    from eth_account.messages import encode_structured_data
    HAS_ENCODE_STRUCTURED = True
except Exception:
    encode_structured_data = None
    HAS_ENCODE_STRUCTURED = False
from eth_abi import encode as abi_encode
from eth_keys import keys
from eth_utils import keccak, to_checksum_address

ABI: List[Any] = [
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

FACTORY_ABI: List[Any] = [
    {"type":"event","name":"AgentDeployed","inputs":[
        {"name":"agent","type":"address","indexed":True},
        {"name":"owner","type":"address","indexed":True},
        {"name":"signer","type":"address","indexed":True}
    ]},
    {"type":"function","name":"deployAgent","stateMutability":"nonpayable","inputs":[
        {"name":"owner","type":"address"},
        {"name":"signer","type":"address"},
        {"name":"metadataURI","type":"string"},
        {"name":"salt","type":"bytes32"}
    ],"outputs":[{"name":"","type":"address"}]},
    {"type":"function","name":"computeAddress","stateMutability":"view","inputs":[
        {"name":"owner","type":"address"},
        {"name":"signer","type":"address"},
        {"name":"metadataURI","type":"string"},
        {"name":"salt","type":"bytes32"}
    ],"outputs":[{"name":"","type":"address"}]},
    {"type":"function","name":"deployAndDelegatedPayERC20","stateMutability":"nonpayable","inputs":[
        {"name":"owner","type":"address"},
        {"name":"signer","type":"address"},
        {"name":"metadataURI","type":"string"},
        {"name":"salt","type":"bytes32"},
        {"name":"token","type":"address"},
        {"name":"to","type":"address"},
        {"name":"amount","type":"uint256"},
        {"name":"deadline","type":"uint256"},
        {"name":"signature","type":"bytes"}
    ],"outputs":[{"name":"","type":"address"}]},
    {"type":"function","name":"deployAndDelegatedPayEth","stateMutability":"nonpayable","inputs":[
        {"name":"owner","type":"address"},
        {"name":"signer","type":"address"},
        {"name":"metadataURI","type":"string"},
        {"name":"salt","type":"bytes32"},
        {"name":"to","type":"address"},
        {"name":"amount","type":"uint256"},
        {"name":"deadline","type":"uint256"},
        {"name":"signature","type":"bytes"}
    ],"outputs":[{"name":"","type":"address"}]},
    {"type":"function","name":"deployAndDelegatedExecute","stateMutability":"nonpayable","inputs":[
        {"name":"owner","type":"address"},
        {"name":"signer","type":"address"},
        {"name":"metadataURI","type":"string"},
        {"name":"salt","type":"bytes32"},
        {"name":"target","type":"address"},
        {"name":"value","type":"uint256"},
        {"name":"data","type":"bytes"},
        {"name":"deadline","type":"uint256"},
        {"name":"signature","type":"bytes"}
    ],"outputs":[{"name":"","type":"address"}]}
]

SAFE_MODULE_ABI: List[Any] = [
    {"type":"function","name":"safe","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"address"}]},
    {"type":"function","name":"signer","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"address"}]},
    {"type":"function","name":"nonce","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"uint256"}]},
    {"type":"function","name":"frozen","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"bool"}]},
    {"type":"function","name":"setSigner","stateMutability":"nonpayable","inputs":[{"name":"","type":"address"}],"outputs":[]},
    {"type":"function","name":"freeze","stateMutability":"nonpayable","inputs":[],"outputs":[]},
    {"type":"function","name":"unfreeze","stateMutability":"nonpayable","inputs":[],"outputs":[]},
    {"type":"function","name":"delegatedPayEth","stateMutability":"nonpayable","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"},{"name":"deadline","type":"uint256"},{"name":"signature","type":"bytes"}],"outputs":[]},
    {"type":"function","name":"delegatedPayERC20","stateMutability":"nonpayable","inputs":[{"name":"token","type":"address"},{"name":"to","type":"address"},{"name":"amount","type":"uint256"},{"name":"deadline","type":"uint256"},{"name":"signature","type":"bytes"}],"outputs":[]},
    {"type":"function","name":"delegatedExecute","stateMutability":"nonpayable","inputs":[{"name":"target","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"},{"name":"deadline","type":"uint256"},{"name":"signature","type":"bytes"}],"outputs":[]}
]

PERMISSIONS = {
    "READ": 1,
    "WRITE": 2,
    "EDIT_PROFILE": 4,
    "PAY": 8,
    "REGISTER_SERVICE": 16,
    "EXECUTE": 32
}

def build_did(chain_id: int, contract: str) -> str:
    return f"did:ethr:{chain_id}:{Web3.to_checksum_address(contract).lower()}"

def _domain(chain_id: int, verifying_contract: str) -> Dict[str, Any]:
    return {"name": "AetheriaAgentDID", "version": "1", "chainId": chain_id, "verifyingContract": verifying_contract}

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

# EIP-712 hashes for domain and types (mirror of contract constants)
EIP712_DOMAIN_TYPEHASH = keccak(text="EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
PAY_ETH_TYPEHASH = keccak(text="PayEth(address to,uint256 amount,uint256 nonce,uint256 deadline)")
PAY_ERC20_TYPEHASH = keccak(text="PayERC20(address token,address to,uint256 amount,uint256 nonce,uint256 deadline)")
EXECUTE_TYPEHASH = keccak(text="Execute(address target,uint256 value,bytes32 dataHash,uint256 nonce,uint256 deadline)")
NAME_HASH = keccak(text="AetheriaAgentDID")
VERSION_HASH = keccak(text="1")

def _domain_separator_py(chain_id: int, verifying_contract: str) -> bytes:
    return keccak(abi_encode([
        'bytes32', 'bytes32', 'bytes32', 'uint256', 'address'
    ], [
        EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, chain_id, to_checksum_address(verifying_contract)
    ]))

def _struct_hash_pay_eth(msg: Dict[str, Any]) -> bytes:
    return keccak(abi_encode([
        'bytes32', 'address', 'uint256', 'uint256', 'uint256'
    ], [
        PAY_ETH_TYPEHASH,
        to_checksum_address(msg['to']),
        int(msg['amount']),
        int(msg['nonce']),
        int(msg['deadline'])
    ]))

def _struct_hash_pay_erc20(msg: Dict[str, Any]) -> bytes:
    return keccak(abi_encode([
        'bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'
    ], [
        PAY_ERC20_TYPEHASH,
        to_checksum_address(msg['token']),
        to_checksum_address(msg['to']),
        int(msg['amount']),
        int(msg['nonce']),
        int(msg['deadline'])
    ]))

def _struct_hash_execute(msg: Dict[str, Any]) -> bytes:
    return keccak(abi_encode([
        'bytes32', 'address', 'uint256', 'bytes32', 'uint256', 'uint256'
    ], [
        EXECUTE_TYPEHASH,
        to_checksum_address(msg['target']),
        int(msg['value']),
        msg['dataHash'],
        int(msg['nonce']),
        int(msg['deadline'])
    ]))

def _digest(primary_type: str, message: Dict[str, Any], chain_id: int, verifying_contract: str) -> bytes:
    ds = _domain_separator_py(chain_id, verifying_contract)
    if primary_type == 'PayEth':
        sh = _struct_hash_pay_eth(message)
    elif primary_type == 'PayERC20':
        sh = _struct_hash_pay_erc20(message)
    elif primary_type == 'Execute':
        sh = _struct_hash_execute(message)
    else:
        raise ValueError('unknown primary type')
    return keccak(b"\x19\x01" + ds + sh)

def _sign_digest(private_key: str, digest: bytes) -> bytes:
    pk = private_key[2:] if private_key.startswith('0x') else private_key
    priv = keys.PrivateKey(bytes.fromhex(pk))
    sig = priv.sign_msg_hash(digest)
    return sig.to_bytes()

class AIEP:
    def __init__(self, w3: Web3, contract_address: str):
        self.w3 = w3
        self.address = to_checksum_address(contract_address)
        self.contract = w3.eth.contract(address=self.address, abi=ABI)

    # --- generic tx helper ---
    def _transact(self, func, private_key: str, value: int = 0):
        acct = Account.from_key(private_key)
        params = {
            'from': acct.address,
            'nonce': self.w3.eth.get_transaction_count(acct.address),
            'value': value,
            'gasPrice': self.w3.eth.gas_price,
            'chainId': self.w3.eth.chain_id
        }
        gas = func.estimate_gas({'from': acct.address, 'value': value})
        tx = func.build_transaction({**params, 'gas': gas})
        signed = Account.sign_transaction(tx, private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    # --- identity & config ---
    def owner_of(self):
        return self.contract.functions.ownerOf().call()

    def set_agent_signer(self, signer: str, private_key: str):
        func = self.contract.functions.setAgentSigner(to_checksum_address(signer))
        return self._transact(func, private_key)

    def transfer_agent_ownership(self, new_owner: str, private_key: str):
        func = self.contract.functions.transferAgentOwnership(to_checksum_address(new_owner))
        return self._transact(func, private_key)


    # --- balances ---
    def deposit_to_agent(self, amount_wei: int, private_key: str):
        func = self.contract.functions.depositToAgent()
        return self._transact(func, private_key, value=amount_wei)

    def balance_of(self) -> int:
        return self.contract.functions.balanceOf().call()

    def deposit_erc20(self, token: str, amount: int, private_key: str):
        func = self.contract.functions.depositERC20(to_checksum_address(token), amount)
        return self._transact(func, private_key)

    def balance_of_erc20(self, token: str) -> int:
        return self.contract.functions.balanceOfERC20(to_checksum_address(token)).call()

    # --- metadata ---
    def update_metadata(self, uri: str, private_key: str):
        func = self.contract.functions.updateMetadata(uri)
        return self._transact(func, private_key)


    def did(self) -> str:
        return self.contract.functions.did().call()

    # --- readonly helpers ---
    def get_nonce(self) -> int:
        return self.contract.functions.getNonce().call()

    def is_frozen(self) -> bool:
        return self.contract.functions.isFrozen().call()


    def get_agent_signer(self) -> str:
        return self.contract.functions.getAgentSigner().call()

    # --- delegated signed flows ---
    def _sign_typed(self, primary_type: str, message: Dict[str, Any], private_key: str):
        chain_id = self.w3.eth.chain_id
        if HAS_ENCODE_STRUCTURED:
            typed = {
                'types': TYPES,
                'primaryType': primary_type,
                'domain': _domain(chain_id, self.address),
                'message': message
            }
            msg = encode_structured_data(typed)
            signed = Account.sign_message(msg, private_key)
            return signed.signature
        digest = _digest(primary_type, message, chain_id, self.address)
        return _sign_digest(private_key, digest)


    def delegated_pay_eth(self, to: str, amount_wei: int, deadline: int, private_key: str):
        nonce = self.get_nonce()
        value = {"to": to_checksum_address(to), "amount": amount_wei, "nonce": nonce, "deadline": deadline}
        sig = self._sign_typed("PayEth", value, private_key)
        func = self.contract.functions.delegatedPayEth(to_checksum_address(to), amount_wei, deadline, sig)
        return self._transact(func, private_key)

    def sign_delegated_pay_eth(self, to: str, amount_wei: int, deadline: int, private_key: str) -> Dict[str, Any]:
        nonce = self.get_nonce()
        value = {"to": to_checksum_address(to), "amount": amount_wei, "nonce": nonce, "deadline": deadline}
        sig = self._sign_typed("PayEth", value, private_key)
        return {"domain": _domain(self.w3.eth.chain_id, self.address), "value": value, "signature": sig.hex()}

    def delegated_pay_erc20(self, token: str, to: str, amount: int, deadline: int, private_key: str):
        nonce = self.get_nonce()
        value = {"token": to_checksum_address(token), "to": to_checksum_address(to), "amount": amount, "nonce": nonce, "deadline": deadline}
        sig = self._sign_typed("PayERC20", value, private_key)
        func = self.contract.functions.delegatedPayERC20(to_checksum_address(token), to_checksum_address(to), amount, deadline, sig)
        return self._transact(func, private_key)

    def sign_delegated_pay_erc20(self, token: str, to: str, amount: int, deadline: int, private_key: str) -> Dict[str, Any]:
        nonce = self.get_nonce()
        value = {"token": to_checksum_address(token), "to": to_checksum_address(to), "amount": amount, "nonce": nonce, "deadline": deadline}
        sig = self._sign_typed("PayERC20", value, private_key)
        return {"domain": _domain(self.w3.eth.chain_id, self.address), "value": value, "signature": sig.hex()}

    def delegated_execute(self, target: str, value_wei: int, data: bytes, deadline: int, private_key: str):
        nonce = self.get_nonce()
        data_hash = keccak(data)
        value = {"target": to_checksum_address(target), "value": value_wei, "dataHash": data_hash, "nonce": nonce, "deadline": deadline}
        sig = self._sign_typed("Execute", value, private_key)
        func = self.contract.functions.delegatedExecute(to_checksum_address(target), value_wei, data, deadline, sig)
        return self._transact(func, private_key)

    def sign_delegated_execute(self, target: str, value_wei: int, data: bytes, deadline: int, private_key: str) -> Dict[str, Any]:
        nonce = self.get_nonce()
        data_hash = keccak(data)
        value = {"target": to_checksum_address(target), "value": value_wei, "dataHash": data_hash, "nonce": nonce, "deadline": deadline}
        sig = self._sign_typed("Execute", value, private_key)
        return {"domain": _domain(self.w3.eth.chain_id, self.address), "value": value, "signature": sig.hex()}


class AIEPFactory:
    def __init__(self, w3: Web3, address: str):
        self.w3 = w3
        self.address = to_checksum_address(address)
        self.contract = w3.eth.contract(address=self.address, abi=FACTORY_ABI)

    def compute_address(self, owner: str, signer: str, metadata_uri: str, salt: bytes) -> str:
        return self.contract.functions.computeAddress(to_checksum_address(owner), to_checksum_address(signer), metadata_uri, salt).call()

    def deploy_agent(self, owner_private_key: str, owner: str, signer: str, metadata_uri: str, salt: bytes):
        acct = Account.from_key(owner_private_key)
        func = self.contract.functions.deployAgent(to_checksum_address(owner), to_checksum_address(signer), metadata_uri, salt)
        params = {
            'from': acct.address,
            'nonce': self.w3.eth.get_transaction_count(acct.address),
            'gasPrice': self.w3.eth.gas_price,
            'chainId': self.w3.eth.chain_id
        }
        gas = func.estimate_gas({'from': acct.address})
        tx = func.build_transaction({**params, 'gas': gas})
        signed = Account.sign_transaction(tx, owner_private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def deploy_and_pay_erc20(self, owner_private_key: str, owner: str, signer: str, metadata_uri: str, salt: bytes,
                              token: str, to: str, amount: int, deadline: int, signature: bytes):
        acct = Account.from_key(owner_private_key)
        func = self.contract.functions.deployAndDelegatedPayERC20(to_checksum_address(owner), to_checksum_address(signer), metadata_uri, salt,
                                                                  to_checksum_address(token), to_checksum_address(to), amount, deadline, signature)
        params = {'from': acct.address, 'nonce': self.w3.eth.get_transaction_count(acct.address), 'gasPrice': self.w3.eth.gas_price, 'chainId': self.w3.eth.chain_id}
        gas = func.estimate_gas({'from': acct.address})
        tx = func.build_transaction({**params, 'gas': gas})
        signed = Account.sign_transaction(tx, owner_private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def deploy_and_pay_eth(self, owner_private_key: str, owner: str, signer: str, metadata_uri: str, salt: bytes,
                           to: str, amount_wei: int, deadline: int, signature: bytes):
        acct = Account.from_key(owner_private_key)
        func = self.contract.functions.deployAndDelegatedPayEth(to_checksum_address(owner), to_checksum_address(signer), metadata_uri, salt,
                                                                to_checksum_address(to), amount_wei, deadline, signature)
        params = {'from': acct.address, 'nonce': self.w3.eth.get_transaction_count(acct.address), 'gasPrice': self.w3.eth.gas_price, 'chainId': self.w3.eth.chain_id}
        gas = func.estimate_gas({'from': acct.address})
        tx = func.build_transaction({**params, 'gas': gas})
        signed = Account.sign_transaction(tx, owner_private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)


class EasyAgent:
    def __init__(self, w3: Web3, factory_address: str, owner_address: str, signer_private_key: str, metadata_uri: str = "ipfs://agent-profile"):
        self.w3 = w3
        self.factory = AIEPFactory(w3, factory_address)
        self.owner = to_checksum_address(owner_address)
        self.signer_private_key = signer_private_key
        self.signer_address = Account.from_key(signer_private_key).address
        self.metadata_uri = metadata_uri
        salt_src = (self.owner + ":" + self.signer_address).encode()
        self.salt = keccak(salt_src)
        self.address = self.factory.compute_address(self.owner, self.signer_address, self.metadata_uri, self.salt)

    def ensure_deployed(self, owner_private_key: str):
        code = self.w3.eth.get_code(self.address)
        if code and len(code) > 0:
            return self.address
        self.factory.deploy_agent(owner_private_key, self.owner, self.signer_address, self.metadata_uri, self.salt)
        return self.address

    def pay_erc20(self, token: str, to: str, amount: int, owner_private_key: str, deadline: Optional[int] = None, auto_refill: Optional[Dict[str, Any]] = None):
        dl = deadline or int(self.w3.eth.get_block('latest').timestamp) + 3600
        amt = self._normalize_amount_erc20(token, amount)
        code = self.w3.eth.get_code(self.address)
        if auto_refill:
            min_token = self._normalize_amount_erc20(token, auto_refill.get('min_token', amt))
            bal = AIEP(self.w3, self.address).balance_of_erc20(token) if (code and len(code) > 0) else 0
            if bal < min_token:
                refill_amount = self._normalize_amount_erc20(token, auto_refill.get('refill_amount', min_token - bal))
                self.fund_erc20(owner_private_key, token, refill_amount)
        if not code or len(code) == 0:
            value = {"token": to_checksum_address(token), "to": to_checksum_address(to), "amount": amt, "nonce": 0, "deadline": dl}
            sig = self._sign_typed("PayERC20", value, self.signer_private_key)
            return self.factory.deploy_and_pay_erc20(owner_private_key, self.owner, self.signer_address, self.metadata_uri, self.salt,
                                                     token, to, amt, dl, sig)
        agent = AIEP(self.w3, self.address)
        return agent.delegated_pay_erc20(token, to, amt, dl, self.signer_private_key)

    def pay_eth(self, to: str, amount_wei: int, owner_private_key: str, deadline: Optional[int] = None, auto_refill: Optional[Dict[str, Any]] = None):
        dl = deadline or int(self.w3.eth.get_block('latest').timestamp) + 3600
        code = self.w3.eth.get_code(self.address)
        if auto_refill:
            min_wei = int(auto_refill.get('min_wei', amount_wei))
            bal = AIEP(self.w3, self.address).balance_of() if (code and len(code) > 0) else 0
            if bal < min_wei:
                refill_wei = int(auto_refill.get('refill_wei', min_wei - bal))
                self.fund_eth(owner_private_key, refill_wei)
        if not code or len(code) == 0:
            value = {"to": to_checksum_address(to), "amount": amount_wei, "nonce": 0, "deadline": dl}
            sig = self._sign_typed("PayEth", value, self.signer_private_key)
            return self.factory.deploy_and_pay_eth(owner_private_key, self.owner, self.signer_address, self.metadata_uri, self.salt,
                                                   to, amount_wei, dl, sig)
        agent = AIEP(self.w3, self.address)
        return agent.delegated_pay_eth(to, amount_wei, dl, self.signer_private_key)


    def update_metadata(self, uri: str, owner_private_key: str):
        self.ensure_deployed(owner_private_key)
        func = self.factory.w3.eth.contract(address=self.address, abi=ABI).functions.updateMetadata(uri)
        acct = Account.from_key(owner_private_key)
        params = {'from': acct.address, 'nonce': self.w3.eth.get_transaction_count(acct.address), 'gasPrice': self.w3.eth.gas_price, 'chainId': self.w3.eth.chain_id}
        gas = func.estimate_gas({'from': acct.address})
        tx = func.build_transaction({**params, 'gas': gas})
        signed = Account.sign_transaction(tx, owner_private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def did(self) -> str:
        chain_id = self.w3.eth.chain_id
        return build_did(chain_id, self.address)

    def fund_eth(self, owner_private_key: str, amount_wei: int):
        code = self.w3.eth.get_code(self.address)
        if code and len(code) > 0:
            return AIEP(self.w3, self.address).deposit_to_agent(amount_wei, owner_private_key)
        acct = Account.from_key(owner_private_key)
        tx = {
            'from': acct.address,
            'to': self.address,
            'value': amount_wei,
            'nonce': self.w3.eth.get_transaction_count(acct.address),
            'gasPrice': self.w3.eth.gas_price,
            'chainId': self.w3.eth.chain_id
        }
        tx['gas'] = self.w3.eth.estimate_gas(tx)
        signed = Account.sign_transaction(tx, owner_private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def fund_erc20(self, owner_private_key: str, token: str, amount: Any):
        amt = self._normalize_amount_erc20(token, amount)
        acct = Account.from_key(owner_private_key)
        erc20_abi = [
            {"type":"function","name":"transfer","stateMutability":"nonpayable","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]}
        ]
        t = self.w3.eth.contract(address=to_checksum_address(token), abi=erc20_abi)
        func = t.functions.transfer(to_checksum_address(self.address), amt)
        params = {'from': acct.address, 'nonce': self.w3.eth.get_transaction_count(acct.address), 'gasPrice': self.w3.eth.gas_price, 'chainId': self.w3.eth.chain_id}
        gas = func.estimate_gas({'from': acct.address})
        tx = func.build_transaction({**params, 'gas': gas})
        signed = Account.sign_transaction(tx, owner_private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def get_status(self, token: Optional[str] = None) -> Dict[str, Any]:
        code = self.w3.eth.get_code(self.address)
        deployed = bool(code and len(code) > 0)
        bal_eth = 0
        if deployed:
            bal_eth = AIEP(self.w3, self.address).balance_of()
        bal_erc20 = None
        if token:
            bal_erc20 = AIEP(self.w3, self.address).balance_of_erc20(to_checksum_address(token))
        return {"address": self.address, "deployed": deployed, "ethBalance": bal_eth, "erc20Balance": bal_erc20}

    def _normalize_amount_erc20(self, token: str, amount: Any) -> int:
        if isinstance(amount, int):
            return amount
        if isinstance(amount, str):
            dec_abi = [{"type":"function","name":"decimals","stateMutability":"view","inputs":[],"outputs":[{"name":"","type":"uint8"}]}]
            erc20 = self.w3.eth.contract(address=to_checksum_address(token), abi=dec_abi)
            decimals = erc20.functions.decimals().call()
            # simple parseUnits
            parts = amount.split('.')
            if len(parts) == 1:
                return int(parts[0]) * (10 ** decimals)
            whole, frac = parts[0], parts[1][:decimals]
            frac = frac + ('0' * (decimals - len(frac)))
            return int(whole) * (10 ** decimals) + int(frac)
        raise ValueError("amount must be int or decimal string")


class SafeModule:
    def __init__(self, w3: Web3, module_address: str):
        self.w3 = w3
        self.address = to_checksum_address(module_address)
        self.contract = w3.eth.contract(address=self.address, abi=SAFE_MODULE_ABI)

    def _sign_typed(self, primary_type: str, message: Dict[str, Any], private_key: str):
        chain_id = self.w3.eth.chain_id
        typed = {
            'types': TYPES,
            'primaryType': primary_type,
            'domain': _domain(chain_id, self.address),
            'message': message
        }
        msg = encode_structured_data(typed)
        signed = Account.sign_message(msg, private_key)
        return signed.signature

    def delegated_pay_eth(self, to: str, amount_wei: int, deadline: int, signer_private_key: str, owner_private_key: str):
        nonce = self.contract.functions.nonce().call()
        value = {"to": to_checksum_address(to), "amount": amount_wei, "nonce": nonce, "deadline": deadline}
        sig = self._sign_typed("PayEth", value, signer_private_key)
        acct = Account.from_key(owner_private_key)
        func = self.contract.functions.delegatedPayEth(to_checksum_address(to), amount_wei, deadline, sig)
        params = {'from': acct.address, 'nonce': self.w3.eth.get_transaction_count(acct.address), 'gasPrice': self.w3.eth.gas_price, 'chainId': self.w3.eth.chain_id}
        gas = func.estimate_gas({'from': acct.address})
        tx = func.build_transaction({**params, 'gas': gas})
        signed = Account.sign_transaction(tx, owner_private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def delegated_pay_erc20(self, token: str, to: str, amount: Any, deadline: int, signer_private_key: str, owner_private_key: str):
        amt = EasyAgent(self.w3, self.address, Account.from_key(signer_private_key).address, signer_private_key)._normalize_amount_erc20(token, amount)
        nonce = self.contract.functions.nonce().call()
        value = {"token": to_checksum_address(token), "to": to_checksum_address(to), "amount": amt, "nonce": nonce, "deadline": deadline}
        sig = self._sign_typed("PayERC20", value, signer_private_key)
        acct = Account.from_key(owner_private_key)
        func = self.contract.functions.delegatedPayERC20(to_checksum_address(token), to_checksum_address(to), amt, deadline, sig)
        params = {'from': acct.address, 'nonce': self.w3.eth.get_transaction_count(acct.address), 'gasPrice': self.w3.eth.gas_price, 'chainId': self.w3.eth.chain_id}
        gas = func.estimate_gas({'from': acct.address})
        tx = func.build_transaction({**params, 'gas': gas})
        signed = Account.sign_transaction(tx, owner_private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)

    def delegated_execute(self, target: str, value_wei: int, data: bytes, deadline: int, signer_private_key: str, owner_private_key: str):
        nonce = self.contract.functions.nonce().call()
        data_hash = keccak(data)
        value = {"target": to_checksum_address(target), "value": value_wei, "dataHash": data_hash, "nonce": nonce, "deadline": deadline}
        sig = self._sign_typed("Execute", value, signer_private_key)
        acct = Account.from_key(owner_private_key)
        func = self.contract.functions.delegatedExecute(to_checksum_address(target), value_wei, data, deadline, sig)
        params = {'from': acct.address, 'nonce': self.w3.eth.get_transaction_count(acct.address), 'gasPrice': self.w3.eth.gas_price, 'chainId': self.w3.eth.chain_id}
        gas = func.estimate_gas({'from': acct.address})
        tx = func.build_transaction({**params, 'gas': gas})
        signed = Account.sign_transaction(tx, owner_private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        return self.w3.eth.wait_for_transaction_receipt(tx_hash)


class BatchSender:
    def __init__(self, easy_agent: EasyAgent):
        self.agent = easy_agent
        self.items: List[Dict[str, Any]] = []

    def add_pay_eth(self, to: str, amount_wei: int, owner_private_key: str, deadline: Optional[int] = None, auto_refill: Optional[Dict[str, Any]] = None):
        self.items.append({"t": "eth", "to": to, "amount": amount_wei, "owner_pk": owner_private_key, "deadline": deadline, "auto_refill": auto_refill})

    def add_pay_erc20(self, token: str, to: str, amount: Any, owner_private_key: str, deadline: Optional[int] = None, auto_refill: Optional[Dict[str, Any]] = None):
        self.items.append({"t": "erc20", "token": token, "to": to, "amount": amount, "owner_pk": owner_private_key, "deadline": deadline, "auto_refill": auto_refill})

    def add_execute(self, target: str, value_wei: int, data: bytes, owner_private_key: str, deadline: Optional[int] = None):
        self.items.append({"t": "exec", "target": target, "value": value_wei, "data": data, "owner_pk": owner_private_key, "deadline": deadline})

    def send(self) -> List[Any]:
        self.agent.ensure_deployed(self.items[0]["owner_pk"]) if self.items else None
        results = []
        for it in self.items:
            if it["t"] == "eth":
                r = self.agent.pay_eth(it["to"], it["amount"], it["owner_pk"], it["deadline"], it.get("auto_refill"))
                results.append(r)
            elif it["t"] == "erc20":
                r = self.agent.pay_erc20(it["token"], it["to"], it["amount"], it["owner_pk"], it["deadline"], it.get("auto_refill"))
                results.append(r)
            elif it["t"] == "exec":
                dl = it["deadline"] or int(self.agent.w3.eth.get_block('latest').timestamp) + 3600
                r = AIEP(self.agent.w3, self.agent.address).delegated_execute(it["target"], it["value"], it["data"], dl, self.agent.signer_private_key)
                results.append(r)
        return results


class BundlerClient:
    def __init__(self, url: str):
        self.url = url
        self._id = 0

    def _req(self, method: str, params: List[Any]) -> Dict[str, Any]:
        self._id += 1
        payload = json.dumps({"jsonrpc": "2.0", "id": self._id, "method": method, "params": params}).encode()
        req = urllib.request.Request(self.url, data=payload, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read().decode()
                return json.loads(data)
        except urllib.error.HTTPError as e:
            msg = e.read().decode()
            raise RuntimeError(self.normalize_error(msg))
        except Exception as e:
            raise RuntimeError(self.normalize_error(str(e)))

    def normalize_error(self, msg: str) -> str:
        m = msg.lower()
        if "expired" in m:
            return "userop_expired"
        if "insufficient" in m or "fund" in m:
            return "insufficient_funds"
        if "signature" in m or "invalid signature" in m:
            return "signature_invalid"
        if "revert" in m or "execution reverted" in m:
            return "execution_reverted"
        return "rpc_error: " + msg

    def send_userop(self, entry_point: str, userop: Dict[str, Any]) -> str:
        res = self._req("eth_sendUserOperation", [userop, entry_point])
        if "error" in res:
            raise RuntimeError(self.normalize_error(json.dumps(res["error"])))
        return res.get("result")

    def get_receipt(self, userop_hash: str) -> Optional[Dict[str, Any]]:
        res = self._req("eth_getUserOperationReceipt", [userop_hash])
        if "error" in res:
            return None
        return res.get("result")


def use_bundler(url: str) -> BundlerClient:
    return BundlerClient(url)


def send_userop(client: BundlerClient, entry_point: str, userop: Dict[str, Any], max_retries: int = 3, backoff_ms: int = 500, on_retry: Optional[Callable[[int, str], None]] = None, wait_receipt: bool = True, receipt_timeout_sec: int = 30) -> Dict[str, Any]:
    attempt = 0
    last_err = ""
    while attempt <= max_retries:
        try:
            h = client.send_userop(entry_point, userop)
            if not wait_receipt:
                return {"hash": h, "receipt": None}
            deadline = time.time() + receipt_timeout_sec
            while time.time() < deadline:
                r = client.get_receipt(h)
                if r:
                    return {"hash": h, "receipt": r}
                time.sleep(0.5)
            return {"hash": h, "receipt": None}
        except RuntimeError as e:
            last_err = str(e)
            if attempt == max_retries:
                break
            if on_retry:
                on_retry(attempt + 1, last_err)
            time.sleep((backoff_ms / 1000.0) * (2 ** attempt))
            attempt += 1
    raise RuntimeError(last_err)


class RelayerClient:
    def __init__(self, base_url: str, headers: Optional[Dict[str, str]] = None):
        self.base_url = base_url
        self.headers = headers or {}

    def _post(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        data = json.dumps(body).encode()
        req = urllib.request.Request(self.base_url + path, data=data, headers={"Content-Type": "application/json", **self.headers})
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return json.loads(raw)

    def submit_delegated_pay_eth(self, agent: str, to: str, amount_wei: int, deadline: int, signature: str) -> Dict[str, Any]:
        body = {"agent": agent, "to": to, "amountWei": str(amount_wei), "deadline": deadline, "signature": signature}
        return self._post("/eth/delegated-pay-eth", body)

    def submit_delegated_pay_erc20(self, agent: str, token: str, to: str, amount: int, deadline: int, signature: str) -> Dict[str, Any]:
        body = {"agent": agent, "token": token, "to": to, "amount": str(amount), "deadline": deadline, "signature": signature}
        return self._post("/eth/delegated-pay-erc20", body)

    def submit_delegated_execute(self, agent: str, target: str, value_wei: int, data_hex: str, deadline: int, signature: str) -> Dict[str, Any]:
        body = {"agent": agent, "target": target, "valueWei": str(value_wei), "data": data_hex, "deadline": deadline, "signature": signature}
        return self._post("/eth/delegated-execute", body)


class JitoRelayer:
    def __init__(self, base_url: str, headers: Optional[Dict[str, str]] = None):
        self.base_url = base_url
        self.headers = headers or {}

    def submit_bundle(self, transactions: List[str]) -> Dict[str, Any]:
        data = json.dumps({"transactions": transactions}).encode()
        req = urllib.request.Request(self.base_url + "/solana/jito/bundle", data=data, headers={"Content-Type": "application/json", **self.headers})
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return json.loads(raw)
