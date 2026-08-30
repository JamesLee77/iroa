// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract IROATokenV2 is ERC20, ERC20Permit, AccessControl {
    uint256 public constant CAP = 10_000_000_000 ether;
    bytes32 public constant ALLOWLIST_MANAGER_ROLE = keccak256("ALLOWLIST_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    error ZeroAddress();
    error AccountNotAllowed(address account);
    error TransfersPaused();
    error MigrationAlreadyBound();
    error MigrationNotBound();
    error MigrationAuthorityLocked();
    error MigrationAuthorityNotLocked();
    error OnlyMigrationContract(address caller);
    error MigrationVaultAlreadyRegistered(address vault);
    error SupplyCapExceeded(uint256 requestedSupply, uint256 cap);

    event AllowedAccountUpdated(address indexed account, bool allowed);
    event PauseStateChanged(bool paused);
    event MigrationContractBound(address indexed migrationContract);
    event MigrationAuthorityPermanentlyLocked(address indexed migrationContract);
    event MigrationVaultRegistered(address indexed vault);

    mapping(address account => bool allowed) private _allowedAccounts;
    mapping(address vault => bool registered) public registeredMigrationVault;

    bool public paused;
    bool public migrationAuthorityLocked;
    address public migrationContract;

    constructor(address initialAdmin, address initialPauser) ERC20("IROA", "IROA") ERC20Permit("IROA") {
        if (initialAdmin == address(0) || initialPauser == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ALLOWLIST_MANAGER_ROLE, initialAdmin);
        _grantRole(PAUSER_ROLE, initialPauser);
    }

    function isAllowed(address account) external view returns (bool) {
        return _allowedAccounts[account];
    }

    function isTransferAuthorized(address account) public view returns (bool) {
        return _allowedAccounts[account] || registeredMigrationVault[account];
    }

    function setAllowed(address account, bool allowed) external onlyRole(ALLOWLIST_MANAGER_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        _allowedAccounts[account] = allowed;
        emit AllowedAccountUpdated(account, allowed);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        if (!paused) {
            paused = true;
            emit PauseStateChanged(true);
        }
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        if (paused) {
            paused = false;
            emit PauseStateChanged(false);
        }
    }

    function bindMigrationContract(address migration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (migration == address(0)) revert ZeroAddress();
        if (migrationContract != address(0)) revert MigrationAlreadyBound();
        if (migrationAuthorityLocked) revert MigrationAuthorityLocked();
        if (totalSupply() != 0) revert MigrationAlreadyBound();

        migrationContract = migration;
        emit MigrationContractBound(migration);
    }

    function lockMigrationAuthority() external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (migrationContract == address(0)) revert MigrationNotBound();
        if (migrationAuthorityLocked) revert MigrationAuthorityLocked();
        migrationAuthorityLocked = true;
        emit MigrationAuthorityPermanentlyLocked(migrationContract);
    }

    function registerMigrationVault(address vault) external {
        if (msg.sender != migrationContract) revert OnlyMigrationContract(msg.sender);
        if (!migrationAuthorityLocked) revert MigrationAuthorityNotLocked();
        if (vault == address(0)) revert ZeroAddress();
        if (registeredMigrationVault[vault]) revert MigrationVaultAlreadyRegistered(vault);
        registeredMigrationVault[vault] = true;
        emit MigrationVaultRegistered(vault);
    }

    function mintForMigration(address recipient, uint256 amount) external {
        if (msg.sender != migrationContract) revert OnlyMigrationContract(msg.sender);
        if (!migrationAuthorityLocked) revert MigrationAuthorityNotLocked();
        if (recipient == address(0)) revert ZeroAddress();

        uint256 requestedSupply = totalSupply() + amount;
        if (requestedSupply > CAP) revert SupplyCapExceeded(requestedSupply, CAP);
        _mint(recipient, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (paused) revert TransfersPaused();
        if (from != address(0) && !isTransferAuthorized(from)) revert AccountNotAllowed(from);
        if (to != address(0) && !isTransferAuthorized(to)) revert AccountNotAllowed(to);
        super._update(from, to, value);
    }
}
