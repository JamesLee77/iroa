// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    IIROAV1MigrationBinding,
    IIROAVaultMigration,
    IROAMigrationTypes
} from "../migration/IROAMigrationTypes.sol";

contract CliffLinearVestingVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint64 public constant MONTH = 30 days;

    error ZeroAddress();
    error InvalidSchedule();
    error NothingToRelease();
    error UnauthorizedBeneficiary(address caller);
    error InvalidMigrationContract(address supplied, address expected);
    error MigrationBalanceMismatch(uint256 expected, uint256 actual);

    event TokensReleased(address indexed beneficiary, uint256 amount, uint256 totalReleased);
    event RemainingScheduleMigrated(bytes32 indexed sourceScheduleId, bytes32 indexed sourceBatchId, uint256 amount);

    IERC20 public immutable token;
    address public immutable beneficiary;
    uint256 public immutable total;
    uint64 public immutable start;
    uint16 public immutable cliffMonths;
    uint16 public immutable linearDurationMonths;
    uint256 public released;

    constructor(
        IERC20 token_,
        address beneficiary_,
        uint256 total_,
        uint64 start_,
        uint16 cliffMonths_,
        uint16 linearDurationMonths_
    ) {
        if (address(token_) == address(0) || beneficiary_ == address(0)) revert ZeroAddress();
        if (total_ == 0 || linearDurationMonths_ == 0) revert InvalidSchedule();

        token = token_;
        beneficiary = beneficiary_;
        total = total_;
        start = start_;
        cliffMonths = cliffMonths_;
        linearDurationMonths = linearDurationMonths_;
    }

    function vestedAt(uint64 timestamp) public view returns (uint256) {
        uint256 cliffEnd = uint256(start) + (uint256(cliffMonths) * MONTH);
        if (timestamp <= cliffEnd) return 0;

        uint256 completedMonths = (timestamp - cliffEnd) / MONTH;
        if (completedMonths >= linearDurationMonths) return total;
        return (total * completedMonths) / linearDurationMonths;
    }

    function releasable(address account) public view returns (uint256) {
        if (account != beneficiary) return 0;
        return vestedAt(uint64(block.timestamp)) - released;
    }

    function release() external nonReentrant {
        uint256 amount = releasable(beneficiary);
        if (amount == 0) revert NothingToRelease();

        released += amount;
        token.safeTransfer(beneficiary, amount);
        emit TokensReleased(beneficiary, amount, released);
    }

    function migrateRemaining(
        address migration,
        address v2Vault,
        bytes32 sourceScheduleId,
        bytes32 sourceBatchId
    ) external nonReentrant {
        if (msg.sender != beneficiary) revert UnauthorizedBeneficiary(msg.sender);
        address expectedMigration = IIROAV1MigrationBinding(address(token)).migrationContract();
        if (migration != expectedMigration || migration == address(0)) {
            revert InvalidMigrationContract(migration, expectedMigration);
        }

        uint256 remaining = total - released;
        uint256 actualBalance = token.balanceOf(address(this));
        if (actualBalance != remaining) revert MigrationBalanceMismatch(remaining, actualBalance);

        uint256[] memory emptyTable = new uint256[](0);
        IROAMigrationTypes.ScheduleSnapshot memory snapshot = IROAMigrationTypes.ScheduleSnapshot({
            kind: IROAMigrationTypes.ScheduleKind.CliffLinear,
            beneficiary: beneficiary,
            total: total,
            released: released,
            start: start,
            cliffMonths: cliffMonths,
            linearDurationMonths: linearDurationMonths,
            cumulativeReleaseTable: emptyTable,
            sourceScheduleId: sourceScheduleId
        });
        IROAMigrationTypes.VaultMigrationBatch memory batch = IROAMigrationTypes.VaultMigrationBatch({
            v2Vault: v2Vault,
            amount: remaining,
            scheduleSnapshotHash: IROAMigrationTypes.hashSnapshot(snapshot),
            sourceBatchId: sourceBatchId,
            snapshot: snapshot
        });

        token.forceApprove(migration, remaining);
        IIROAVaultMigration(migration).migrateVault(batch);
        token.forceApprove(migration, 0);
        emit RemainingScheduleMigrated(sourceScheduleId, sourceBatchId, remaining);
    }
}
