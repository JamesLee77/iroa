// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    IIROAV1MigrationBinding,
    IIROAVaultMigration,
    IROAMigrationTypes
} from "../migration/IROAMigrationTypes.sol";

contract MonthlyEmissionVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint64 public constant MONTH = 30 days;
    bytes32 public constant RELEASE_MANAGER_ROLE = keccak256("RELEASE_MANAGER_ROLE");
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");

    error ZeroAddress();
    error InvalidAllocation();
    error InvalidWeights();
    error EmissionMonthInactive();
    error RewardEpochNotClosed(uint256 epoch);
    error InvalidEpoch(uint256 epoch);
    error RewardClaimsOnly();
    error NotRewardClaimsVault();
    error InvalidMigrationContract(address supplied, address expected);
    error MigrationBalanceMismatch(uint256 expected, uint256 actual);
    error MonthlyLimitExceeded(uint256 requested, uint256 available);

    event MonthlyEmissionReleased(
        uint256 indexed monthIndex,
        address indexed recipient,
        uint256 amount,
        uint256 monthReleased
    );
    event RemainingScheduleMigrated(bytes32 indexed sourceScheduleId, bytes32 indexed sourceBatchId, uint256 amount);

    IERC20 public immutable token;
    uint256 public immutable allocation;
    uint64 public immutable startTimestamp;
    uint256 public immutable scheduleMonths;
    bool public immutable rewardClaimsOnly;
    uint256 public totalReleased;

    uint16[] private _annualWeights;
    mapping(uint256 monthIndex => uint256 amount) public releasedByMonth;

    constructor(
        IERC20 token_,
        uint256 allocation_,
        uint64 startTimestamp_,
        uint16[] memory annualWeights_,
        bool rewardClaimsOnly_,
        address admin,
        address releaseManager
    ) {
        if (address(token_) == address(0) || admin == address(0)) {
            revert ZeroAddress();
        }
        if (!rewardClaimsOnly_ && releaseManager == address(0)) revert ZeroAddress();
        if (allocation_ == 0) revert InvalidAllocation();
        if (annualWeights_.length == 0 || annualWeights_.length > 12) revert InvalidWeights();

        uint256 weightSum;
        for (uint256 i = 0; i < annualWeights_.length; ++i) {
            if (annualWeights_[i] == 0) revert InvalidWeights();
            weightSum += annualWeights_[i];
            _annualWeights.push(annualWeights_[i]);
        }
        if (weightSum != 100) revert InvalidWeights();

        token = token_;
        allocation = allocation_;
        startTimestamp = startTimestamp_;
        scheduleMonths = annualWeights_.length * 12;
        rewardClaimsOnly = rewardClaimsOnly_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (releaseManager != address(0)) {
            _grantRole(RELEASE_MANAGER_ROLE, releaseManager);
        }
    }

    function annualWeights() external view returns (uint16[] memory) {
        return _annualWeights;
    }

    function monthlyBudget(uint256 monthIndex) public view returns (uint256) {
        if (monthIndex >= scheduleMonths) return 0;

        uint256 yearIndex = monthIndex / 12;
        // Deterministic calendar indexing, not randomness or winner selection.
        // slither-disable-next-line weak-prng
        uint256 monthInYear = monthIndex % 12;
        uint256 yearAllocation = _yearAllocation(yearIndex);
        uint256 baseMonthlyAmount = yearAllocation / 12;

        return monthInYear == 11
            ? yearAllocation - (baseMonthlyAmount * 11)
            : baseMonthlyAmount;
    }

    function releasableAt(uint64 timestamp) public view returns (uint256) {
        (bool active, uint256 monthIndex) = _monthAt(timestamp);
        if (!active) return 0;

        return monthlyBudget(monthIndex) - releasedByMonth[monthIndex];
    }

    function releaseForCurrentMonth(address recipient, uint256 amount)
        external
        onlyRole(RELEASE_MANAGER_ROLE)
        nonReentrant
    {
        if (rewardClaimsOnly) revert RewardClaimsOnly();
        if (recipient == address(0)) revert ZeroAddress();

        (bool active, uint256 monthIndex) = _monthAt(uint64(block.timestamp));
        if (!active) revert EmissionMonthInactive();

        uint256 available = monthlyBudget(monthIndex) - releasedByMonth[monthIndex];
        if (amount == 0 || amount > available) revert MonthlyLimitExceeded(amount, available);

        releasedByMonth[monthIndex] += amount;
        totalReleased += amount;
        token.safeTransfer(recipient, amount);

        emit MonthlyEmissionReleased(monthIndex, recipient, amount, releasedByMonth[monthIndex]);
    }

    function releaseReward(uint256 epoch, address recipient, uint256 amount)
        external
        onlyRole(REWARD_DISTRIBUTOR_ROLE)
        nonReentrant
    {
        if (!rewardClaimsOnly) revert NotRewardClaimsVault();
        if (recipient == address(0)) revert ZeroAddress();
        if (epoch >= scheduleMonths) revert InvalidEpoch(epoch);

        uint256 epochEnd = uint256(startTimestamp) + ((epoch + 1) * MONTH);
        if (block.timestamp < epochEnd) revert RewardEpochNotClosed(epoch);

        uint256 available = monthlyBudget(epoch) - releasedByMonth[epoch];
        if (amount == 0 || amount > available) revert MonthlyLimitExceeded(amount, available);

        releasedByMonth[epoch] += amount;
        totalReleased += amount;
        token.safeTransfer(recipient, amount);

        emit MonthlyEmissionReleased(epoch, recipient, amount, releasedByMonth[epoch]);
    }

    function migrateRemaining(
        address migration,
        address v2Vault,
        bytes32 sourceScheduleId,
        bytes32 sourceBatchId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        address expectedMigration = IIROAV1MigrationBinding(address(token)).migrationContract();
        if (migration != expectedMigration || migration == address(0)) {
            revert InvalidMigrationContract(migration, expectedMigration);
        }

        uint256 remaining = allocation - totalReleased;
        uint256 actualBalance = token.balanceOf(address(this));
        // Any allowlisted holder could send a stray wei here before migration mode, and
        // nothing can move it out afterwards; requiring an exact balance would let that
        // wei block the schedule forever. Only a shortfall is a fault.
        if (actualBalance < remaining) revert MigrationBalanceMismatch(remaining, actualBalance);

        uint256[] memory cumulativeReleaseTable = new uint256[](scheduleMonths);
        uint256 cumulative;
        for (uint256 i = 0; i < scheduleMonths; ++i) {
            cumulative += monthlyBudget(i);
            cumulativeReleaseTable[i] = cumulative;
        }

        IROAMigrationTypes.ScheduleSnapshot memory snapshot = IROAMigrationTypes.ScheduleSnapshot({
            kind: IROAMigrationTypes.ScheduleKind.MonthlyCumulative,
            beneficiary: address(0),
            total: allocation,
            released: totalReleased,
            start: startTimestamp,
            cliffMonths: 0,
            linearDurationMonths: 0,
            cumulativeReleaseTable: cumulativeReleaseTable,
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

    function _yearAllocation(uint256 yearIndex) private view returns (uint256) {
        if (yearIndex == _annualWeights.length - 1) {
            uint256 previousYears;
            for (uint256 i = 0; i < yearIndex; ++i) {
                previousYears += (allocation * _annualWeights[i]) / 100;
            }
            return allocation - previousYears;
        }
        return (allocation * _annualWeights[yearIndex]) / 100;
    }

    function _monthAt(uint64 timestamp) private view returns (bool active, uint256 monthIndex) {
        if (timestamp < startTimestamp) return (false, 0);
        monthIndex = (timestamp - startTimestamp) / MONTH;
        active = monthIndex < scheduleMonths;
    }
}
