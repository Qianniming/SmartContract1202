// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import "./AetheriaAgentDID.sol";

contract AetheriaFactory {
    event AgentDeployed(address indexed agent, address indexed owner, address indexed signer);

    function deployAgent(
        address _owner,
        address _signer,
        string memory _metadataURI,
        bytes32 _salt
    ) external returns (address) {
        AetheriaAgentDID agent = new AetheriaAgentDID{salt: _salt}(_owner, _signer, _metadataURI);
        emit AgentDeployed(address(agent), _owner, _signer);
        return address(agent);
    }

    function computeAddress(
        address _owner,
        address _signer,
        string memory _metadataURI,
        bytes32 _salt
    ) external view returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(AetheriaAgentDID).creationCode,
            abi.encode(_owner, _signer, _metadataURI)
        );
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), _salt, keccak256(bytecode))
        );
        return address(uint160(uint256(hash)));
    }

    function deployAndDelegatedPayERC20(
        address _owner,
        address _signer,
        string memory _metadataURI,
        bytes32 _salt,
        address token,
        address to,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external returns (address) {
        AetheriaAgentDID agent = new AetheriaAgentDID{salt: _salt}(_owner, _signer, _metadataURI);
        emit AgentDeployed(address(agent), _owner, _signer);
        agent.delegatedPayERC20(token, to, amount, deadline, signature);
        return address(agent);
    }

    function deployAndDelegatedPayEth(
        address _owner,
        address _signer,
        string memory _metadataURI,
        bytes32 _salt,
        address payable to,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external returns (address) {
        AetheriaAgentDID agent = new AetheriaAgentDID{salt: _salt}(_owner, _signer, _metadataURI);
        emit AgentDeployed(address(agent), _owner, _signer);
        agent.delegatedPayEth(to, amount, deadline, signature);
        return address(agent);
    }

    function deployAndDelegatedExecute(
        address _owner,
        address _signer,
        string memory _metadataURI,
        bytes32 _salt,
        address target,
        uint256 value,
        bytes calldata data,
        uint256 deadline,
        bytes calldata signature
    ) external returns (address) {
        AetheriaAgentDID agent = new AetheriaAgentDID{salt: _salt}(_owner, _signer, _metadataURI);
        emit AgentDeployed(address(agent), _owner, _signer);
        agent.delegatedExecute(target, value, data, deadline, signature);
        return address(agent);
    }
}

