// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import "src/AetheriaAgentDID.sol";

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function addr(uint256) external returns (address);
}

address constant VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));

contract AetheriaAgentDIDTest {
    Vm constant vm = Vm(VM_ADDRESS);
    AetheriaAgentDID did;

    function setUp() public {
        did = new AetheriaAgentDID("", address(0));
    }

    function testRegisterAndOwner() public {
        uint256 id = did.registerAgent("ipfs://meta1", address(0));
        _assertEqAddress(did.ownerOf(id), address(this));
        _assertEqString(did.getMetadata(id), "ipfs://meta1");
    }

    function testRegisterWithSigner() public {
        address s = address(0x123);
        uint256 id = did.registerAgent("ipfs://meta2", s);
        _assertEqAddress(did.getAgentSigner(id), s);
    }

    function testSetAgentKeyAndVerify() public {
        uint256 id = did.registerAgent("m", address(0));
        bytes32 key = keccak256("agent-key");
        did.setAgentKey(id, key, 0);
        _assertTrue(did.verifyAgentKey(id, key));
    }

    function testAgentKeyExpire() public {
        uint256 id = did.registerAgent("m", address(0));
        bytes32 key = keccak256("agent-key");
        did.setAgentKey(id, key, block.timestamp + 10);
        _assertTrue(did.verifyAgentKey(id, key));
        vm.warp(block.timestamp + 11);
        _assertFalse(did.verifyAgentKey(id, key));
    }

    function testAuthorizedKeyCreateVerifyRevoke() public {
        uint256 id = did.registerAgent("m", address(0));
        bytes32 k = keccak256("auth-key");
        uint256 perms = 0b1011; // example bits
        did.createAuthorizedKey(id, k, 0, perms);
        _assertTrue(did.verifyAuthorizedKey(id, k, 0b0011));
        _assertFalse(did.verifyAuthorizedKey(id, k, 0b10000));
        did.revokeAuthorizedKey(id, k);
        _assertFalse(did.verifyAuthorizedKey(id, k, 0b0001));
    }

    function testAuthorizedKeyExpireBoundary() public {
        uint256 id = did.registerAgent("m", address(0));
        bytes32 k = keccak256("auth-key");
        did.createAuthorizedKey(id, k, block.timestamp + 5, 0b111);
        _assertTrue(did.verifyAuthorizedKey(id, k, 0b001));
        vm.warp(block.timestamp + 6);
        _assertFalse(did.verifyAuthorizedKey(id, k, 0b001));
    }

    function testFreezeUnfreeze() public {
        uint256 id = did.registerAgent("m", address(0));
        bytes32 k = keccak256("auth-key");
        did.createAuthorizedKey(id, k, 0, 0b11);
        did.freezeAgent(id);
        _assertFalse(did.verifyAuthorizedKey(id, k, 0b01));
        did.unfreezeAgent(id);
        _assertTrue(did.verifyAuthorizedKey(id, k, 0b01));
    }

    function testOwnershipTransfer() public {
        uint256 id = did.registerAgent("m", address(0));
        address newOwner = address(0xBEEF);
        did.transferAgentOwnership(id, newOwner);
        _assertEqAddress(did.ownerOf(id), newOwner);
        vm.prank(newOwner);
        did.updateMetadata(id, "ipfs://new");
        _assertEqString(did.getMetadata(id), "ipfs://new");
    }

    function testDelegatedCreateAuthorizedKey() public {
        uint256 id = did.registerAgent("m", address(0));
        uint256 signerPk = 0xA11CE;
        address signer = vm.addr(signerPk);
        did.setAgentSigner(id, signer);

        bytes32 CREATE_AUTHORIZED_KEY_TYPEHASH = keccak256("CreateAuthorizedKey(uint256 agentId,bytes32 keyHash,uint256 expireAt,uint256 permissions,uint256 nonce,uint256 deadline)");
        bytes32 EIP712_DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
        bytes32 NAME_HASH = keccak256(bytes("AetheriaAgentDID"));
        bytes32 VERSION_HASH = keccak256(bytes("1"));
        bytes32 domainSeparator = keccak256(abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            NAME_HASH,
            VERSION_HASH,
            block.chainid,
            address(did)
        ));

        bytes32 key = keccak256("delegated-key");
        uint256 expireAt = block.timestamp + 1000;
        uint256 permissions = 0b10101;
        uint256 nonce = did.getNonce(id);
        uint256 deadline = block.timestamp + 1000;

        bytes32 structHash = keccak256(abi.encode(
            CREATE_AUTHORIZED_KEY_TYPEHASH,
            id,
            key,
            expireAt,
            permissions,
            nonce,
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        did.delegatedCreateAuthorizedKey(id, key, expireAt, permissions, deadline, sig);
        _assertTrue(did.verifyAuthorizedKey(id, key, 0b00101));

        // nonce should increase
        _assertEqUint(did.getNonce(id), nonce + 1);
    }

    function _assertTrue(bool v) internal pure {
        require(v, "assertTrue failed");
    }

    function _assertFalse(bool v) internal pure {
        require(!v, "assertFalse failed");
    }

    function _assertEqUint(uint256 a, uint256 b) internal pure {
        require(a == b, "assertEqUint failed");
    }

    function _assertEqAddress(address a, address b) internal pure {
        require(a == b, "assertEqAddress failed");
    }

    function _assertEqString(string memory a, string memory b) internal pure {
        require(keccak256(bytes(a)) == keccak256(bytes(b)), "assertEqString failed");
    }
}

