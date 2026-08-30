// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

contract IROATimelock is TimelockController {
    uint256 public constant BASE_MAINNET_CHAIN_ID = 8453;
    uint256 public constant BASE_SEPOLIA_CHAIN_ID = 84532;
    uint256 public constant LOCAL_CHAIN_ID = 31337;
    uint256 public constant ANVIL_CHAIN_ID = 1337;
    uint256 public constant MIN_PRODUCTION_DELAY = 48 hours;

    error UnsupportedChain(uint256 chainId);
    error ProductionDelayTooShort(uint256 supplied, uint256 minimum);

    constructor(uint256 minDelay, address[] memory proposers, address[] memory executors)
        TimelockController(minDelay, proposers, executors, address(0))
    {
        uint256 chainId = block.chainid;
        if (chainId == BASE_MAINNET_CHAIN_ID || chainId == BASE_SEPOLIA_CHAIN_ID) {
            if (minDelay < MIN_PRODUCTION_DELAY) {
                revert ProductionDelayTooShort(minDelay, MIN_PRODUCTION_DELAY);
            }
        } else if (chainId != LOCAL_CHAIN_ID && chainId != ANVIL_CHAIN_ID) {
            revert UnsupportedChain(chainId);
        }
    }

    function updateDelay(uint256 newDelay) public override {
        if (_isProductionChain() && newDelay < MIN_PRODUCTION_DELAY) {
            revert ProductionDelayTooShort(newDelay, MIN_PRODUCTION_DELAY);
        }
        super.updateDelay(newDelay);
    }

    function _isProductionChain() private view returns (bool) {
        return block.chainid == BASE_MAINNET_CHAIN_ID || block.chainid == BASE_SEPOLIA_CHAIN_ID;
    }
}
