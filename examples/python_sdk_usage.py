from web3 import Web3
from eth_account import Account
from sdk.python.aiep import AIEP, RelayerClient, JitoRelayer

def main():
    w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))
    contract = os.environ.get("AIEP_CONTRACT")
    owner_pk = os.environ.get("OWNER_PK")
    signer_pk = os.environ.get("SIGNER_PK")
    other_addr = os.environ.get("OTHER_ADDR")
    relayer_url = os.environ.get("RELAYER_URL")
    assert contract and owner_pk and signer_pk and other_addr and relayer_url

    aiep = AIEP(w3, contract)
    signer_addr = Account.from_key(signer_pk).address
    aiep.set_agent_signer(signer_addr, owner_pk)

    aiep.deposit_to_agent(w3.to_wei(1, "ether"), owner_pk)
    dl = w3.eth.get_block("latest").timestamp + 3600
    s = aiep.sign_delegated_pay_eth(other_addr, w3.to_wei(0.1, "ether"), dl, signer_pk)
    rc = RelayerClient(relayer_url)
    rc.submit_delegated_pay_eth(contract, other_addr, int(w3.to_wei(0.1, "ether")), dl, s["signature"])

    jr = JitoRelayer(relayer_url)
    jr.submit_bundle(["BASE64_TX_1", "BASE64_TX_2"]) 

if __name__ == "__main__":
    import os
    main()
