import { pathToFileURL } from "node:url";
import { network } from "hardhat";
import {
  ALLOCATIONS,
  ANNUAL_WEIGHTS,
  assertAllocationPlan,
  assertProfileChain,
  assertUniqueAddresses,
  deployedBytecodeHash,
  parseProfile,
  requireAddress,
  safeError,
  signManifest,
  writeJsonAtomic,
  type DeploymentManifest,
  type VaultManifestEntry,
} from "./deployment-common.js";

function requiredTimestamp(value: string | undefined): bigint {
  if (!value || !/^\d+$/.test(value)) throw new Error("VESTING_START_TIMESTAMP must be a Unix timestamp");
  const timestamp = BigInt(value);
  if (timestamp <= 0n || timestamp > 18_446_744_073_709_551_615n) {
    throw new Error("VESTING_START_TIMESTAMP is outside uint64 range");
  }
  return timestamp;
}

type NetworkConnection = Awaited<ReturnType<typeof network.connect>>;

export async function deployV1(existingConnection?: NetworkConnection): Promise<DeploymentManifest> {
  const profile = parseProfile(process.env.DEPLOYMENT_PROFILE);
  const connection = existingConnection ?? await network.connect();
  const { ethers } = connection;
  const providerNetwork = await ethers.provider.getNetwork();
  assertProfileChain(profile, providerNetwork.chainId);

  const genesisSafe = requireAddress(process.env.GENESIS_SAFE, "GENESIS_SAFE");
  const pauserSafe = requireAddress(process.env.PAUSER_SAFE, "PAUSER_SAFE");
  const team = requireAddress(process.env.TEAM_BENEFICIARY, "TEAM_BENEFICIARY");
  const investor = requireAddress(process.env.INVESTOR_BENEFICIARY, "INVESTOR_BENEFICIARY");
  const foundation = requireAddress(process.env.FOUNDATION_BENEFICIARY, "FOUNDATION_BENEFICIARY");
  const treasury = requireAddress(process.env.TREASURY, "TREASURY");
  const releaseManager = requireAddress(process.env.RELEASE_MANAGER, "RELEASE_MANAGER");
  const complianceSafe = requireAddress(process.env.COMPLIANCE_SAFE, "COMPLIANCE_SAFE");
  const suspenderSafe = requireAddress(process.env.SUSPENDER_SAFE, "SUSPENDER_SAFE");
  const rootProposerSafe = requireAddress(process.env.ROOT_PROPOSER_SAFE, "ROOT_PROPOSER_SAFE");
  const challengerSafe = requireAddress(process.env.CHALLENGER_SAFE, "CHALLENGER_SAFE");
  const start = requiredTimestamp(process.env.VESTING_START_TIMESTAMP);
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  assertAllocationPlan();

  const minDelay = profile === "local" ? 0n : 48n * 60n * 60n;
  const timelock = await ethers.deployContract("IROATimelock", [minDelay, [genesisSafe], [genesisSafe]]);
  await timelock.waitForDeployment();

  const token = await ethers.deployContract("IROATokenV1", [genesisSafe, deployerAddress, pauserSafe]);
  await token.waitForDeployment();
  // The public site scans events from here; the block of the first contract is the floor
  // for every contract in this manifest.
  const timelockReceipt = await timelock.deploymentTransaction()?.wait();
  const deploymentBlock = timelockReceipt?.blockNumber;
  if (deploymentBlock === undefined || deploymentBlock === null) throw new Error("timelock deployment block unavailable");

  const allocationByKey = Object.fromEntries(ALLOCATIONS.map((entry) => [entry.key, entry.amount]));
  const node = await ethers.deployContract("MonthlyEmissionVault", [
    token.target,
    allocationByKey.node,
    start,
    ANNUAL_WEIGHTS.node,
    true,
    deployerAddress,
    ethers.ZeroAddress,
  ]);
  await node.waitForDeployment();
  const ecosystem = await ethers.deployContract("MonthlyEmissionVault", [
    token.target,
    allocationByKey.ecosystem,
    start,
    ANNUAL_WEIGHTS.ecosystem,
    false,
    deployerAddress,
    releaseManager,
  ]);
  await ecosystem.waitForDeployment();
  const research = await ethers.deployContract("MonthlyEmissionVault", [
    token.target,
    allocationByKey.research,
    start,
    ANNUAL_WEIGHTS.research,
    false,
    deployerAddress,
    releaseManager,
  ]);
  await research.waitForDeployment();
  const teamVault = await ethers.deployContract("CliffLinearVestingVault", [
    token.target,
    team,
    allocationByKey.team,
    start,
    24,
    72,
  ]);
  await teamVault.waitForDeployment();
  const investorVault = await ethers.deployContract("CliffLinearVestingVault", [
    token.target,
    investor,
    allocationByKey.investor,
    start,
    18,
    42,
  ]);
  await investorVault.waitForDeployment();
  const foundationVault = await ethers.deployContract("CliffLinearVestingVault", [
    token.target,
    foundation,
    allocationByKey.foundation,
    start,
    12,
    84,
  ]);
  await foundationVault.waitForDeployment();
  const liquidity = await ethers.deployContract("LiquidityReleaseVault", [token.target, treasury, start]);
  await liquidity.waitForDeployment();

  const nodeRegistry = await ethers.deployContract("IROANodeRegistry", [
    timelock.target,
    complianceSafe,
    suspenderSafe,
  ]);
  await nodeRegistry.waitForDeployment();
  const rootRegistry = await ethers.deployContract("IROAReceiptRootRegistry", [
    timelock.target,
    rootProposerSafe,
    challengerSafe,
  ]);
  await rootRegistry.waitForDeployment();
  const rewardDistributor = await ethers.deployContract("IROARewardDistributor", [
    nodeRegistry.target,
    rootRegistry.target,
    token.target,
    node.target,
  ]);
  await rewardDistributor.waitForDeployment();

  const deployedVaults = [node, ecosystem, research, teamVault, investorVault, foundationVault, liquidity];

  const beneficiaries: Partial<Record<string, string>> = { team, investor, foundation, liquidity: treasury };
  const vaults: VaultManifestEntry[] = await Promise.all(
    ALLOCATIONS.map(async (allocation, index) => ({
      key: allocation.key,
      label: allocation.label,
      kind: allocation.kind,
      address: await deployedVaults[index].getAddress(),
      allocation: allocation.amount.toString(),
      beneficiary: beneficiaries[allocation.key],
    })),
  );
  assertUniqueAddresses(vaults);

  const contracts = {
    token: await token.getAddress(),
    tokenV1: await token.getAddress(),
    timelock: await timelock.getAddress(),
    safe: genesisSafe,
    nodeRegistry: await nodeRegistry.getAddress(),
    rootRegistry: await rootRegistry.getAddress(),
    rewardDistributor: await rewardDistributor.getAddress(),
  };
  const bytecodeHashes: Record<string, string> = {
    token: await deployedBytecodeHash(ethers.provider, contracts.token),
    timelock: await deployedBytecodeHash(ethers.provider, contracts.timelock),
    nodeRegistry: await deployedBytecodeHash(ethers.provider, contracts.nodeRegistry),
    rootRegistry: await deployedBytecodeHash(ethers.provider, contracts.rootRegistry),
    rewardDistributor: await deployedBytecodeHash(ethers.provider, contracts.rewardDistributor),
  };
  for (const vault of vaults) {
    bytecodeHashes[`vault:${vault.key}`] = await deployedBytecodeHash(ethers.provider, vault.address);
  }

  const unsigned: Omit<DeploymentManifest, "manifestHash" | "signer" | "signature"> = {
    schemaVersion: 1,
    release: "v1",
    profile,
    chainId: providerNetwork.chainId.toString(),
    createdAt: new Date().toISOString(),
    deployer: deployerAddress,
    contracts,
    vaults,
    bytecodeHashes,
    controls: {
      deploymentBlock: String(deploymentBlock),
      genesisSupplyRecipient: genesisSafe,
      allocationExecuted: false,
      rolesHandedOff: false,
      migrationModeEntered: false,
      complianceAuthority: complianceSafe,
      suspensionAuthority: suspenderSafe,
      rootProposalAuthority: rootProposerSafe,
      challengeAuthority: challengerSafe,
    },
  };
  const manifest = await signManifest(unsigned, deployer);
  const output = process.env.DEPLOYMENT_MANIFEST ?? `deployments/${profile}/v1.json`;
  await writeJsonAtomic(output, manifest);
  return manifest;
}

async function main(): Promise<void> {
  try {
    const manifest = await deployV1();
    console.log(`V1 deployment manifest written for chain ${manifest.chainId}: ${manifest.manifestHash}`);
  } catch (error) {
    throw safeError(error);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
