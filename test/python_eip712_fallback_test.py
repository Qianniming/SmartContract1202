import pytest
from eth_utils import to_checksum_address
from eth_keys import keys
from sdk.python import aiep


def gen_privkey_hex():
    return '0x' + ('1' * 64)


def addr_from_priv(pk_hex: str):
    pk = keys.PrivateKey(bytes.fromhex(pk_hex[2:] if pk_hex.startswith('0x') else pk_hex))
    return pk.public_key.to_checksum_address()


def test_pay_eth_digest_and_recovery_matches_signer():
    chain_id = 1
    verifying_contract = '0x' + '11' * 20
    pk = gen_privkey_hex()
    signer_addr = addr_from_priv(pk)
    msg = {
        'to': to_checksum_address('0x' + '22' * 20),
        'amount': 10,
        'nonce': 0,
        'deadline': 1234567890
    }
    digest = aiep._digest('PayEth', msg, chain_id, verifying_contract)
    sig = aiep._sign_digest(pk, digest)
    recovered = keys.Signature(sig).recover_public_key_from_msg_hash(digest).to_checksum_address()
    assert recovered == signer_addr


def test_pay_erc20_digest_and_recovery_matches_signer():
    chain_id = 1
    verifying_contract = '0x' + '11' * 20
    pk = gen_privkey_hex()
    signer_addr = addr_from_priv(pk)
    msg = {
        'token': to_checksum_address('0x' + '33' * 20),
        'to': to_checksum_address('0x' + '44' * 20),
        'amount': 123,
        'nonce': 0,
        'deadline': 1234567890
    }
    digest = aiep._digest('PayERC20', msg, chain_id, verifying_contract)
    sig = aiep._sign_digest(pk, digest)
    recovered = keys.Signature(sig).recover_public_key_from_msg_hash(digest).to_checksum_address()
    assert recovered == signer_addr


def test_execute_digest_and_recovery_matches_signer():
    chain_id = 1
    verifying_contract = '0x' + '11' * 20
    pk = gen_privkey_hex()
    signer_addr = addr_from_priv(pk)
    msg = {
        'target': to_checksum_address('0x' + '55' * 20),
        'value': 0,
        'dataHash': bytes.fromhex('0' * 64),
        'nonce': 0,
        'deadline': 1234567890
    }
    digest = aiep._digest('Execute', msg, chain_id, verifying_contract)
    sig = aiep._sign_digest(pk, digest)
    recovered = keys.Signature(sig).recover_public_key_from_msg_hash(digest).to_checksum_address()
    assert recovered == signer_addr


@pytest.mark.skipif(not aiep.HAS_ENCODE_STRUCTURED, reason="encode_structured_data not available")
def test_fallback_digest_matches_eth_account_structured():
    from eth_account import Account
    from eth_account.messages import encode_structured_data
    chain_id = 1
    verifying_contract = '0x' + '11' * 20
    pk = gen_privkey_hex()
    msg = {
        'to': to_checksum_address('0x' + '22' * 20),
        'amount': 10,
        'nonce': 0,
        'deadline': 1234567890
    }
    typed = {
        'types': aiep.TYPES,
        'primaryType': 'PayEth',
        'domain': aiep._domain(chain_id, verifying_contract),
        'message': msg
    }
    eth_msg = encode_structured_data(typed)
    fallback_digest = aiep._digest('PayEth', msg, chain_id, verifying_contract)
    signed1 = Account.sign_message(eth_msg, pk).signature
    signed2 = aiep._sign_digest(pk, fallback_digest)
    assert signed1 == signed2
