// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

contract AetheriaAgentDID {
    struct AgentKey {
        bytes32 keyHash;
        uint256 expireAt;
        bool enabled;
    }

    struct AuthorizedKey {
        bytes32 keyHash;
        uint256 expireAt;
        uint256 permissions;
        bool enabled;
    }

    struct AgentInfo {
        address owner;
        address signer;
        string metadataURI;
        mapping(bytes32 => AgentKey) agentKeys;
        mapping(bytes32 => AuthorizedKey) authorizedKeys;
    }

    mapping(uint256 => AgentInfo) private agents;
    mapping(uint256 => bool) private frozen;
    uint256 private nextAgentId = 1;
    mapping(uint256 => uint256) private nonces;
    mapping(uint256 => uint256) private ethBalances;
    mapping(uint256 => mapping(address => uint256)) private erc20Balances;
    mapping(uint256 => mapping(string => string)) private serviceEndpoints;
    mapping(uint256 => string[]) private serviceKeys;
    uint256 private reentrancyLock;
    uint256 private constant MAX_SERVICE_KEYS = 50;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant CREATE_AUTHORIZED_KEY_TYPEHASH = keccak256("CreateAuthorizedKey(uint256 agentId,bytes32 keyHash,uint256 expireAt,uint256 permissions,uint256 nonce,uint256 deadline)");
    bytes32 private constant PAY_ETH_TYPEHASH = keccak256("PayEth(uint256 agentId,address to,uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 private constant PAY_ERC20_TYPEHASH = keccak256("PayERC20(uint256 agentId,address token,address to,uint256 amount,uint256 nonce,uint256 deadline)");
    bytes32 private constant EXECUTE_TYPEHASH = keccak256("Execute(uint256 agentId,address target,uint256 value,bytes32 dataHash,uint256 nonce,uint256 deadline)");
    bytes32 private constant NAME_HASH = keccak256(bytes("AetheriaAgentDID"));
    bytes32 private constant VERSION_HASH = keccak256(bytes("1"));
    uint256 private constant SECP256K1_N_DIV_2 = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string metadataURI);
    event AgentKeySet(uint256 indexed agentId, bytes32 indexed keyHash, uint256 expireAt, bool enabled);
    event AuthorizedKeyCreated(uint256 indexed agentId, bytes32 indexed keyHash, uint256 expireAt, uint256 permissions, bool enabled);
    event AuthorizedKeyRevoked(uint256 indexed agentId, bytes32 indexed keyHash);
    event MetadataUpdated(uint256 indexed agentId, string metadataURI);
    event AgentFrozen(uint256 indexed agentId);
    event AgentUnfrozen(uint256 indexed agentId);
    event AgentSignerSet(uint256 indexed agentId, address indexed signer);
    event DelegatedAuthorizedKeyCreated(uint256 indexed agentId, bytes32 indexed keyHash, uint256 expireAt, uint256 permissions);
    event AgentOwnershipTransferred(uint256 indexed agentId, address indexed previousOwner, address indexed newOwner);
    event AgentDeposited(uint256 indexed agentId, address indexed from, uint256 amount);
    event AgentPaid(uint256 indexed agentId, address indexed to, uint256 amount);
    event AgentDepositedERC20(uint256 indexed agentId, address indexed token, address indexed from, uint256 amount);
    event AgentPaidERC20(uint256 indexed agentId, address indexed token, address indexed to, uint256 amount);
    event ServiceEndpointSet(uint256 indexed agentId, string key, string value);
    event DelegatedExecuted(uint256 indexed agentId, address indexed target, uint256 value, bytes data);
    event AgentKeyDisabled(uint256 indexed agentId, bytes32 indexed keyHash);

    modifier onlyOwnerOf(uint256 agentId) {
        require(agents[agentId].owner == msg.sender, "not owner");
        _;
    }

    modifier notFrozen(uint256 agentId) {
        require(!frozen[agentId], "frozen");
        _;
    }

    modifier nonReentrant() {
        require(reentrancyLock == 0, "reentrant");
        reentrancyLock = 1;
        _;
        reentrancyLock = 0;
    }

    function registerAgent(string calldata metadataURI) external returns (uint256 agentId) {
        agentId = nextAgentId++;
        agents[agentId].owner = msg.sender;
        agents[agentId].metadataURI = metadataURI;
        emit AgentRegistered(agentId, msg.sender, metadataURI);
    }

    function ownerOf(uint256 agentId) external view returns (address) {
        return agents[agentId].owner;
    }

    function setAgentSigner(uint256 agentId, address signer) external onlyOwnerOf(agentId) notFrozen(agentId) {
        agents[agentId].signer = signer;
        emit AgentSignerSet(agentId, signer);
    }

    function transferAgentOwnership(uint256 agentId, address newOwner) external onlyOwnerOf(agentId) notFrozen(agentId) {
        require(newOwner != address(0), "zero addr");
        address prev = agents[agentId].owner;
        agents[agentId].owner = newOwner;
        emit AgentOwnershipTransferred(agentId, prev, newOwner);
    }

    function setAgentKey(uint256 agentId, bytes32 keyHash, uint256 expireAt) external onlyOwnerOf(agentId) notFrozen(agentId) {
        require(keyHash != bytes32(0), "bad key");
        AgentKey storage k = agents[agentId].agentKeys[keyHash];
        k.keyHash = keyHash;
        k.expireAt = expireAt;
        k.enabled = true;
        emit AgentKeySet(agentId, keyHash, expireAt, true);
    }

    function createAuthorizedKey(uint256 agentId, bytes32 keyHash, uint256 expireAt, uint256 permissions) external onlyOwnerOf(agentId) notFrozen(agentId) {
        require(keyHash != bytes32(0), "bad key");
        AuthorizedKey storage a = agents[agentId].authorizedKeys[keyHash];
        a.keyHash = keyHash;
        a.expireAt = expireAt;
        a.permissions = permissions;
        a.enabled = true;
        emit AuthorizedKeyCreated(agentId, keyHash, expireAt, permissions, true);
    }

    function delegatedCreateAuthorizedKey(
        uint256 agentId,
        bytes32 keyHash,
        uint256 expireAt,
        uint256 permissions,
        uint256 deadline,
        bytes calldata signature
    ) external notFrozen(agentId) nonReentrant {
        require(block.timestamp <= deadline, "expired");
        address signer = agents[agentId].signer;
        require(signer != address(0), "no signer");
        uint256 nonce = nonces[agentId];
        bytes32 structHash = keccak256(abi.encode(
            CREATE_AUTHORIZED_KEY_TYPEHASH,
            agentId,
            keyHash,
            expireAt,
            permissions,
            nonce,
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        address recovered = _recover(digest, signature);
        require(recovered == signer, "bad sig");
        nonces[agentId] = nonce + 1;
        AuthorizedKey storage a = agents[agentId].authorizedKeys[keyHash];
        a.keyHash = keyHash;
        a.expireAt = expireAt;
        a.permissions = permissions;
        a.enabled = true;
        emit DelegatedAuthorizedKeyCreated(agentId, keyHash, expireAt, permissions);
    }

    function revokeAuthorizedKey(uint256 agentId, bytes32 keyHash) external onlyOwnerOf(agentId) {
        AuthorizedKey storage a = agents[agentId].authorizedKeys[keyHash];
        a.enabled = false;
        a.expireAt = 0;
        a.permissions = 0;
        emit AuthorizedKeyRevoked(agentId, keyHash);
    }

    function verifyAgentKey(uint256 agentId, bytes32 keyHash) external view returns (bool) {
        if (agents[agentId].owner == address(0)) return false;
        if (frozen[agentId]) return false;
        AgentKey storage k = agents[agentId].agentKeys[keyHash];
        if (!k.enabled) return false;
        if (k.expireAt != 0 && block.timestamp > k.expireAt) return false;
        return k.keyHash == keyHash;
    }

    function verifyAuthorizedKey(uint256 agentId, bytes32 keyHash, uint256 requiredPermissions) external view returns (bool) {
        if (agents[agentId].owner == address(0)) return false;
        if (frozen[agentId]) return false;
        AuthorizedKey storage a = agents[agentId].authorizedKeys[keyHash];
        if (!a.enabled) return false;
        if (a.expireAt != 0 && block.timestamp > a.expireAt) return false;
        if ((a.permissions & requiredPermissions) != requiredPermissions) return false;
        return a.keyHash == keyHash;
    }

    function updateMetadata(uint256 agentId, string calldata metadataURI) external onlyOwnerOf(agentId) notFrozen(agentId) {
        agents[agentId].metadataURI = metadataURI;
        emit MetadataUpdated(agentId, metadataURI);
    }

    function freezeAgent(uint256 agentId) external onlyOwnerOf(agentId) {
        frozen[agentId] = true;
        emit AgentFrozen(agentId);
    }

    function unfreezeAgent(uint256 agentId) external onlyOwnerOf(agentId) {
        frozen[agentId] = false;
        emit AgentUnfrozen(agentId);
    }

    function getMetadata(uint256 agentId) external view returns (string memory) {
        return agents[agentId].metadataURI;
    }

    function getNonce(uint256 agentId) external view returns (uint256) {
        return nonces[agentId];
    }

    function balanceOf(uint256 agentId) external view returns (uint256) {
        return ethBalances[agentId];
    }

    function balanceOfERC20(uint256 agentId, address token) external view returns (uint256) {
        return erc20Balances[agentId][token];
    }

    function depositToAgent(uint256 agentId) external payable notFrozen(agentId) {
        require(agents[agentId].owner != address(0), "no agent");
        require(msg.value > 0, "no value");
        ethBalances[agentId] += msg.value;
        emit AgentDeposited(agentId, msg.sender, msg.value);
    }

    function depositERC20(uint256 agentId, address token, uint256 amount) external notFrozen(agentId) {
        require(agents[agentId].owner != address(0), "no agent");
        require(amount > 0, "no value");
        uint256 balBefore = IERC20(token).balanceOf(address(this));
        ERC20Safe.safeTransferFrom(token, msg.sender, address(this), amount);
        uint256 balAfter = IERC20(token).balanceOf(address(this));
        uint256 received = balAfter - balBefore;
        erc20Balances[agentId][token] += received;
        emit AgentDepositedERC20(agentId, token, msg.sender, received);
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
        uint256 agentId,
        address payable to,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external notFrozen(agentId) nonReentrant {
        require(block.timestamp <= deadline, "expired");
        address signer = agents[agentId].signer;
        require(signer != address(0), "no signer");
        uint256 nonce = nonces[agentId];
        bytes32 structHash = keccak256(abi.encode(
            PAY_ETH_TYPEHASH,
            agentId,
            to,
            amount,
            nonce,
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        address recovered = _recover(digest, signature);
        require(recovered == signer, "bad sig");
        require(ethBalances[agentId] >= amount, "insufficient");
        nonces[agentId] = nonce + 1;
        ethBalances[agentId] -= amount;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "transfer failed");
        emit AgentPaid(agentId, to, amount);
    }

    function delegatedPayERC20(
        uint256 agentId,
        address token,
        address to,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external notFrozen(agentId) nonReentrant {
        require(block.timestamp <= deadline, "expired");
        address signer = agents[agentId].signer;
        require(signer != address(0), "no signer");
        uint256 nonce = nonces[agentId];
        bytes32 structHash = keccak256(abi.encode(
            PAY_ERC20_TYPEHASH,
            agentId,
            token,
            to,
            amount,
            nonce,
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        address recovered = _recover(digest, signature);
        require(recovered == signer, "bad sig");
        require(erc20Balances[agentId][token] >= amount, "insufficient");
        nonces[agentId] = nonce + 1;
        erc20Balances[agentId][token] -= amount;
        ERC20Safe.safeTransfer(token, to, amount);
        emit AgentPaidERC20(agentId, token, to, amount);
    }

    function setServiceEndpoint(uint256 agentId, string calldata key, string calldata value) external onlyOwnerOf(agentId) notFrozen(agentId) {
        serviceEndpoints[agentId][key] = value;
        bool exists = false;
        for (uint256 i = 0; i < serviceKeys[agentId].length; i++) {
            if (keccak256(bytes(serviceKeys[agentId][i])) == keccak256(bytes(key))) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            require(serviceKeys[agentId].length < MAX_SERVICE_KEYS, "service keys limit");
            serviceKeys[agentId].push(key);
        }
        emit ServiceEndpointSet(agentId, key, value);
    }

    function getServiceEndpoint(uint256 agentId, string calldata key) external view returns (string memory) {
        return serviceEndpoints[agentId][key];
    }

    function getServiceKeys(uint256 agentId) external view returns (string[] memory) {
        return serviceKeys[agentId];
    }

    function didOf(uint256 agentId) external view returns (string memory) {
        require(agents[agentId].owner != address(0), "no agent");
        string memory chainIdStr = _uint2str(block.chainid);
        string memory contractAddr = _addressToString(address(this));
        string memory agentIdStr = _uint2str(agentId);
        return string(abi.encodePacked("did:ethr:", chainIdStr, ":", contractAddr, ":", agentIdStr));
    }

    function delegatedExecute(
        uint256 agentId,
        address target,
        uint256 value,
        bytes calldata data,
        uint256 deadline,
        bytes calldata signature
    ) external notFrozen(agentId) nonReentrant {
        require(block.timestamp <= deadline, "expired");
        address signer = agents[agentId].signer;
        require(signer != address(0), "no signer");
        require(target != address(this), "self-call blocked");
        uint256 nonce = nonces[agentId];
        bytes32 dataHash = keccak256(data);
        bytes32 structHash = keccak256(abi.encode(
            EXECUTE_TYPEHASH,
            agentId,
            target,
            value,
            dataHash,
            nonce,
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        address recovered = _recover(digest, signature);
        require(recovered == signer, "bad sig");
        if (value > 0) {
            require(ethBalances[agentId] >= value, "insufficient");
            ethBalances[agentId] -= value;
        }
        nonces[agentId] = nonce + 1;
        (bool ok, ) = target.call{value: value}(data);
        require(ok, "exec failed");
        emit DelegatedExecuted(agentId, target, value, data);
    }

    function disableAgentKey(uint256 agentId, bytes32 keyHash) external onlyOwnerOf(agentId) notFrozen(agentId) {
        AgentKey storage k = agents[agentId].agentKeys[keyHash];
        k.enabled = false;
        k.expireAt = 0;
        emit AgentKeyDisabled(agentId, keyHash);
    }

    function removeServiceEndpoint(uint256 agentId, string calldata key) external onlyOwnerOf(agentId) notFrozen(agentId) {
        serviceEndpoints[agentId][key] = "";
        for (uint256 i = 0; i < serviceKeys[agentId].length; i++) {
            if (keccak256(bytes(serviceKeys[agentId][i])) == keccak256(bytes(key))) {
                serviceKeys[agentId][i] = serviceKeys[agentId][serviceKeys[agentId].length - 1];
                serviceKeys[agentId].pop();
                break;
            }
        }
        emit ServiceEndpointSet(agentId, key, "");
    }

    receive() external payable {
        revert("direct eth not allowed");
    }

    fallback() external payable {
        revert("fallback disabled");
    }

    function isFrozen(uint256 agentId) external view returns (bool) {
        return frozen[agentId];
    }

    function getAuthorizedKey(uint256 agentId, bytes32 keyHash) external view returns (uint256 expireAt, uint256 permissions, bool enabled) {
        AuthorizedKey storage a = agents[agentId].authorizedKeys[keyHash];
        return (a.expireAt, a.permissions, a.enabled);
    }

    function getAgentSigner(uint256 agentId) external view returns (address) {
        return agents[agentId].signer;
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

// Internal safe ERC20 helpers to support tokens that return no boolean
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


