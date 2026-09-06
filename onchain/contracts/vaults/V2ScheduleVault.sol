// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IROAMigrationTypes} from "../migration/IROAMigrationTypes.sol";
import {V2ScheduleImporter} from "./V2ScheduleImporter.sol";

/// @title V2ScheduleVault
/// @notice Releases the schedule a V1 vault migrated into it. The importer half records the
/// snapshot at the moment of migration and never changes it; this half pays the schedule out
/// with the same calendar arithmetic the V1 vaults use, so the amount a beneficiary could take
/// on any given day is identical before and after the migration.
///
/// One vault carries exactly one schedule: the migration contract pairs every V1 vault with a
/// distinct V2 vault, and a second import is refused so the release paths never have to pick.
///
/// Release paths mirror the V1 vault kinds:
/// - `release()` — schedules with a beneficiary (cliff-linear vesting, liquidity), open to anyone,
///   always paid to the beneficiary.
/// - `releaseForCurrentMonth()` — managed monthly emission (ecosystem, research), release manager,
///   current month's budget only; a month left unspent is never carried forward.
/// - `releaseReward()` — the NODE reward emission, reward distributor only, per closed epoch.
contract V2ScheduleVault is V2ScheduleImporter, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint64 public constant MONTH = 30 days;
    bytes32 public constant RELEASE_MANAGER_ROLE = keccak256("RELEASE_MANAGER_ROLE");
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");

    error ScheduleAlreadyActive(bytes32 activeScheduleId);
    error NoActiveSchedule();
    error ScheduleKindMismatch();
    error NothingToRelease();
    error RewardClaimsOnly();
    error NotRewardClaimsVault();
    error EmissionMonthInactive();
    error InvalidEpoch(uint256 epoch);
    error RewardEpochNotClosed(uint256 epoch);
    error MonthlyLimitExceeded(uint256 requested, uint256 available);

    event TokensReleased(bytes32 indexed sourceScheduleId, address indexed recipient, uint256 amount, uint256 released);
    event MonthlyReleaseRecorded(
        bytes32 indexed sourceScheduleId,
        uint256 indexed monthIndex,
        address indexed recipient,
        uint256 amount,
        uint256 monthReleased
    );

    bool public immutable rewardClaimsOnly;
    bytes32 public activeScheduleId;
    mapping(uint256 monthIndex => uint256 amount) public releasedByMonth;

    constructor(
        IERC20 token_,
        address migrationContract_,
        address admin,
        address releaseManager,
        bool rewardClaimsOnly_
    ) V2ScheduleImporter(token_, migrationContract_) {
        if (admin == address(0)) revert ZeroAddress();
        rewardClaimsOnly = rewardClaimsOnly_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (releaseManager != address(0)) _grantRole(RELEASE_MANAGER_ROLE, releaseManager);
    }

    function importSchedule(IROAMigrationTypes.ScheduleSnapshot calldata snapshot)
        external
        override
        returns (uint256 remaining, bytes32 snapshotHash)
    {
        if (activeScheduleId != bytes32(0)) revert ScheduleAlreadyActive(activeScheduleId);
        (remaining, snapshotHash) = _importSchedule(snapshot);
        activeScheduleId = snapshot.sourceScheduleId;
    }

    /// @notice Cumulative amount the schedule has vested at `timestamp`, V1 released included.
    function vestedAt(uint64 timestamp) public view returns (uint256) {
        ImportedSchedule storage schedule = _activeSchedule();
        if (schedule.kind == IROAMigrationTypes.ScheduleKind.CliffLinear) {
            uint256 cliffEnd = uint256(schedule.start) + (uint256(schedule.cliffMonths) * MONTH);
            if (timestamp <= cliffEnd) return 0;
            uint256 completedMonths = (timestamp - cliffEnd) / MONTH;
            if (completedMonths >= schedule.linearDurationMonths) return schedule.total;
            return (schedule.total * completedMonths) / schedule.linearDurationMonths;
        }
        if (timestamp < schedule.start) return 0;
        uint256 monthIndex = (timestamp - schedule.start) / MONTH;
        if (monthIndex >= schedule.cumulativePointCount) return schedule.total;
        return cumulativeReleasePoint[activeScheduleId][monthIndex];
    }

    /// @notice Budget of one month of a cumulative schedule, exactly the V1 vault's figure.
    function monthlyBudget(uint256 monthIndex) public view returns (uint256) {
        ImportedSchedule storage schedule = _activeSchedule();
        if (schedule.kind != IROAMigrationTypes.ScheduleKind.MonthlyCumulative) return 0;
        if (monthIndex >= schedule.cumulativePointCount) return 0;
        uint256 previous = monthIndex == 0 ? 0 : cumulativeReleasePoint[activeScheduleId][monthIndex - 1];
        return cumulativeReleasePoint[activeScheduleId][monthIndex] - previous;
    }

    function releasable() public view returns (uint256) {
        ImportedSchedule storage schedule = _activeSchedule();
        uint256 vested = vestedAt(uint64(block.timestamp));
        return vested > schedule.released ? vested - schedule.released : 0;
    }

    function release() external nonReentrant {
        ImportedSchedule storage schedule = _activeSchedule();
        if (schedule.beneficiary == address(0)) revert ScheduleKindMismatch();

        uint256 amount = releasable();
        if (amount == 0) revert NothingToRelease();
        _payout(schedule, schedule.beneficiary, amount);
    }

    function releaseForCurrentMonth(address recipient, uint256 amount)
        external
        onlyRole(RELEASE_MANAGER_ROLE)
        nonReentrant
    {
        if (rewardClaimsOnly) revert RewardClaimsOnly();
        ImportedSchedule storage schedule = _managedSchedule();

        (bool active, uint256 monthIndex) = _monthAt(schedule, uint64(block.timestamp));
        if (!active) revert EmissionMonthInactive();
        _releaseForMonth(schedule, monthIndex, recipient, amount);
    }

    function releaseReward(uint256 epoch, address recipient, uint256 amount)
        external
        onlyRole(REWARD_DISTRIBUTOR_ROLE)
        nonReentrant
    {
        if (!rewardClaimsOnly) revert NotRewardClaimsVault();
        ImportedSchedule storage schedule = _managedSchedule();
        if (epoch >= schedule.cumulativePointCount) revert InvalidEpoch(epoch);

        uint256 epochEnd = uint256(schedule.start) + ((epoch + 1) * MONTH);
        if (block.timestamp < epochEnd) revert RewardEpochNotClosed(epoch);
        _releaseForMonth(schedule, epoch, recipient, amount);
    }

    function _releaseForMonth(ImportedSchedule storage schedule, uint256 monthIndex, address recipient, uint256 amount)
        private
    {
        if (recipient == address(0)) revert ZeroAddress();

        uint256 available = monthlyBudget(monthIndex) - releasedByMonth[monthIndex];
        // Whatever V1 released before the migration counts against the cumulative table, so
        // the month of the migration cannot pay out more than the schedule allows in total.
        uint256 cumulativeCap = cumulativeReleasePoint[activeScheduleId][monthIndex];
        uint256 cumulativeAvailable = cumulativeCap > schedule.released ? cumulativeCap - schedule.released : 0;
        if (cumulativeAvailable < available) available = cumulativeAvailable;
        if (amount == 0 || amount > available) revert MonthlyLimitExceeded(amount, available);

        releasedByMonth[monthIndex] += amount;
        _payout(schedule, recipient, amount);
        emit MonthlyReleaseRecorded(activeScheduleId, monthIndex, recipient, amount, releasedByMonth[monthIndex]);
    }

    function _payout(ImportedSchedule storage schedule, address recipient, uint256 amount) private {
        schedule.released += amount;
        schedule.remaining -= amount;
        totalImportedRemaining -= amount;
        token.safeTransfer(recipient, amount);
        emit TokensReleased(activeScheduleId, recipient, amount, schedule.released);
    }

    function _activeSchedule() private view returns (ImportedSchedule storage schedule) {
        if (activeScheduleId == bytes32(0)) revert NoActiveSchedule();
        schedule = _schedules[activeScheduleId];
    }

    /// @dev A cumulative schedule without a beneficiary is paid out by a role, never by a call.
    function _managedSchedule() private view returns (ImportedSchedule storage schedule) {
        schedule = _activeSchedule();
        if (
            schedule.kind != IROAMigrationTypes.ScheduleKind.MonthlyCumulative
                || schedule.beneficiary != address(0)
        ) revert ScheduleKindMismatch();
    }

    function _monthAt(ImportedSchedule storage schedule, uint64 timestamp)
        private
        view
        returns (bool active, uint256 monthIndex)
    {
        if (timestamp < schedule.start) return (false, 0);
        monthIndex = (timestamp - schedule.start) / MONTH;
        active = monthIndex < schedule.cumulativePointCount;
    }
}
