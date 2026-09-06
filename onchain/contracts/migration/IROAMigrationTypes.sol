// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

library IROAMigrationTypes {
    enum ScheduleKind {
        CliffLinear,
        MonthlyCumulative
    }

    struct ScheduleSnapshot {
        ScheduleKind kind;
        address beneficiary;
        uint256 total;
        uint256 released;
        uint64 start;
        uint32 cliffMonths;
        uint32 linearDurationMonths;
        uint256[] cumulativeReleaseTable;
        bytes32 sourceScheduleId;
    }

    struct VaultMigrationBatch {
        address v2Vault;
        uint256 amount;
        bytes32 scheduleSnapshotHash;
        bytes32 sourceBatchId;
        ScheduleSnapshot snapshot;
    }

    function hashSnapshot(ScheduleSnapshot memory snapshot) internal pure returns (bytes32) {
        return keccak256(abi.encode(snapshot));
    }
}

interface IIROAVaultMigration {
    function migrateVault(IROAMigrationTypes.VaultMigrationBatch calldata batch) external;
}

interface IIROAV1MigrationBinding {
    function migrationContract() external view returns (address);
}

/// @dev The pair a migration contract was deployed for; each token checks its own side before binding.
interface IIROAMigrationTokenBinding {
    function v1() external view returns (address);
    function v2() external view returns (address);
}
