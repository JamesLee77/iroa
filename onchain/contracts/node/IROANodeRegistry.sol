// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract IROANodeRegistry is AccessControl, EIP712 {
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant SUSPENDER_ROLE = keccak256("SUSPENDER_ROLE");
    bytes32 public constant OPERATOR_WALLET_CHANGE_TYPEHASH = keccak256(
        "OperatorWalletChange(bytes32 nodeId,address newWallet,uint256 nonce,uint64 deadline)"
    );

    enum NodeStatus {
        Pending,
        Active,
        Suspended,
        Revoked
    }

    struct NodeRecord {
        address operatorWallet;
        bytes32 operatorIdHash;
        bytes32 deviceKeyHash;
        uint8 trustLevel;
        NodeStatus status;
        uint64 registeredAt;
    }

    error ZeroAddress();
    error ZeroIdentifier();
    error NodeAlreadyRegistered(bytes32 nodeId);
    error NodeNotRegistered(bytes32 nodeId);
    error DeviceKeyAlreadyRegistered(bytes32 deviceKeyHash, bytes32 nodeId);
    error InvalidTrustLevel(uint8 trustLevel);
    error InvalidNodeStatus(bytes32 nodeId, NodeStatus actual);
    error UnauthorizedNodeOperator(address caller);
    error OperatorAuthorizationExpired(uint64 deadline);
    error InvalidOperatorSignature(address recovered, address expected);

    event NodeRegistered(
        bytes32 indexed nodeId,
        address indexed operatorWallet,
        bytes32 indexed operatorIdHash,
        bytes32 deviceKeyHash,
        uint8 trustLevel
    );
    event NodeStatusChanged(bytes32 indexed nodeId, NodeStatus indexed previousStatus, NodeStatus indexed newStatus);
    event DeviceKeyRevoked(bytes32 indexed nodeId, bytes32 indexed deviceKeyHash);
    event NodeRejected(bytes32 indexed nodeId, bytes32 indexed deviceKeyHash);
    event OperatorWalletChanged(
        bytes32 indexed nodeId,
        address indexed previousWallet,
        address indexed newWallet,
        uint256 nonce
    );

    mapping(bytes32 nodeId => NodeRecord record) private _nodes;
    mapping(bytes32 nodeId => bool registered) private _registered;
    mapping(bytes32 deviceKeyHash => bytes32 nodeId) public deviceKeyNode;
    mapping(bytes32 nodeId => uint256 nonce) public operatorChangeNonce;

    constructor(address admin, address compliance, address suspender) EIP712("IROANodeRegistry", "1") {
        if (admin == address(0) || compliance == address(0) || suspender == address(0)) {
            revert ZeroAddress();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, compliance);
        _grantRole(SUSPENDER_ROLE, suspender);
    }

    function registerNode(
        bytes32 nodeId,
        bytes32 operatorIdHash_,
        bytes32 deviceKeyHash,
        uint8 trustLevel
    ) external {
        if (nodeId == bytes32(0) || operatorIdHash_ == bytes32(0) || deviceKeyHash == bytes32(0)) {
            revert ZeroIdentifier();
        }
        if (_registered[nodeId]) revert NodeAlreadyRegistered(nodeId);
        if (deviceKeyNode[deviceKeyHash] != bytes32(0)) {
            revert DeviceKeyAlreadyRegistered(deviceKeyHash, deviceKeyNode[deviceKeyHash]);
        }
        if (trustLevel > 3) revert InvalidTrustLevel(trustLevel);

        _registered[nodeId] = true;
        deviceKeyNode[deviceKeyHash] = nodeId;
        _nodes[nodeId] = NodeRecord({
            operatorWallet: msg.sender,
            operatorIdHash: operatorIdHash_,
            deviceKeyHash: deviceKeyHash,
            trustLevel: trustLevel,
            status: NodeStatus.Pending,
            registeredAt: uint64(block.timestamp)
        });

        emit NodeRegistered(nodeId, msg.sender, operatorIdHash_, deviceKeyHash, trustLevel);
    }

    function approveNode(bytes32 nodeId) external onlyRole(COMPLIANCE_ROLE) {
        NodeRecord storage node = _requireNode(nodeId);
        if (node.status != NodeStatus.Pending && node.status != NodeStatus.Suspended) {
            revert InvalidNodeStatus(nodeId, node.status);
        }
        _setStatus(nodeId, node, NodeStatus.Active);
    }

    /// @notice Closes a registration that was never approved and frees its device key.
    /// Registration is open, so anyone could register a real operator's device-key hash first
    /// and lock them out; rejection returns the key. A key that was ever live stays bound
    /// through `revokeDeviceKey` because it may have been compromised.
    function rejectNode(bytes32 nodeId) external onlyRole(COMPLIANCE_ROLE) {
        NodeRecord storage node = _requireNode(nodeId);
        if (node.status != NodeStatus.Pending) revert InvalidNodeStatus(nodeId, node.status);

        delete deviceKeyNode[node.deviceKeyHash];
        _setStatus(nodeId, node, NodeStatus.Revoked);
        emit NodeRejected(nodeId, node.deviceKeyHash);
    }

    function suspendNode(bytes32 nodeId) external onlyRole(SUSPENDER_ROLE) {
        NodeRecord storage node = _requireNode(nodeId);
        if (node.status != NodeStatus.Active) revert InvalidNodeStatus(nodeId, node.status);
        _setStatus(nodeId, node, NodeStatus.Suspended);
    }

    function revokeDeviceKey(bytes32 nodeId) external {
        NodeRecord storage node = _requireNode(nodeId);
        if (msg.sender != node.operatorWallet && !hasRole(COMPLIANCE_ROLE, msg.sender)) {
            revert UnauthorizedNodeOperator(msg.sender);
        }
        if (node.status == NodeStatus.Revoked) revert InvalidNodeStatus(nodeId, node.status);

        _setStatus(nodeId, node, NodeStatus.Revoked);
        emit DeviceKeyRevoked(nodeId, node.deviceKeyHash);
    }

    function changeOperatorWallet(
        bytes32 nodeId,
        address newWallet,
        uint64 deadline,
        bytes calldata operatorSignature
    ) external onlyRole(COMPLIANCE_ROLE) {
        if (newWallet == address(0)) revert ZeroAddress();
        if (block.timestamp > deadline) revert OperatorAuthorizationExpired(deadline);

        NodeRecord storage node = _requireNode(nodeId);
        if (node.status == NodeStatus.Revoked) revert InvalidNodeStatus(nodeId, node.status);

        uint256 nonce = operatorChangeNonce[nodeId];
        bytes32 structHash = keccak256(abi.encode(OPERATOR_WALLET_CHANGE_TYPEHASH, nodeId, newWallet, nonce, deadline));
        address recovered = ECDSA.recover(_hashTypedDataV4(structHash), operatorSignature);
        if (recovered != node.operatorWallet) {
            revert InvalidOperatorSignature(recovered, node.operatorWallet);
        }

        address previousWallet = node.operatorWallet;
        operatorChangeNonce[nodeId] = nonce + 1;
        node.operatorWallet = newWallet;
        emit OperatorWalletChanged(nodeId, previousWallet, newWallet, nonce);
    }

    function getNode(bytes32 nodeId) external view returns (NodeRecord memory) {
        if (!_registered[nodeId]) revert NodeNotRegistered(nodeId);
        return _nodes[nodeId];
    }

    function operatorWallet(bytes32 nodeId) external view returns (address) {
        return _requireNode(nodeId).operatorWallet;
    }

    function operatorIdHash(bytes32 nodeId) external view returns (bytes32) {
        return _requireNode(nodeId).operatorIdHash;
    }

    function nodeStatus(bytes32 nodeId) external view returns (NodeStatus) {
        return _requireNode(nodeId).status;
    }

    function _requireNode(bytes32 nodeId) private view returns (NodeRecord storage node) {
        if (!_registered[nodeId]) revert NodeNotRegistered(nodeId);
        node = _nodes[nodeId];
    }

    function _setStatus(bytes32 nodeId, NodeRecord storage node, NodeStatus newStatus) private {
        NodeStatus previousStatus = node.status;
        node.status = newStatus;
        emit NodeStatusChanged(nodeId, previousStatus, newStatus);
    }
}
