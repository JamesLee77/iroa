// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MonthlyEmissionVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint64 public constant MONTH = 30 days;
    bytes32 public constant RELEASE_MANAGER_ROLE = keccak256("RELEASE_MANAGER_ROLE");

    error ZeroAddress();
    error InvalidAllocation();
    error InvalidWeights();
    error EmissionMonthInactive();
    error MonthlyLimitExceeded(uint256 requested, uint256 available);

    event MonthlyEmissionReleased(
        uint256 indexed monthIndex,
        address indexed recipient,
        uint256 amount,
        uint256 monthReleased
    );

    IERC20 public immutable token;
    uint256 public immutable allocation;
    uint64 public immutable startTimestamp;
    uint256 public immutable scheduleMonths;
    uint256 public totalReleased;

    uint16[] private _annualWeights;
    mapping(uint256 monthIndex => uint256 amount) public releasedByMonth;

    constructor(
        IERC20 token_,
        uint256 allocation_,
        uint64 startTimestamp_,
        uint16[] memory annualWeights_,
        address admin,
        address releaseManager
    ) {
        if (address(token_) == address(0) || admin == address(0) || releaseManager == address(0)) {
            revert ZeroAddress();
        }
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

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RELEASE_MANAGER_ROLE, releaseManager);
    }

    function annualWeights() external view returns (uint16[] memory) {
        return _annualWeights;
    }

    function monthlyBudget(uint256 monthIndex) public view returns (uint256) {
        if (monthIndex >= scheduleMonths) return 0;

        uint256 yearIndex = monthIndex / 12;
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
