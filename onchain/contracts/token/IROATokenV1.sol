// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract IROATokenV1 is ERC20, ERC20Permit, AccessControl {
    uint256 public constant GENESIS_SUPPLY = 10_000_000_000 ether;
    bytes32 public constant ALLOWLIST_MANAGER_ROLE = keccak256("ALLOWLIST_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    enum TransferMode {
        NORMAL_PRIVATE,
        PAUSED,
        MIGRATION_ONLY
    }

    error ZeroAddress();
    error InvalidMigrationContract(address migration);
    error AccountNotAllowed(address account);
    error TransfersPaused();
    error MigrationAlreadyConfigured();
    error MigrationNotActive();
    error MigrationTransferRequired(address migration);
    error MigrationContractMustRemainAllowed();
    error OnlyMigrationContract(address caller);

    event AllowedAccountUpdated(address indexed account, bool allowed);
    event TransferModeChanged(TransferMode indexed previousMode, TransferMode indexed newMode);
    event MigrationModeEntered(address indexed migrationContract);

    mapping(address account => bool allowed) private _allowedAccounts;

    TransferMode public transferMode;
    address public migrationContract;

    constructor(address genesisSafe, address initialAdmin, address initialPauser)
        ERC20("IROA", "IROA")
        ERC20Permit("IROA")
    {
        if (genesisSafe == address(0) || initialAdmin == address(0) || initialPauser == address(0)) {
            revert ZeroAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ALLOWLIST_MANAGER_ROLE, initialAdmin);
        _grantRole(PAUSER_ROLE, initialPauser);

        _allowedAccounts[genesisSafe] = true;
        emit AllowedAccountUpdated(genesisSafe, true);

        _mint(genesisSafe, GENESIS_SUPPLY);
    }

    function isAllowed(address account) external view returns (bool) {
        return _allowedAccounts[account];
    }

    function setAllowed(address account, bool allowed) external onlyRole(ALLOWLIST_MANAGER_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        if (!allowed && account == migrationContract) revert MigrationContractMustRemainAllowed();

        _allowedAccounts[account] = allowed;
        emit AllowedAccountUpdated(account, allowed);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        if (transferMode == TransferMode.MIGRATION_ONLY) revert MigrationAlreadyConfigured();
        if (transferMode != TransferMode.PAUSED) {
            TransferMode previousMode = transferMode;
            transferMode = TransferMode.PAUSED;
            emit TransferModeChanged(previousMode, transferMode);
        }
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        if (transferMode == TransferMode.MIGRATION_ONLY) revert MigrationAlreadyConfigured();
        if (transferMode == TransferMode.PAUSED) {
            transferMode = TransferMode.NORMAL_PRIVATE;
            emit TransferModeChanged(TransferMode.PAUSED, transferMode);
        }
    }

    function enterMigrationMode(address migration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (migrationContract != address(0)) revert MigrationAlreadyConfigured();
        if (migration == address(0)) revert ZeroAddress();
        if (migration.code.length == 0) revert InvalidMigrationContract(migration);

        TransferMode previousMode = transferMode;
        migrationContract = migration;
        _allowedAccounts[migration] = true;
        transferMode = TransferMode.MIGRATION_ONLY;

        emit AllowedAccountUpdated(migration, true);
        emit TransferModeChanged(previousMode, transferMode);
        emit MigrationModeEntered(migration);
    }

    function burnForMigration(uint256 amount) external {
        if (transferMode != TransferMode.MIGRATION_ONLY) revert MigrationNotActive();
        if (msg.sender != migrationContract) revert OnlyMigrationContract(msg.sender);
        _burn(msg.sender, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        TransferMode mode = transferMode;

        if (mode == TransferMode.PAUSED) revert TransfersPaused();

        if (mode == TransferMode.MIGRATION_ONLY) {
            address migration = migrationContract;
            bool depositToMigration =
                from != address(0) && to == migration && msg.sender == migration && _allowedAccounts[from];
            bool burnByMigration = from == migration && to == address(0);
            if (!depositToMigration && !burnByMigration) revert MigrationTransferRequired(migration);
        } else {
            if (from != address(0) && !_allowedAccounts[from]) revert AccountNotAllowed(from);
            if (to != address(0) && !_allowedAccounts[to]) revert AccountNotAllowed(to);
        }

        super._update(from, to, value);
    }
}
