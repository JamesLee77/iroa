// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IROAMigrationTypes} from "../migration/IROAMigrationTypes.sol";
import {V2ScheduleImporter} from "../vaults/V2ScheduleImporter.sol";

interface IIROATokenV1Migration is IERC20 {
    function burnForMigration(uint256 amount) external;
}

interface IIROATokenV2Migration is IERC20 {
    function migrationAuthorityLocked() external view returns (bool);
    function registerMigrationVault(address vault) external;
    function mintForMigration(address recipient, uint256 amount) external;
}

contract IROAMigrationV1ToV2 is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant REQUIRED_VAULT_PAIRS = 7;

    error ZeroAddress();
    error IdenticalTokenAddress(address token);
    error ZeroAmount();
    error InvalidContract(address account);
    error InvalidV2Importer(address importer);
    error MigrationAuthorityNotLocked();
    error VaultPairsLocked();
    error VaultPairLimitReached(uint256 maximum);
    error VaultPairsNotLocked(uint256 registered, uint256 required);
    error VaultPairAlreadyRegistered(address v1Vault, address v2Vault);
    error InvalidVaultPair(address caller, address suppliedV2Vault, address expectedV2Vault);
    error SourceBatchAlreadyUsed(bytes32 sourceBatchId);
    error SourceScheduleAlreadyUsed(bytes32 sourceScheduleId);
    error InvalidBatchIdentifier();
    error SnapshotHashMismatch(bytes32 supplied, bytes32 actual);
    error ImportedAmountMismatch(uint256 amount, uint256 importedRemaining);
    error UnsupportedTokenBehavior(uint256 expected, uint256 received);

    event VaultPairRegistered(uint256 indexed pairIndex, address indexed v1Vault, address indexed v2Vault);
    event VaultPairsPermanentlyLocked(uint256 pairCount);
    event Migrated(address indexed account, uint256 amount);
    event VaultMigrated(
        address indexed v1Vault,
        address indexed v2Vault,
        bytes32 indexed sourceBatchId,
        bytes32 sourceScheduleId,
        uint256 amount
    );

    IIROATokenV1Migration public immutable v1;
    IIROATokenV2Migration public immutable v2;

    uint256 public migrationBurned;
    uint256 public migrationMinted;
    uint256 public vaultPairCount;
    bool public vaultPairsLocked;

    mapping(address v1Vault => address v2Vault) public v2VaultFor;
    mapping(address v2Vault => address v1Vault) public v1VaultFor;
    mapping(bytes32 sourceBatchId => bool used) public usedSourceBatch;
    mapping(bytes32 sourceScheduleId => bool used) public usedSourceSchedule;

    constructor(IIROATokenV1Migration v1_, IIROATokenV2Migration v2_, address admin) {
        if (address(v1_) == address(0) || address(v2_) == address(0) || admin == address(0)) {
            revert ZeroAddress();
        }
        if (address(v1_) == address(v2_)) revert IdenticalTokenAddress(address(v1_));
        if (address(v1_).code.length == 0) revert InvalidContract(address(v1_));
        if (address(v2_).code.length == 0) revert InvalidContract(address(v2_));
        v1 = v1_;
        v2 = v2_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function registerVaultPair(address v1Vault, address v2Vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (vaultPairsLocked) revert VaultPairsLocked();
        if (vaultPairCount >= REQUIRED_VAULT_PAIRS) revert VaultPairLimitReached(REQUIRED_VAULT_PAIRS);
        if (v1Vault == address(0) || v2Vault == address(0)) revert ZeroAddress();
        if (v1Vault.code.length == 0) revert InvalidContract(v1Vault);
        if (v2Vault.code.length == 0) revert InvalidContract(v2Vault);
        if (v2VaultFor[v1Vault] != address(0) || v1VaultFor[v2Vault] != address(0)) {
            revert VaultPairAlreadyRegistered(v1Vault, v2Vault);
        }
        if (!v2.migrationAuthorityLocked()) revert MigrationAuthorityNotLocked();
        _validateV2Importer(v2Vault);

        v2VaultFor[v1Vault] = v2Vault;
        v1VaultFor[v2Vault] = v1Vault;
        ++vaultPairCount;
        v2.registerMigrationVault(v2Vault);
        emit VaultPairRegistered(vaultPairCount - 1, v1Vault, v2Vault);
    }

    function lockVaultPairs() external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (vaultPairsLocked) revert VaultPairsLocked();
        if (vaultPairCount != REQUIRED_VAULT_PAIRS) {
            revert VaultPairsNotLocked(vaultPairCount, REQUIRED_VAULT_PAIRS);
        }
        vaultPairsLocked = true;
        emit VaultPairsPermanentlyLocked(vaultPairCount);
    }

    function migrate(uint256 amount) external nonReentrant {
        _migrateTokens(msg.sender, msg.sender, amount);
        emit Migrated(msg.sender, amount);
    }

    function migrateVault(IROAMigrationTypes.VaultMigrationBatch calldata batch) external nonReentrant {
        if (!vaultPairsLocked) revert VaultPairsNotLocked(vaultPairCount, REQUIRED_VAULT_PAIRS);
        address expectedV2Vault = v2VaultFor[msg.sender];
        if (expectedV2Vault == address(0) || batch.v2Vault != expectedV2Vault) {
            revert InvalidVaultPair(msg.sender, batch.v2Vault, expectedV2Vault);
        }
        if (batch.sourceBatchId == bytes32(0) || batch.snapshot.sourceScheduleId == bytes32(0)) {
            revert InvalidBatchIdentifier();
        }
        if (usedSourceBatch[batch.sourceBatchId]) revert SourceBatchAlreadyUsed(batch.sourceBatchId);
        if (usedSourceSchedule[batch.snapshot.sourceScheduleId]) {
            revert SourceScheduleAlreadyUsed(batch.snapshot.sourceScheduleId);
        }

        bytes32 actualSnapshotHash = IROAMigrationTypes.hashSnapshot(batch.snapshot);
        if (actualSnapshotHash != batch.scheduleSnapshotHash) {
            revert SnapshotHashMismatch(batch.scheduleSnapshotHash, actualSnapshotHash);
        }

        usedSourceBatch[batch.sourceBatchId] = true;
        usedSourceSchedule[batch.snapshot.sourceScheduleId] = true;
        _migrateTokens(msg.sender, batch.v2Vault, batch.amount);
        (uint256 importedRemaining, bytes32 importedHash) =
            V2ScheduleImporter(batch.v2Vault).importSchedule(batch.snapshot);
        if (importedHash != actualSnapshotHash) {
            revert SnapshotHashMismatch(actualSnapshotHash, importedHash);
        }
        if (importedRemaining != batch.amount) {
            revert ImportedAmountMismatch(batch.amount, importedRemaining);
        }

        emit VaultMigrated(
            msg.sender,
            batch.v2Vault,
            batch.sourceBatchId,
            batch.snapshot.sourceScheduleId,
            batch.amount
        );
    }

    function _migrateTokens(address from, address recipient, uint256 amount) private {
        if (amount == 0) revert ZeroAmount();

        uint256 balanceBefore = v1.balanceOf(address(this));
        IERC20(address(v1)).safeTransferFrom(from, address(this), amount);
        uint256 received = v1.balanceOf(address(this)) - balanceBefore;
        if (received != amount) revert UnsupportedTokenBehavior(amount, received);

        v1.burnForMigration(amount);
        migrationBurned += amount;
        v2.mintForMigration(recipient, amount);
        migrationMinted += amount;
        assert(migrationBurned == migrationMinted);
    }

    function _validateV2Importer(address importer) private view {
        try V2ScheduleImporter(importer).token() returns (IERC20 importerToken) {
            if (address(importerToken) != address(v2)) revert InvalidV2Importer(importer);
        } catch {
            revert InvalidV2Importer(importer);
        }

        try V2ScheduleImporter(importer).migrationContract() returns (address importerMigration) {
            if (importerMigration != address(this)) revert InvalidV2Importer(importer);
        } catch {
            revert InvalidV2Importer(importer);
        }
    }
}
