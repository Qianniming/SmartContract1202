from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_structured_data
from eth_utils import keccak, to_checksum_address

ABI: List[Any] = [
    {"type":"function","name":"registerAgent","stateMutability":"nonpayable","inputs":[{"name":"metadataURI","type":"string"},{"name":"signer","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},
    {"type":"function","name":"ownerOf","stateMutability":"view","inputs":[{"name":"","type":"uint256"}],"outputs":[{"name":"","type":"address"}]},
    {"type":"function","name":"setAgentSigner","stateMutability":"nonpayable","inputs":[{"name":"agentId","type":"uint256"},{"name":"signer","type":"address"}],"outputs":[]},
    {"type":"function","name":"transferAgentOwnership","stateMutability":"nonpayable","inputs":[{"name":"agentId","type":"uint256"},{"name":"newOwner","type":"address"}],"outputs":[]},
    {"type":"function","name":"setAgentKey","stateMutability":"nonpayable","inputs":[{"name":"agentId","type":"uint256"},{"name":"keyHash","type":"bytes32"},{"name":"expireAt","type":"uint256"}],"outputs":[]},
    {"type":"function","name":"disableAgentKey","stateMutability":"nonpayable","inputs":[{"name":"agentId","type":"uint256"},{"name":"keyHash","type":"bytes32"}],"outputs":[]},
    {"type":"function","name":"createAuthorizedKey","stateMutability":"nonpayable","inputs":[{"name":"agentId","type":"uint256"},{"name":"keyHash","type":"bytes32"},{"name":"expireAt","type":"uint256"},{"name":"permissions","type":"uint256"}],"outputs":[]},
    {"type":"function","name":"revokeAuthorizedKey","stateMutability":"nonpayable","inputs":[{"name":"agentId","type":"uint256"},{"name":"keyHash","type":"bytes32"}],"outputs":[]},
    {"type":"function","name":"verifyAgentKey","stateMutability":"view","inputs":[{"name":"agentId","type":"uint256"},{"name":"keyHash","type":"bytes32"}],"outputs":[{"name":"","type":"bool"}]},
    {"type":"function","name":"verifyAuthorizedKey","stateMutability":"view","inputs":[{"name":"agentId","type":"uint256"},{"name":"keyHash","type":"bytes32"},{"name":"requiredPermissions","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]},
    {"type":"function","name":"delegatedCreateAuthorizedKey","stateMutability":"nonpayable","inputs":[{"name":"agentId","type":"uint256"},{"name":"keyHash","type":"bytes32"},{"name":"expireAt","type":"uint256"},{"name":"permissions","type":"uint256"},{"name":"deadline","type":"uint256"},{"name":"signature","type":"bytes"}],"outputs":[]},
    {"type":"function","name":"getNonce","stateMutability":"view","inputs":[{"name":"agentId","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},
    {"type":"function","name":"depositToAgent","stateMutability":"payable","inputs":[{"name":"agentId","type":"uint256"}],"outputs":[]},
    {"type":"function","name":"balanceOf","stateMutability":"view","inputs":[{"name":"agentId","type":"uint256"}],"outputs":[{"name":"","type":"uint256"}]},
    {"type":"function","name":"delegatedPayEth","stateMutability":"nonpayable","inputs":[{"name":"agentId","type":"uint256"},{"name":"to","type":"address"},{"name":"amount","type":"uint256"},{"name":"deadline","type":"uint256"},{"name":"signature","type":"bytes"}],"outputs":[]},
    {"type":"function","name":"depositERC20","stateMutability":"nonpayable","inputs":[{"name":"agentId","type":"uint256"},{"name":"token","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[]},
    {"type":"function","name":"balanceOfERC20","stateMutability":"view","inputs":[{"name":"agentId","type":"uint256"},{"name":"token","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},
    {"type":"function","name":"delegatedPayERC20","stateMutability":"nonpayable","inputs":[{"name":"agentId","type":"uint256"},{"name":"token","type":"address"},{"name":"to","type":"address"},{"name":"amount","type":"uint256"},{"name":"deadline","type":"uint256"},{"name":"signature","type":"bytes"}],"outputs":[]},
    {"type":"function","name":"updateMetadata","stateMutability":"nonpayable","inputs":[{"name":"agentId","type":"uint256"},{"name":"metadataURI","type":"string"}],"outputs":[]},
    {"type":"function","name":"setServiceEndpoint","stateMutability":"nonpayable","inputs":[{"name":"agentId","type":"uint256"},{"name":"key","type":"string"},{"name":"value","type":"string"}],"outputs":[]},
    {"type":"function","name":"removeServiceEndpoint","stateMutability":"nonpayable","inputs":[{"name":"agentId","type":"uint256"},{"name":"key","type":"string"}],"outputs":[]},
    {"type":"function","name":"getServiceEndpoint","stateMutability":"view","inputs":[{"name":"agentId","type":"uint256"},{"name":"key","type":"string"}],"outputs":[{"name":"","type":"string"}]},
    {"type":"function","name":"getServiceKeys","stateMutability":"view","inputs":[{"name":"agentId","type":"uint256"}],"outputs":[{"name":"","type":"string[]"}]},
    {"type":"function","name":"didOf","stateMutability":"view","inputs":[{"name":"agentId","type":"uint256"}],"outputs":[{"name":"","type":"string"}]},
    {"type":"function","name":"isFrozen","stateMutability":"view","inputs":[{"name":"agentId","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]},
    {"type":"function","name":"getAuthorizedKey","stateMutability":"view","inputs":[{"name":"agentId","type":"uint256"},{"name":"keyHash","type":"bytes32"}],"outputs":[{"name":"expireAt","type":"uint256"},{"name":"permissions","type":"uint256"},{"name":"enabled","type":"bool"}]},
    {"type":"function","name":"getAgentSigner","stateMutability":"view","inputs":[{"name":"agentId","type":"uint256"}],"outputs":[{"name":"","type":"address"}]},
    {"type":"function","name":"delegatedExecute","stateMutability":"nonpayable","inputs":[{"name":"agentId","type":"uint256"},{"name":"target","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"},{"name":"deadline","type":"uint256"},{"name":"signature","type":"bytes"}],"outputs":[]}
]

PERMISSIONS = {
    "READ": 1,
    "WRITE": 2,
    "EDIT_PROFILE": 4,
    "PAY": 8,
    "REGISTER_SERVICE": 16,
    "EXECUTE": 32
}

def build_did(chain_id: int, contract: str, agent_id: int) -> str:
    return f"did:ethr:{chain_id}:{Web3.to_checksum_address(contract).lower()}:{agent_id}"

def _domain(chain_id: int, verifying_contract: str) -> Dict[str, Any]:
    return {"name": "AetheriaAgentDID", "version": "1", "chainId": chain_id, "verifyingContract": verifying_contract}

TYPES = {
    "EIP712Domain": [
        {"name": "name", "type": "string"},
        {"name": "version", "type": "string"},
        {"name": "chainId", "type": "uint256"},
        {"name": "verifyingContract", "type": "address"}
    ],
    "CreateAuthorizedKey": [
        {"name": "agentId", "type": "uint256"},
        {"name": "keyHash", "type": "bytes32"},
        {"name": "expireAt", "type": "uint256"},
        {"name": "permissions", "type": "uint256"},
        {"name": "nonce", "type": "uint256"},
        {"name": "deadline", "type": "uint256"}
    ],
    "PayEth": [
        {"name": "agentId", "type": "uint256"},
        {"name": "to", "type": "address"},
        {"name": "amount", "type": "uint256"},
        {"name": "nonce", "type": "uint256"},
        {"name": "deadline", "type": "uint256"}
    ],
    "PayERC20": [
        {"name": "agentId", "type": "uint256"},
        {"name": "token", "type": "address"},
        {"name": "to", "type": "address"},
        {"name": "amount", "type": "uint256"},
        {"name": "nonce", "type": "uint256"},
        {"name": "deadline", "type": "uint256"}
    ],
    "Execute": [
        {"name": "agentId", "type": "uint256"},
        {"name": "target", "type": "address"},
        {"name": "value", "type": "uint256"},
        {"name": "dataHash", "type": "bytes32"},
        {"name": "nonce", "type": "uint256"},
        {"name": "deadline", "type": "uint256"}
    ]
}

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
    def register_agent(self, metadata_uri: str, private_key: str, signer: str = "0x0000000000000000000000000000000000000000"):
        func = self.contract.functions.registerAgent(metadata_uri, to_checksum_address(signer))
        return self._transact(func, private_key)

    def owner_of(self, agent_id: int):
        return self.contract.functions.ownerOf(agent_id).call()

    def set_agent_signer(self, agent_id: int, signer: str, private_key: str):
        func = self.contract.functions.setAgentSigner(agent_id, to_checksum_address(signer))
        return self._transact(func, private_key)

    def transfer_agent_ownership(self, agent_id: int, new_owner: str, private_key: str):
        func = self.contract.functions.transferAgentOwnership(agent_id, to_checksum_address(new_owner))
        return self._transact(func, private_key)

    def set_agent_key(self, agent_id: int, key_hash: str, expire_at: int, private_key: str):
        func = self.contract.functions.setAgentKey(agent_id, key_hash, expire_at)
        return self._transact(func, private_key)

    def disable_agent_key(self, agent_id: int, key_hash: str, private_key: str):
        func = self.contract.functions.disableAgentKey(agent_id, key_hash)
        return self._transact(func, private_key)

    # --- authorized keys ---
    def create_authorized_key(self, agent_id: int, key_hash: str, expire_at: int, permissions: int, private_key: str):
        func = self.contract.functions.createAuthorizedKey(agent_id, key_hash, expire_at, permissions)
        return self._transact(func, private_key)

    def revoke_authorized_key(self, agent_id: int, key_hash: str, private_key: str):
        func = self.contract.functions.revokeAuthorizedKey(agent_id, key_hash)
        return self._transact(func, private_key)

    def verify_authorized_key(self, agent_id: int, key_hash: str, required_permissions: int) -> bool:
        return self.contract.functions.verifyAuthorizedKey(agent_id, key_hash, required_permissions).call()

    def verify_agent_key(self, agent_id: int, key_hash: str) -> bool:
        return self.contract.functions.verifyAgentKey(agent_id, key_hash).call()

    # --- balances ---
    def deposit_to_agent(self, agent_id: int, amount_wei: int, private_key: str):
        func = self.contract.functions.depositToAgent(agent_id)
        return self._transact(func, private_key, value=amount_wei)

    def balance_of(self, agent_id: int) -> int:
        return self.contract.functions.balanceOf(agent_id).call()

    def deposit_erc20(self, agent_id: int, token: str, amount: int, private_key: str):
        func = self.contract.functions.depositERC20(agent_id, to_checksum_address(token), amount)
        return self._transact(func, private_key)

    def balance_of_erc20(self, agent_id: int, token: str) -> int:
        return self.contract.functions.balanceOfERC20(agent_id, to_checksum_address(token)).call()

    # --- metadata & services ---
    def update_metadata(self, agent_id: int, uri: str, private_key: str):
        func = self.contract.functions.updateMetadata(agent_id, uri)
        return self._transact(func, private_key)

    def set_service_endpoint(self, agent_id: int, key: str, value: str, private_key: str):
        func = self.contract.functions.setServiceEndpoint(agent_id, key, value)
        return self._transact(func, private_key)

    def remove_service_endpoint(self, agent_id: int, key: str, private_key: str):
        func = self.contract.functions.removeServiceEndpoint(agent_id, key)
        return self._transact(func, private_key)

    def get_service_endpoint(self, agent_id: int, key: str) -> str:
        return self.contract.functions.getServiceEndpoint(agent_id, key).call()

    def get_service_keys(self, agent_id: int) -> List[str]:
        return self.contract.functions.getServiceKeys(agent_id).call()

    def did_of(self, agent_id: int) -> str:
        return self.contract.functions.didOf(agent_id).call()

    # --- readonly helpers ---
    def get_nonce(self, agent_id: int) -> int:
        return self.contract.functions.getNonce(agent_id).call()

    def is_frozen(self, agent_id: int) -> bool:
        return self.contract.functions.isFrozen(agent_id).call()

    def get_authorized_key(self, agent_id: int, key_hash: str):
        return self.contract.functions.getAuthorizedKey(agent_id, key_hash).call()

    def get_agent_signer(self, agent_id: int) -> str:
        return self.contract.functions.getAgentSigner(agent_id).call()

    # --- delegated signed flows ---
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

    def delegated_create_authorized_key(self, agent_id: int, key_hash: str, expire_at: int, permissions: int, deadline: int, private_key: str):
        nonce = self.get_nonce(agent_id)
        value = {"agentId": agent_id, "keyHash": key_hash, "expireAt": expire_at, "permissions": permissions, "nonce": nonce, "deadline": deadline}
        sig = self._sign_typed("CreateAuthorizedKey", value, private_key)
        func = self.contract.functions.delegatedCreateAuthorizedKey(agent_id, key_hash, expire_at, permissions, deadline, sig)
        return self._transact(func, private_key)

    def delegated_pay_eth(self, agent_id: int, to: str, amount_wei: int, deadline: int, private_key: str):
        nonce = self.get_nonce(agent_id)
        value = {"agentId": agent_id, "to": to_checksum_address(to), "amount": amount_wei, "nonce": nonce, "deadline": deadline}
        sig = self._sign_typed("PayEth", value, private_key)
        func = self.contract.functions.delegatedPayEth(agent_id, to_checksum_address(to), amount_wei, deadline, sig)
        return self._transact(func, private_key)

    def delegated_pay_erc20(self, agent_id: int, token: str, to: str, amount: int, deadline: int, private_key: str):
        nonce = self.get_nonce(agent_id)
        value = {"agentId": agent_id, "token": to_checksum_address(token), "to": to_checksum_address(to), "amount": amount, "nonce": nonce, "deadline": deadline}
        sig = self._sign_typed("PayERC20", value, private_key)
        func = self.contract.functions.delegatedPayERC20(agent_id, to_checksum_address(token), to_checksum_address(to), amount, deadline, sig)
        return self._transact(func, private_key)

    def delegated_execute(self, agent_id: int, target: str, value_wei: int, data: bytes, deadline: int, private_key: str):
        nonce = self.get_nonce(agent_id)
        data_hash = keccak(data)
        value = {"agentId": agent_id, "target": to_checksum_address(target), "value": value_wei, "dataHash": data_hash, "nonce": nonce, "deadline": deadline}
        sig = self._sign_typed("Execute", value, private_key)
        func = self.contract.functions.delegatedExecute(agent_id, to_checksum_address(target), value_wei, data, deadline, sig)
        return self._transact(func, private_key)
