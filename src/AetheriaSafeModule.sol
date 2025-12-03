// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

interface ISafe {
    function execTransactionFromModule(address to, uint256 value, bytes calldata data, uint8 operation) external returns (bool success);
}

contract AetheriaSafeModule {
    address public safe;
    address public signer;
    bool public frozen;
    uint256 public nonce;
    uint256 private reentrancyLock;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant PAY_ETH_TYPEHASH = keccak256("PayEth(address to,uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 private constant PAY_ERC20_TYPEHASH = keccak256("PayERC20(address token,address to,uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 private constant EXECUTE_TYPEHASH = keccak256("Execute(address target,uint256 value,bytes32 dataHash,uint256 nonce,uint256 deadline)");
    bytes32 private constant NAME_HASH = keccak256(bytes("AetheriaAgentDID"));
    bytes32 private constant VERSION_HASH = keccak256(bytes("1"));
    uint256 private constant SECP256K1_N_DIV_2 = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    event ModuleInitialized(address indexed safe, address indexed signer);
    event ModuleFrozen();
    event ModuleUnfrozen();
    event ModuleSignerSet(address indexed signer);
    event DelegatedPaidEth(address indexed to, uint256 amount);
    event DelegatedPaidERC20(address indexed token, address indexed to, uint256 amount);
    event DelegatedExecuted(address indexed target, uint256 value, bytes data);

    modifier notFrozen() {
        require(!frozen, "frozen");
        _;
    }
    modifier nonReentrant() {
        require(reentrancyLock == 0, "reentrant");
        reentrancyLock = 1;
        _;
        reentrancyLock = 0;
    }

    constructor(address _safe, address _signer) {
        require(_safe != address(0), "safe zero");
        safe = _safe;
        if (_signer != address(0)) {
            signer = _signer;
            emit ModuleSignerSet(_signer);
        }
        emit ModuleInitialized(_safe, _signer);
    }

    function setSigner(address _signer) external {
        require(msg.sender == safe, "only safe");
        signer = _signer;
        emit ModuleSignerSet(_signer);
    }

    function freeze() external {
        require(msg.sender == safe, "only safe");
        frozen = true;
        emit ModuleFrozen();
    }
    function unfreeze() external {
        require(msg.sender == safe, "only safe");
        frozen = false;
        emit ModuleUnfrozen();
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            NAME_HASH,
            VERSION_HASH,
            block.chainid,
            address(this)
        ));
    }
    function _recover(bytes32 digest, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "sig len");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        require(v == 27 || v == 28, "v");
        require(uint256(s) <= SECP256K1_N_DIV_2, "s");
        return ecrecover(digest, v, r, s);
    }

    function delegatedPayEth(address payable to, uint256 amount, uint256 deadline, bytes calldata signature) external notFrozen nonReentrant {
        require(block.timestamp <= deadline, "expired");
        address s = signer;
        require(s != address(0), "no signer");
        uint256 n = nonce;
        bytes32 structHash = keccak256(abi.encode(PAY_ETH_TYPEHASH, to, amount, n, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        require(_recover(digest, signature) == s, "bad sig");
        nonce = n + 1;
        bool ok = ISafe(safe).execTransactionFromModule(to, amount, "", 0);
        require(ok, "safe exec");
        emit DelegatedPaidEth(to, amount);
    }

    function delegatedPayERC20(address token, address to, uint256 amount, uint256 deadline, bytes calldata signature) external notFrozen nonReentrant {
        require(block.timestamp <= deadline, "expired");
        address s = signer;
        require(s != address(0), "no signer");
        uint256 n = nonce;
        bytes32 structHash = keccak256(abi.encode(PAY_ERC20_TYPEHASH, token, to, amount, n, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        require(_recover(digest, signature) == s, "bad sig");
        nonce = n + 1;
        bytes memory data = abi.encodeWithSelector(IERC20(token).transfer.selector, to, amount);
        bool ok = ISafe(safe).execTransactionFromModule(token, 0, data, 0);
        require(ok, "safe exec");
        emit DelegatedPaidERC20(token, to, amount);
    }

    function delegatedExecute(address target, uint256 value, bytes calldata data, uint256 deadline, bytes calldata signature) external notFrozen nonReentrant {
        require(block.timestamp <= deadline, "expired");
        address s = signer;
        require(s != address(0), "no signer");
        require(target != address(this), "self-call");
        uint256 n = nonce;
        bytes32 dataHash = keccak256(data);
        bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, target, value, dataHash, n, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        require(_recover(digest, signature) == s, "bad sig");
        nonce = n + 1;
        bool ok = ISafe(safe).execTransactionFromModule(target, value, data, 0);
        require(ok, "safe exec");
        emit DelegatedExecuted(target, value, data);
    }
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

