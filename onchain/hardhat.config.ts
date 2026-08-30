import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    profiles: {
      default: {
        version: "0.8.24",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          metadata: { bytecodeHash: "ipfs" },
          evmVersion: "cancun",
        },
      },
      production: {
        version: "0.8.24",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          metadata: { bytecodeHash: "ipfs" },
          evmVersion: "cancun",
        },
      },
    },
  },
  paths: {
    tests: {
      mocha: "./test",
    },
  },
  networks: {
    hardhatBase: {
      type: "edr-simulated",
      chainType: "op",
      chainId: 31337,
    },
    baseSepolia: {
      type: "http",
      chainType: "op",
      chainId: 84532,
      url: configVariable("BASE_SEPOLIA_RPC_URL"),
      accounts: [configVariable("BASE_SEPOLIA_DEPLOYER_PRIVATE_KEY")],
    },
    base: {
      type: "http",
      chainType: "op",
      chainId: 8453,
      url: configVariable("BASE_MAINNET_RPC_URL"),
      accounts: [configVariable("BASE_MAINNET_DEPLOYER_PRIVATE_KEY")],
    },
  },
});
