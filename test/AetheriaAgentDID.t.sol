// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import "src/AetheriaAgentDID.sol";
import "src/MockTarget.sol";

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
    MockTarget target;

    function setUp() public {
        did = new AetheriaAgentDID(address(this), address(0), "ipfs://meta");
        target = new MockTarget();
    }

    function testOwnerAndMetadata() public {
        _assertEqAddress(did.ownerOf(), address(this));
        _assertEqString(did.getMetadata(), "ipfs://meta");
    }

    function testSetSignerAndDelegatedExecute() public {
        uint256 signerPk = 0xA11CE;
        address signer = vm.addr(signerPk);
        did.setAgentSigner(signer);
        _assertEqAddress(did.getAgentSigner(), signer);

        bytes memory data = abi.encodeWithSelector(MockTarget.setNumber.selector, 42);
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

        bytes32 EXECUTE_TYPEHASH = keccak256("Execute(address target,uint256 value,bytes32 dataHash,uint256 nonce,uint256 deadline)");
        uint256 nonce = did.getNonce();
        uint256 deadline = block.timestamp + 1000;
        bytes32 dataHash = keccak256(data);
        bytes32 structHash = keccak256(abi.encode(
            EXECUTE_TYPEHASH,
            address(target),
            uint256(0),
            dataHash,
            nonce,
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        did.delegatedExecute(address(target), 0, data, deadline, sig);
        _assertEqUint(target.getNumber(), 42);
        _assertEqUint(did.getNonce(), nonce + 1);
    }

    function testOwnershipTransferAndUpdateMetadata() public {
        address newOwner = address(0xBEEF);
        did.transferAgentOwnership(newOwner);
        _assertEqAddress(did.ownerOf(), newOwner);
        vm.prank(newOwner);
        did.updateMetadata("ipfs://new");
        _assertEqString(did.getMetadata(), "ipfs://new");
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

