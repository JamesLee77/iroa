// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract IROAReceiptRootRegistry is AccessControl {
    bytes32 public constant ROOT_PROPOSER_ROLE = keccak256("ROOT_PROPOSER_ROLE");
    bytes32 public constant CHALLENGER_ROLE = keccak256("CHALLENGER_ROLE");

    uint256 public constant BASE_MAINNET_CHAIN_ID = 8453;
    uint256 public constant BASE_SEPOLIA_CHAIN_ID = 84532;
    uint64 public constant BASE_CHALLENGE_WINDOW = 7 days;
    uint64 public constant BASE_SEPOLIA_CHALLENGE_WINDOW = 24 hours;
    uint64 public constant LOCAL_CHALLENGE_WINDOW = 60 seconds;

    enum RootStatus {
        None,
        Proposed,
        Challenged,
        Finalized,
        Cancelled
    }

    struct RootRecord {
        bytes32 rewardRoot;
        bytes32 receiptBatchRoot;
        bytes32 policyVersion;
        bytes32 challengeEvidenceHash;
        uint64 proposedAt;
        uint32 revision;
        RootStatus status;
    }

    error ZeroAddress();
    error ZeroRoot();
    error UnsupportedChain(uint256 chainId);
    error RootAlreadyPending(uint256 epoch, RootStatus status);
    error InvalidRootStatus(uint256 epoch, RootStatus actual);
    error ChallengeWindowClosed(uint256 epoch, uint256 deadline);
    error ChallengeWindowOpen(uint256 epoch, uint256 deadline);

    event RootProposed(
        uint256 indexed epoch,
        uint32 indexed revision,
        bytes32 indexed rewardRoot,
        bytes32 receiptBatchRoot,
        bytes32 policyVersion,
        uint64 challengeDeadline
    );
    event RootChallenged(uint256 indexed epoch, uint32 indexed revision, bytes32 indexed evidenceHash);
    event RootFinalized(uint256 indexed epoch, uint32 indexed revision, bytes32 indexed rewardRoot);
    event ChallengedRootCancelled(uint256 indexed epoch, uint32 indexed revision);

    uint64 public immutable challengeWindow;
    mapping(uint256 epoch => RootRecord record) private _roots;

    constructor(address admin, address rootProposer, address challenger) {
        if (admin == address(0) || rootProposer == address(0) || challenger == address(0)) {
            revert ZeroAddress();
        }
        challengeWindow = _challengeWindowForChain(block.chainid);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ROOT_PROPOSER_ROLE, rootProposer);
        _grantRole(CHALLENGER_ROLE, challenger);
    }

    function proposeRoot(
        uint256 epoch,
        bytes32 rewardRoot,
        bytes32 receiptBatchRoot,
        bytes32 policyVersion
    ) external onlyRole(ROOT_PROPOSER_ROLE) {
        if (rewardRoot == bytes32(0) || receiptBatchRoot == bytes32(0) || policyVersion == bytes32(0)) {
            revert ZeroRoot();
        }

        RootRecord storage current = _roots[epoch];
        if (current.status != RootStatus.None && current.status != RootStatus.Cancelled) {
            revert RootAlreadyPending(epoch, current.status);
        }

        uint32 revision = current.revision + 1;
        uint64 proposedAt = uint64(block.timestamp);
        _roots[epoch] = RootRecord({
            rewardRoot: rewardRoot,
            receiptBatchRoot: receiptBatchRoot,
            policyVersion: policyVersion,
            challengeEvidenceHash: bytes32(0),
            proposedAt: proposedAt,
            revision: revision,
            status: RootStatus.Proposed
        });

        emit RootProposed(
            epoch,
            revision,
            rewardRoot,
            receiptBatchRoot,
            policyVersion,
            proposedAt + challengeWindow
        );
    }

    function challengeRoot(uint256 epoch, bytes32 evidenceHash) external onlyRole(CHALLENGER_ROLE) {
        if (evidenceHash == bytes32(0)) revert ZeroRoot();
        RootRecord storage root = _roots[epoch];
        if (root.status != RootStatus.Proposed) revert InvalidRootStatus(epoch, root.status);

        uint256 deadline = uint256(root.proposedAt) + challengeWindow;
        if (block.timestamp >= deadline) revert ChallengeWindowClosed(epoch, deadline);

        root.challengeEvidenceHash = evidenceHash;
        root.status = RootStatus.Challenged;
        emit RootChallenged(epoch, root.revision, evidenceHash);
    }

    function finalizeRoot(uint256 epoch) external {
        RootRecord storage root = _roots[epoch];
        if (root.status != RootStatus.Proposed) revert InvalidRootStatus(epoch, root.status);

        uint256 deadline = uint256(root.proposedAt) + challengeWindow;
        if (block.timestamp < deadline) revert ChallengeWindowOpen(epoch, deadline);

        root.status = RootStatus.Finalized;
        emit RootFinalized(epoch, root.revision, root.rewardRoot);
    }

    function cancelChallengedRoot(uint256 epoch) external onlyRole(DEFAULT_ADMIN_ROLE) {
        RootRecord storage root = _roots[epoch];
        if (root.status != RootStatus.Challenged) revert InvalidRootStatus(epoch, root.status);

        root.status = RootStatus.Cancelled;
        emit ChallengedRootCancelled(epoch, root.revision);
    }

    function getRoot(uint256 epoch) external view returns (RootRecord memory) {
        return _roots[epoch];
    }

    function finalizedRoot(uint256 epoch)
        external
        view
        returns (
            bytes32 rewardRoot,
            bytes32 receiptBatchRoot,
            bytes32 policyVersion,
            uint32 revision,
            bool finalized
        )
    {
        RootRecord storage root = _roots[epoch];
        return (
            root.rewardRoot,
            root.receiptBatchRoot,
            root.policyVersion,
            root.revision,
            root.status == RootStatus.Finalized
        );
    }

    function _challengeWindowForChain(uint256 chainId) private pure returns (uint64) {
        if (chainId == BASE_MAINNET_CHAIN_ID) return BASE_CHALLENGE_WINDOW;
        if (chainId == BASE_SEPOLIA_CHAIN_ID) return BASE_SEPOLIA_CHALLENGE_WINDOW;
        if (chainId == 31337 || chainId == 1337) return LOCAL_CHALLENGE_WINDOW;
        revert UnsupportedChain(chainId);
    }
}
