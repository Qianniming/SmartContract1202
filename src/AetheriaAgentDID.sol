// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

contract AetheriaAgentDID {
    

    address private owner;
    address private signer;
    string private metadataURI;

    

    bool private frozen;
    uint256 private nonce;
    uint256 private ethBalance;
    mapping(address => uint256) private erc20Balances;
    uint256 private reentrancyLock;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant PAY_ETH_TYPEHASH = keccak256("PayEth(address to,uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 private constant PAY_ERC20_TYPEHASH = keccak256("PayERC20(address token,address to,uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 private constant EXECUTE_TYPEHASH = keccak256("Execute(address target,uint256 value,bytes32 dataHash,uint256 nonce,uint256 deadline)");
    bytes32 private constant NAME_HASH = keccak256(bytes("AetheriaAgentDID"));
    bytes32 private constant VERSION_HASH = keccak256(bytes("1"));
    uint256 private constant SECP256K1_N_DIV_2 = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    event AgentInitialized(address indexed owner, string metadataURI);
    event MetadataUpdated(string metadataURI);
    event AgentFrozen();
    event AgentUnfrozen();
    event AgentSignerSet(address indexed signer);
    event AgentOwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AgentDeposited(address indexed from, uint256 amount);
    event AgentPaid(address indexed to, uint256 amount);
    event AgentDepositedERC20(address indexed token, address indexed from, uint256 amount);
    event AgentPaidERC20(address indexed token, address indexed to, uint256 amount);
    event DelegatedExecuted(address indexed target, uint256 value, bytes data);

    modifier onlyOwner() {
        require(owner == msg.sender, "not owner");
        _;
    }

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

    constructor(address _owner, address _signer, string memory _metadataURI) {
        require(_owner != address(0), "owner cannot be zero");
        owner = _owner;
        metadataURI = _metadataURI;
        ethBalance = address(this).balance;
        if (_signer != address(0)) {
            signer = _signer;
            emit AgentSignerSet(_signer);
        }
        emit AgentInitialized(_owner, _metadataURI);
    }

    function ownerOf() external view returns (address) {
        return owner;
    }

    function setAgentSigner(address _signer) external onlyOwner notFrozen {
        signer = _signer;
        emit AgentSignerSet(_signer);
    }

    function transferAgentOwnership(address newOwner) external onlyOwner notFrozen {
        require(newOwner != address(0), "zero addr");
        address prev = owner;
        owner = newOwner;
        emit AgentOwnershipTransferred(prev, newOwner);
    }


    function updateMetadata(string calldata _metadataURI) external onlyOwner notFrozen {
        metadataURI = _metadataURI;
        emit MetadataUpdated(_metadataURI);
    }

    function freezeAgent() external onlyOwner {
        frozen = true;
        emit AgentFrozen();
    }

    function unfreezeAgent() external onlyOwner {
        frozen = false;
        emit AgentUnfrozen();
    }

    function getMetadata() external view returns (string memory) {
        return metadataURI;
    }

    function getNonce() external view returns (uint256) {
        return nonce;
    }

    function balanceOf() external view returns (uint256) {
        return ethBalance;
    }

    function balanceOfERC20(address token) external view returns (uint256) {
        return erc20Balances[token];
    }

    function depositToAgent() external payable notFrozen {
        require(owner != address(0), "no agent");
        require(msg.value > 0, "no value");
        ethBalance += msg.value;
        emit AgentDeposited(msg.sender, msg.value);
    }

    function depositERC20(address token, uint256 amount) external notFrozen {
        require(owner != address(0), "no agent");
        require(amount > 0, "no value");
        uint256 balBefore = IERC20(token).balanceOf(address(this));
        ERC20Safe.safeTransferFrom(token, msg.sender, address(this), amount);
        uint256 balAfter = IERC20(token).balanceOf(address(this));
        uint256 received = balAfter - balBefore;
        erc20Balances[token] += received;
        emit AgentDepositedERC20(token, msg.sender, received);
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

    function delegatedPayEth(
        address payable to,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external notFrozen nonReentrant {
        require(block.timestamp <= deadline, "expired");
        address s = signer;
        require(s != address(0), "no signer");
        uint256 n = nonce;
        bytes32 structHash = keccak256(abi.encode(
            PAY_ETH_TYPEHASH,
            to,
            amount,
            n,
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        address recovered = _recover(digest, signature);
        require(recovered == s, "bad sig");
        require(ethBalance >= amount, "insufficient");
        nonce = n + 1;
        ethBalance -= amount;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "transfer failed");
        emit AgentPaid(to, amount);
    }

    function delegatedPayERC20(
        address token,
        address to,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external notFrozen nonReentrant {
        require(block.timestamp <= deadline, "expired");
        address s = signer;
        require(s != address(0), "no signer");
        uint256 n = nonce;
        uint256 actualBal = IERC20(token).balanceOf(address(this));
        if (actualBal > erc20Balances[token]) {
            erc20Balances[token] = actualBal;
        }
        bytes32 structHash = keccak256(abi.encode(
            PAY_ERC20_TYPEHASH,
            token,
            to,
            amount,
            n,
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        address recovered = _recover(digest, signature);
        require(recovered == s, "bad sig");
        require(erc20Balances[token] >= amount, "insufficient");
        nonce = n + 1;
        erc20Balances[token] -= amount;
        ERC20Safe.safeTransfer(token, to, amount);
        emit AgentPaidERC20(token, to, amount);
    }

    function did() external view returns (string memory) {
        require(owner != address(0), "no agent");
        string memory chainIdStr = _uint2str(block.chainid);
        string memory contractAddr = _addressToString(address(this));
        return string(abi.encodePacked("did:ethr:", chainIdStr, ":", contractAddr));
    }

    function delegatedExecute(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 deadline,
        bytes calldata signature
    ) external notFrozen nonReentrant {
        require(block.timestamp <= deadline, "expired");
        address s = signer;
        require(s != address(0), "no signer");
        require(target != address(this), "self-call blocked");
        uint256 n = nonce;
        bytes32 dataHash = keccak256(data);
        bytes32 structHash = keccak256(abi.encode(
            EXECUTE_TYPEHASH,
            target,
            value,
            dataHash,
            n,
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        address recovered = _recover(digest, signature);
        require(recovered == s, "bad sig");
        if (value > 0) {
            require(ethBalance >= value, "insufficient");
            ethBalance -= value;
        }
        nonce = n + 1;
        (bool ok, ) = target.call{value: value}(data);
        require(ok, "exec failed");
        emit DelegatedExecuted(target, value, data);
    }

    receive() external payable {
        revert("direct eth not allowed");
    }

    fallback() external payable {
        revert("fallback disabled");
    }

    function isFrozen() external view returns (bool) {
        return frozen;
    }


    function getAgentSigner() external view returns (address) {
        return signer;
    }

    function _uint2str(uint256 _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    function _addressToString(address _addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(_addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3+i*2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

library ERC20Safe {
    function safeTransfer(address token, address to, uint256 amount) internal {
        bytes memory data = abi.encodeWithSelector(IERC20(token).transfer.selector, to, amount);
        (bool success, bytes memory ret) = token.call(data);
        require(success, "erc20 transfer fail");
        if (ret.length > 0) {
            require(abi.decode(ret, (bool)), "erc20 transfer false");
        }
    }
    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        bytes memory data = abi.encodeWithSelector(IERC20(token).transferFrom.selector, from, to, amount);
        (bool success, bytes memory ret) = token.call(data);
        require(success, "erc20 transferFrom fail");
        if (ret.length > 0) {
            require(abi.decode(ret, (bool)), "erc20 transferFrom false");
        }
    }
}

