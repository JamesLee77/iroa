// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IIROAVaultMigration, IROAMigrationTypes} from "../migration/IROAMigrationTypes.sol";

contract MigrationVaultProbe {
    using SafeERC20 for IERC20;

    error Unauthorized(address caller);

    address public immutable owner;
    IERC20 public immutable token;

    constructor(IERC20 token_, address owner_) {
        token = token_;
        owner = owner_;
    }

    function migrate(address migration, IROAMigrationTypes.VaultMigrationBatch calldata batch) external {
        if (msg.sender != owner) revert Unauthorized(msg.sender);
        token.forceApprove(migration, batch.amount);
        IIROAVaultMigration(migration).migrateVault(batch);
        token.forceApprove(migration, 0);
    }
}
