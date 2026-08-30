import { pathToFileURL } from "node:url";
import { Contract, Interface, ZeroHash, id } from "ethers";
import { network } from "hardhat";
import {
  ALLOCATIONS,
  assertProfileChain,
  assertUniqueAddresses,
  createSafeBatch,
  deployedBytecodeHash,
  encodeTransaction,
  parseProfile,
  readJson,
  requireAddress,
  safeError,
  signManifest,
  verifyManifestSignature,
  writeJsonAtomic,
  type DeploymentManifest,
  type SafeTransaction,
  type VaultManifestEntry,
} from "./deployment-common.js";

const V2_ABI = [
  "function totalSupply() view returns (uint256)",
  "function bindMigrationContract(address migration)",
  "function lockMigrationAuthority()",
  "function migrationContract() view returns (address)",
  "function migrationAuthorityLocked() view returns (bool)",
];
const MIGRATION_ABI = [
  "function registerVaultPair(address v1Vault,address v2Vault)",
  "function lockVaultPairs()",
  "function vaultPairCount() view returns (uint256)",
  "function v2VaultFor(address) view returns (address)",
  "function vaultPairsLocked() view returns (bool)",
];
const TIMELOCK_ABI = [
  "function getMinDelay() view returns (uint256)",
  "function scheduleBatch(address[] targets,uint256[] values,bytes[] payloads,bytes32 predecessor,bytes32 salt,uint256 delay)",
  "function executeBatch(address[] targets,uint256[] values,bytes[] payloads,bytes32 predecessor,bytes32 salt)",
];
const IMPORTER_ABI = [
  "function token() view returns (address)",
  "function migrationContract() view returns (address)",
];

function timelockTransactions(args: {
  timelock: string;
  targets: string[];
  payloads: string[];
  salt: string;
  delay: bigint;
}): { schedule: SafeTransaction; execute: SafeTransaction } {
  if (args.targets.length !== args.payloads.length || args.targets.length === 0) {
    throw new Error("timelock target and payload arrays must be non-empty and equal length");
  }
  const iface = new Interface(TIMELOCK_ABI);
  const values = args.targets.map(() => 0n);
  return {
    schedule: encodeTransaction(args.timelock, iface, "scheduleBatch", [
      args.targets,
      values,
      args.payloads,
      ZeroHash,
      args.salt,
      args.delay,
    ]),
    execute: encodeTransaction(args.timelock, iface, "executeBatch", [
      args.targets,
      values,
      args.payloads,
      ZeroHash,
      args.salt,
    ]),
  };
}

async function writeTimelockSafeFiles(args: {
  profile: ReturnType<typeof parseProfile>;
  safe: string;
  name: string;
  description: string;
  outputPrefix: string;
  transactions: { schedule: SafeTransaction; execute: SafeTransaction };
}): Promise<void> {
  await writeJsonAtomic(
    `${args.outputPrefix}-schedule.json`,
    createSafeBatch({
      profile: args.profile,
      safe: args.safe,
      name: `${args.name} — schedule`,
      description: args.description,
      transactions: [args.transactions.schedule],
    }),
  );
  await writeJsonAtomic(
    `${args.outputPrefix}-execute.json`,
    createSafeBatch({
      profile: args.profile,
      safe: args.safe,
      name: `${args.name} — execute`,
      description: `${args.description} Execute only after the Timelock delay and a fresh read-back.`,
      transactions: [args.transactions.execute],
    }),
  );
}

async function deployPhase(
  profile: ReturnType<typeof parseProfile>,
  v1Manifest: DeploymentManifest,
): Promise<DeploymentManifest> {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const timelockAddress = requireAddress(v1Manifest.contracts.timelock, "V1 timelock");
  const pauserSafe = requireAddress(process.env.PAUSER_SAFE, "PAUSER_SAFE");
  const safe = requireAddress(String(v1Manifest.controls.genesisSupplyRecipient), "genesis Safe");

  const v2 = await ethers.deployContract("IROATokenV2", [timelockAddress, pauserSafe]);
  await v2.waitForDeployment();
  if ((await v2.totalSupply()) !== 0n) throw new Error("V2 initial supply must be zero");
  const migration = await ethers.deployContract("IROAMigrationV1ToV2", [
    v1Manifest.contracts.token,
    v2.target,
    timelockAddress,
  ]);
  await migration.waitForDeployment();

  const importers = [];
  for (const sourceVault of v1Manifest.vaults) {
    const importer = await ethers.deployContract("V2ScheduleImporter", [v2.target, migration.target]);
    await importer.waitForDeployment();
    importers.push(importer);
  }
  const vaults: VaultManifestEntry[] = await Promise.all(
    ALLOCATIONS.map(async (allocation, index) => ({
      key: allocation.key,
      label: allocation.label,
      kind: "v2-importer" as const,
      address: await importers[index].getAddress(),
      allocation: allocation.amount.toString(),
      sourceV1Vault: v1Manifest.vaults[index].address,
    })),
  );
  assertUniqueAddresses(vaults);

  const contracts = {
    token: await v2.getAddress(),
    migration: await migration.getAddress(),
    timelock: timelockAddress,
    v1Token: v1Manifest.contracts.token,
  };
  const bytecodeHashes: Record<string, string> = {
    token: await deployedBytecodeHash(ethers.provider, contracts.token),
    migration: await deployedBytecodeHash(ethers.provider, contracts.migration),
  };
  for (const vault of vaults) bytecodeHashes[`vault:${vault.key}`] = await deployedBytecodeHash(ethers.provider, vault.address);

  const chainId = (await ethers.provider.getNetwork()).chainId;
  const unsigned: Omit<DeploymentManifest, "manifestHash" | "signer" | "signature"> = {
    schemaVersion: 1,
    release: "v2-migration",
    profile,
    chainId: chainId.toString(),
    createdAt: new Date().toISOString(),
    deployer: deployerAddress,
    contracts,
    vaults,
    bytecodeHashes,
    controls: {
      v2InitialSupply: "0",
      migrationAuthorityLocked: false,
      vaultPairsLocked: false,
      v1MigrationModeEntered: false,
    },
  };
  const manifest = await signManifest(unsigned, deployer);
  const manifestPath = process.env.V2_MANIFEST ?? `deployments/${profile}/v2-migration.json`;
  await writeJsonAtomic(manifestPath, manifest);

  const v2Interface = new Interface(V2_ABI);
  const targets = [contracts.token, contracts.token];
  const payloads = [
    v2Interface.encodeFunctionData("bindMigrationContract", [contracts.migration]),
    v2Interface.encodeFunctionData("lockMigrationAuthority"),
  ];
  const timelock = new Contract(timelockAddress, TIMELOCK_ABI, ethers.provider);
  const delay = (await timelock.getMinDelay()) as bigint;
  const transactions = timelockTransactions({
    timelock: timelockAddress,
    targets,
    payloads,
    salt: id(`IROA_V2_BIND:${manifest.manifestHash}`),
    delay,
  });
  await writeTimelockSafeFiles({
    profile,
    safe,
    name: "IROA V2 migration authority lock",
    description: "Atomically bind the audited migration contract and permanently lock the V2 migration authority.",
    outputPrefix: `deployments/${profile}/safe-03-v2-bind-lock`,
    transactions,
  });
  return manifest;
}

async function registerPhase(
  profile: ReturnType<typeof parseProfile>,
  v1Manifest: DeploymentManifest,
  v2Manifest: DeploymentManifest,
): Promise<void> {
  const { ethers } = await network.connect();
  const v2 = new Contract(v2Manifest.contracts.token, V2_ABI, ethers.provider);
  const migration = new Contract(v2Manifest.contracts.migration, MIGRATION_ABI, ethers.provider);
  if ((await v2.totalSupply()) !== 0n) throw new Error("V2 supply must remain zero before vault pair lock");
  if (!(await v2.migrationAuthorityLocked())) throw new Error("V2 migration authority is not locked");
  if ((await v2.migrationContract()).toLowerCase() !== v2Manifest.contracts.migration.toLowerCase()) {
    throw new Error("V2 migration binding read-back mismatch");
  }
  if ((await migration.vaultPairCount()) !== 0n || (await migration.vaultPairsLocked())) {
    throw new Error("migration vault pair state is not pristine");
  }

  const migrationInterface = new Interface(MIGRATION_ABI);
  const targets: string[] = [];
  const payloads: string[] = [];
  for (const source of v1Manifest.vaults) {
    const destination = v2Manifest.vaults.find((vault) => vault.key === source.key);
    if (!destination || destination.sourceV1Vault?.toLowerCase() !== source.address.toLowerCase()) {
      throw new Error(`V1/V2 vault manifest mismatch for ${source.key}`);
    }
    const importer = new Contract(destination.address, IMPORTER_ABI, ethers.provider);
    if ((await importer.token()).toLowerCase() !== v2Manifest.contracts.token.toLowerCase()) {
      throw new Error(`V2 importer token mismatch for ${source.key}`);
    }
    if ((await importer.migrationContract()).toLowerCase() !== v2Manifest.contracts.migration.toLowerCase()) {
      throw new Error(`V2 importer migration mismatch for ${source.key}`);
    }
    targets.push(v2Manifest.contracts.migration);
    payloads.push(migrationInterface.encodeFunctionData("registerVaultPair", [source.address, destination.address]));
  }
  targets.push(v2Manifest.contracts.migration);
  payloads.push(migrationInterface.encodeFunctionData("lockVaultPairs"));

  const timelockAddress = v1Manifest.contracts.timelock;
  const timelock = new Contract(timelockAddress, TIMELOCK_ABI, ethers.provider);
  const delay = (await timelock.getMinDelay()) as bigint;
  const transactions = timelockTransactions({
    timelock: timelockAddress,
    targets,
    payloads,
    salt: id(`IROA_V2_VAULT_PAIRS:${v2Manifest.manifestHash}`),
    delay,
  });
  await writeTimelockSafeFiles({
    profile,
    safe: String(v1Manifest.controls.genesisSupplyRecipient),
    name: "IROA V1/V2 vault pair lock",
    description: "Register exactly seven verified V1/V2 vault pairs and permanently lock the pair manifest.",
    outputPrefix: `deployments/${profile}/safe-04-v2-vault-pairs`,
    transactions,
  });
}

export async function deployV2Migration(): Promise<void> {
  const profile = parseProfile(process.env.DEPLOYMENT_PROFILE);
  const v1Manifest = await readJson<DeploymentManifest>(process.env.V1_MANIFEST ?? `deployments/${profile}/v1.json`);
  verifyManifestSignature(v1Manifest);
  const { ethers } = await network.connect();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  assertProfileChain(profile, chainId);
  if (v1Manifest.profile !== profile || v1Manifest.chainId !== chainId.toString()) {
    throw new Error("V1 manifest chain mismatch");
  }

  const phase = process.env.V2_PHASE ?? "deploy";
  if (phase === "deploy") {
    await deployPhase(profile, v1Manifest);
    return;
  }
  if (phase === "register") {
    const v2Manifest = await readJson<DeploymentManifest>(
      process.env.V2_MANIFEST ?? `deployments/${profile}/v2-migration.json`,
    );
    verifyManifestSignature(v2Manifest);
    if (v2Manifest.profile !== profile || v2Manifest.chainId !== chainId.toString()) {
      throw new Error("V2 manifest chain mismatch");
    }
    await registerPhase(profile, v1Manifest, v2Manifest);
    return;
  }
  throw new Error("V2_PHASE must be deploy or register");
}

async function main(): Promise<void> {
  try {
    await deployV2Migration();
    console.log("V2 migration deployment phase completed with zero pre-migration supply.");
  } catch (error) {
    throw safeError(error);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
