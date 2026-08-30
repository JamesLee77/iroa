// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LiquidityReleaseVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint64 public constant MONTH = 30 days;
    uint16 public constant LINEAR_MONTHS = 36;
    uint256 public constant INITIAL_RELEASE = 200_000_000 ether;
    uint256 public constant LINEAR_RELEASE = 300_000_000 ether;
    uint256 public constant TOTAL_ALLOCATION = INITIAL_RELEASE + LINEAR_RELEASE;

    error ZeroAddress();
    error NothingToRelease();

    event LiquidityReleased(address indexed treasury, uint256 amount, uint256 totalReleased);

    IERC20 public immutable token;
    address public immutable treasury;
    uint64 public immutable startTimestamp;
    uint256 public released;

    constructor(IERC20 token_, address treasury_, uint64 startTimestamp_) {
        if (address(token_) == address(0) || treasury_ == address(0)) revert ZeroAddress();
        token = token_;
        treasury = treasury_;
        startTimestamp = startTimestamp_;
    }

    function vestedAt(uint64 timestamp) public view returns (uint256) {
        if (timestamp < startTimestamp) return 0;

        uint256 completedMonths = (timestamp - startTimestamp) / MONTH;
        if (completedMonths >= LINEAR_MONTHS) return TOTAL_ALLOCATION;
        return INITIAL_RELEASE + ((LINEAR_RELEASE * completedMonths) / LINEAR_MONTHS);
    }

    function releasableAt(uint64 timestamp) public view returns (uint256) {
        uint256 vested = vestedAt(timestamp);
        return vested > released ? vested - released : 0;
    }

    function release() external nonReentrant {
        uint256 amount = releasableAt(uint64(block.timestamp));
        if (amount == 0) revert NothingToRelease();

        released += amount;
        token.safeTransfer(treasury, amount);
        emit LiquidityReleased(treasury, amount, released);
    }
}
