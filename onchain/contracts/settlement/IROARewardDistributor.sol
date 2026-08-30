// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IIROANodeRegistry {
    function operatorWallet(bytes32 nodeId) external view returns (address);
    function operatorIdHash(bytes32 nodeId) external view returns (bytes32);
    function nodeStatus(bytes32 nodeId) external view returns (uint8);
}

interface IIROAReceiptRootRegistry {
    function finalizedRoot(uint256 epoch)
        external
        view
        returns (
            bytes32 rewardRoot,
            bytes32 receiptBatchRoot,
            bytes32 policyVersion,
            uint32 revision,
            bool finalized
        );
}

interface IIROATokenAllowlist {
    function isAllowed(address account) external view returns (bool);
}

interface INodeEmissionVault {
    function monthlyBudget(uint256 epoch) external view returns (uint256);
    function releaseReward(uint256 epoch, address recipient, uint256 amount) external;
}

contract IROARewardDistributor is ReentrancyGuard {
    uint256 public constant BASIS_POINTS = 10_000;
    uint256 public constant MAX_OPERATOR_REWARD_BPS = 500;
    uint8 public constant ACTIVE_NODE_STATUS = 1;

    error ZeroAddress();
    error InvalidReward();
    error RootNotFinalized(uint256 epoch);
    error SettlementContextMismatch();
    error InactiveNode(bytes32 nodeId, uint8 status);
    error OperatorWalletMismatch(address caller, address expected);
    error OperatorIdMismatch(bytes32 supplied, bytes32 expected);
    error OperatorWalletNotAllowed(address operatorWallet);
    error InvalidRewardProof();
    error RewardAlreadyClaimed(bytes32 leafHash);
    error OperatorRewardCapExceeded(uint256 requestedTotal, uint256 maximum);

    event RewardClaimed(
        uint256 indexed epoch,
        bytes32 indexed operatorIdHash,
        bytes32 indexed nodeId,
        address operatorWallet,
        uint256 score,
        uint256 amount,
        bytes32 leafHash,
        uint32 rootRevision
    );

    IIROANodeRegistry public immutable nodeRegistry;
    IIROAReceiptRootRegistry public immutable rootRegistry;
    IIROATokenAllowlist public immutable token;
    INodeEmissionVault public immutable nodeEmissionVault;

    mapping(bytes32 leafHash => bool claimed) public claimed;
    mapping(uint256 epoch => mapping(bytes32 operatorIdHash => uint256 amount)) public operatorClaimed;

    constructor(
        IIROANodeRegistry nodeRegistry_,
        IIROAReceiptRootRegistry rootRegistry_,
        IIROATokenAllowlist token_,
        INodeEmissionVault nodeEmissionVault_
    ) {
        if (
            address(nodeRegistry_) == address(0) || address(rootRegistry_) == address(0)
                || address(token_) == address(0) || address(nodeEmissionVault_) == address(0)
        ) revert ZeroAddress();

        nodeRegistry = nodeRegistry_;
        rootRegistry = rootRegistry_;
        token = token_;
        nodeEmissionVault = nodeEmissionVault_;
    }

    function claim(
        uint256 epoch,
        bytes32 operatorIdHash_,
        bytes32 nodeId,
        uint256 score,
        uint256 amount,
        bytes32 receiptBatchRoot,
        bytes32 policyVersion,
        uint256 claimNonce,
        bytes32[] calldata proof
    ) external nonReentrant {
        if (score == 0 || amount == 0) revert InvalidReward();

        (
            bytes32 rewardRoot,
            bytes32 finalizedReceiptBatchRoot,
            bytes32 finalizedPolicyVersion,
            uint32 revision,
            bool finalized
        ) = rootRegistry.finalizedRoot(epoch);
        if (!finalized) revert RootNotFinalized(epoch);
        if (receiptBatchRoot != finalizedReceiptBatchRoot || policyVersion != finalizedPolicyVersion) {
            revert SettlementContextMismatch();
        }

        uint8 status = nodeRegistry.nodeStatus(nodeId);
        if (status != ACTIVE_NODE_STATUS) revert InactiveNode(nodeId, status);

        address expectedWallet = nodeRegistry.operatorWallet(nodeId);
        if (msg.sender != expectedWallet) revert OperatorWalletMismatch(msg.sender, expectedWallet);

        bytes32 expectedOperatorIdHash = nodeRegistry.operatorIdHash(nodeId);
        if (operatorIdHash_ != expectedOperatorIdHash) {
            revert OperatorIdMismatch(operatorIdHash_, expectedOperatorIdHash);
        }
        if (!token.isAllowed(msg.sender)) revert OperatorWalletNotAllowed(msg.sender);

        bytes32 leafHash = rewardLeafHash(
            epoch,
            operatorIdHash_,
            nodeId,
            score,
            amount,
            receiptBatchRoot,
            policyVersion,
            claimNonce
        );
        if (claimed[leafHash]) revert RewardAlreadyClaimed(leafHash);
        if (!MerkleProof.verifyCalldata(proof, rewardRoot, leafHash)) revert InvalidRewardProof();

        uint256 maximum = (nodeEmissionVault.monthlyBudget(epoch) * MAX_OPERATOR_REWARD_BPS) / BASIS_POINTS;
        uint256 requestedTotal = operatorClaimed[epoch][operatorIdHash_] + amount;
        if (requestedTotal > maximum) revert OperatorRewardCapExceeded(requestedTotal, maximum);

        claimed[leafHash] = true;
        operatorClaimed[epoch][operatorIdHash_] = requestedTotal;
        nodeEmissionVault.releaseReward(epoch, msg.sender, amount);

        emit RewardClaimed(
            epoch,
            operatorIdHash_,
            nodeId,
            msg.sender,
            score,
            amount,
            leafHash,
            revision
        );
    }

    function rewardLeafHash(
        uint256 epoch,
        bytes32 operatorIdHash_,
        bytes32 nodeId,
        uint256 score,
        uint256 amount,
        bytes32 receiptBatchRoot,
        bytes32 policyVersion,
        uint256 claimNonce
    ) public pure returns (bytes32) {
        return keccak256(
            bytes.concat(
                keccak256(
                    abi.encode(
                        epoch,
                        operatorIdHash_,
                        nodeId,
                        score,
                        amount,
                        receiptBatchRoot,
                        policyVersion,
                        claimNonce
                    )
                )
            )
        );
    }
}
