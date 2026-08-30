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
    function finalizedRoot(uint64 epoch)
        external
        view
        returns (
            bytes32 rewardRoot,
            bytes32 receiptBatchRoot,
            bytes32 policyVersionHash,
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

    struct RewardClaimInput {
        uint64 epoch;
        bytes32 operatorIdHash;
        bytes32 nodeId;
        uint256 score;
        uint256 amount;
        bytes32 receiptBatchRoot;
        string policyVersion;
        bytes32 claimNonce;
    }

    struct FinalizedSettlement {
        bytes32 rewardRoot;
        bytes32 receiptBatchRoot;
        bytes32 policyVersionHash;
        uint32 revision;
        bool finalized;
    }

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
        uint64 indexed epoch,
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
    mapping(uint64 epoch => mapping(bytes32 operatorIdHash => uint256 amount)) public operatorClaimed;

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
        uint64 epoch,
        bytes32 operatorIdHash_,
        bytes32 nodeId,
        uint256 score,
        uint256 amount,
        bytes32 receiptBatchRoot,
        string calldata policyVersion,
        bytes32 claimNonce,
        bytes32[] calldata proof
    ) external nonReentrant {
        RewardClaimInput memory input = RewardClaimInput({
            epoch: epoch,
            operatorIdHash: operatorIdHash_,
            nodeId: nodeId,
            score: score,
            amount: amount,
            receiptBatchRoot: receiptBatchRoot,
            policyVersion: policyVersion,
            claimNonce: claimNonce
        });
        _claim(input, proof);
    }

    function _claim(RewardClaimInput memory input, bytes32[] calldata proof) private {
        if (input.score == 0 || input.amount == 0) revert InvalidReward();

        FinalizedSettlement memory settlement;
        (
            settlement.rewardRoot,
            settlement.receiptBatchRoot,
            settlement.policyVersionHash,
            settlement.revision,
            settlement.finalized
        ) = rootRegistry.finalizedRoot(input.epoch);
        if (!settlement.finalized) revert RootNotFinalized(input.epoch);
        if (
            input.receiptBatchRoot != settlement.receiptBatchRoot
                || keccak256(bytes(input.policyVersion)) != settlement.policyVersionHash
        ) {
            revert SettlementContextMismatch();
        }

        _validateNode(input);

        bytes32 leafHash = _rewardLeafHash(input);
        if (claimed[leafHash]) revert RewardAlreadyClaimed(leafHash);
        if (!MerkleProof.verifyCalldata(proof, settlement.rewardRoot, leafHash)) revert InvalidRewardProof();

        uint256 maximum =
            (nodeEmissionVault.monthlyBudget(input.epoch) * MAX_OPERATOR_REWARD_BPS) / BASIS_POINTS;
        uint256 requestedTotal = operatorClaimed[input.epoch][input.operatorIdHash] + input.amount;
        if (requestedTotal > maximum) revert OperatorRewardCapExceeded(requestedTotal, maximum);

        claimed[leafHash] = true;
        operatorClaimed[input.epoch][input.operatorIdHash] = requestedTotal;
        nodeEmissionVault.releaseReward(input.epoch, msg.sender, input.amount);

        emit RewardClaimed(
            input.epoch,
            input.operatorIdHash,
            input.nodeId,
            msg.sender,
            input.score,
            input.amount,
            leafHash,
            settlement.revision
        );
    }

    function rewardLeafHash(
        uint64 epoch,
        bytes32 operatorIdHash_,
        bytes32 nodeId,
        uint256 score,
        uint256 amount,
        bytes32 receiptBatchRoot,
        string memory policyVersion,
        bytes32 claimNonce
    ) public pure returns (bytes32) {
        return _rewardLeafHash(
            RewardClaimInput({
                epoch: epoch,
                operatorIdHash: operatorIdHash_,
                nodeId: nodeId,
                score: score,
                amount: amount,
                receiptBatchRoot: receiptBatchRoot,
                policyVersion: policyVersion,
                claimNonce: claimNonce
            })
        );
    }

    function _validateNode(RewardClaimInput memory input) private view {
        uint8 status = nodeRegistry.nodeStatus(input.nodeId);
        if (status != ACTIVE_NODE_STATUS) revert InactiveNode(input.nodeId, status);

        address expectedWallet = nodeRegistry.operatorWallet(input.nodeId);
        if (msg.sender != expectedWallet) revert OperatorWalletMismatch(msg.sender, expectedWallet);

        bytes32 expectedOperatorIdHash = nodeRegistry.operatorIdHash(input.nodeId);
        if (input.operatorIdHash != expectedOperatorIdHash) {
            revert OperatorIdMismatch(input.operatorIdHash, expectedOperatorIdHash);
        }
        if (!token.isAllowed(msg.sender)) revert OperatorWalletNotAllowed(msg.sender);
    }

    function _rewardLeafHash(RewardClaimInput memory input) private pure returns (bytes32) {
        return keccak256(
            bytes.concat(
                keccak256(
                    abi.encode(
                        input.epoch,
                        input.operatorIdHash,
                        input.nodeId,
                        input.score,
                        input.amount,
                        input.receiptBatchRoot,
                        input.policyVersion,
                        input.claimNonce
                    )
                )
            )
        );
    }
}
