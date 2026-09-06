// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IROAMigrationTypes} from "../migration/IROAMigrationTypes.sol";

contract V2ScheduleImporter {
    struct ImportedSchedule {
        IROAMigrationTypes.ScheduleKind kind;
        address beneficiary;
        uint256 total;
        uint256 released;
        uint256 remaining;
        uint64 start;
        uint32 cliffMonths;
        uint32 linearDurationMonths;
        uint32 cumulativePointCount;
        bytes32 snapshotHash;
    }

    error ZeroAddress();
    error OnlyMigrationContract(address caller);
    error InvalidSchedule();
    error ScheduleAlreadyImported(bytes32 sourceScheduleId);
    error InsufficientBacking(uint256 required, uint256 actual);

    event ScheduleImported(
        bytes32 indexed sourceScheduleId,
        IROAMigrationTypes.ScheduleKind indexed kind,
        address indexed beneficiary,
        uint256 remaining,
        bytes32 snapshotHash
    );

    IERC20 public immutable token;
    address public immutable migrationContract;
    uint256 public totalImportedRemaining;

    mapping(bytes32 sourceScheduleId => bool imported) public importedSourceSchedule;
    mapping(bytes32 sourceScheduleId => ImportedSchedule schedule) internal _schedules;
    mapping(bytes32 sourceScheduleId => mapping(uint256 pointIndex => uint256 cumulativeAmount))
        public cumulativeReleasePoint;

    constructor(IERC20 token_, address migrationContract_) {
        if (address(token_) == address(0) || migrationContract_ == address(0)) revert ZeroAddress();
        token = token_;
        migrationContract = migrationContract_;
    }

    function importSchedule(IROAMigrationTypes.ScheduleSnapshot calldata snapshot)
        external
        virtual
        returns (uint256 remaining, bytes32 snapshotHash)
    {
        return _importSchedule(snapshot);
    }

    function _importSchedule(IROAMigrationTypes.ScheduleSnapshot calldata snapshot)
        internal
        returns (uint256 remaining, bytes32 snapshotHash)
    {
        if (msg.sender != migrationContract) revert OnlyMigrationContract(msg.sender);
        if (snapshot.sourceScheduleId == bytes32(0) || snapshot.total == 0 || snapshot.released > snapshot.total) {
            revert InvalidSchedule();
        }
        if (importedSourceSchedule[snapshot.sourceScheduleId]) {
            revert ScheduleAlreadyImported(snapshot.sourceScheduleId);
        }

        remaining = snapshot.total - snapshot.released;
        if (remaining == 0) revert InvalidSchedule();

        if (snapshot.kind == IROAMigrationTypes.ScheduleKind.CliffLinear) {
            if (
                snapshot.beneficiary == address(0) || snapshot.linearDurationMonths == 0
                    || snapshot.cumulativeReleaseTable.length != 0
            ) revert InvalidSchedule();
        } else {
            if (
                snapshot.cliffMonths != 0 || snapshot.linearDurationMonths != 0
                    || snapshot.cumulativeReleaseTable.length == 0
            ) revert InvalidSchedule();
            _storeCumulativeTable(snapshot.sourceScheduleId, snapshot.cumulativeReleaseTable, snapshot.total);
        }

        snapshotHash = IROAMigrationTypes.hashSnapshot(snapshot);
        uint256 requiredBacking = totalImportedRemaining + remaining;
        uint256 actualBacking = token.balanceOf(address(this));
        if (actualBacking < requiredBacking) revert InsufficientBacking(requiredBacking, actualBacking);

        importedSourceSchedule[snapshot.sourceScheduleId] = true;
        totalImportedRemaining = requiredBacking;
        _schedules[snapshot.sourceScheduleId] = ImportedSchedule({
            kind: snapshot.kind,
            beneficiary: snapshot.beneficiary,
            total: snapshot.total,
            released: snapshot.released,
            remaining: remaining,
            start: snapshot.start,
            cliffMonths: snapshot.cliffMonths,
            linearDurationMonths: snapshot.linearDurationMonths,
            cumulativePointCount: uint32(snapshot.cumulativeReleaseTable.length),
            snapshotHash: snapshotHash
        });

        emit ScheduleImported(snapshot.sourceScheduleId, snapshot.kind, snapshot.beneficiary, remaining, snapshotHash);
    }

    function getSchedule(bytes32 sourceScheduleId) external view returns (ImportedSchedule memory) {
        return _schedules[sourceScheduleId];
    }

    function _storeCumulativeTable(bytes32 sourceScheduleId, uint256[] calldata table, uint256 total) private {
        uint256 previous;
        for (uint256 i = 0; i < table.length; ++i) {
            uint256 current = table[i];
            if (current < previous || current > total) revert InvalidSchedule();
            cumulativeReleasePoint[sourceScheduleId][i] = current;
            previous = current;
        }
        if (previous != total) revert InvalidSchedule();
    }
}
