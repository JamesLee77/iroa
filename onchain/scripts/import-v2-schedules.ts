import { pathToFileURL } from "node:url";
import { Contract, Interface, ZeroHash, id } from "ethers";
import { network } from "hardhat";
import {
  assertProfileChain,
  createSafeBatch,
  encodeTransaction,
  parseProfile,
  readJson,
  safeError,
  verifyManifestSignature,
  writeJsonAtomic,
  type DeploymentManifest,
} from "./deployment-common.js";

const V1_ABI = ["function enterMigrationMode(address migration)"];
const V2_ABI = ["function totalSupply() view returns (uint256)"];
const MIGRATION_ABI = [
  "function vaultPairCount() view returns (uint256)",
  "function vaultPairsLocked() view returns (bool)",
  "function v2VaultFor(address) view returns (address)",
];
const VAULT_ABI = [
  "function migrateRemaining(address migration,address v2Vault,bytes32 sourceScheduleId,bytes32 sourceBatchId)",
];
const TIMELOCK_ABI = [
  "function getMinDelay() view returns (uint256)",
  "function scheduleBatch(address[] targets,uint256[] values,bytes[] payloads,bytes32 predecessor,bytes32 salt,uint256 delay)",
  "function executeBatch(address[] targets,uint256[] values,bytes[] payloads,bytes32 predecessor,bytes32 salt)",
];

function requireApprovalGates(): void {
  const gates = ["AUDIT_MUST_FIX_CLOSED", "MIGRATION_REHEARSAL_PASSED", "V2_OPERATIONS_APPROVED"];
  const missing = gates.filter((gate) => process.env[gate] !== "true");
  if (missing.length > 0) throw new Error(`irreversible migration batch withheld; missing gates: ${missing.join(", ")}`);
}

export async function prepareV2ScheduleImports(): Promise<void> {
  requireApprovalGates();
  const profile = parseProfile(process.env.DEPLOYMENT_PROFILE);
  const v1 = await readJson<DeploymentManifest>(process.env.V1_MANIFEST ?? `deployments/${profile}/v1.json`);
  const v2 = await readJson<DeploymentManifest>(
    process.env.V2_MANIFEST ?? `deployments/${profile}/v2-migration.json`,
  );
  verifyManifestSignature(v1);
  verifyManifestSignature(v2);
  const { ethers } = await network.connect();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  assertProfileChain(profile, chainId);
  if ([v1, v2].some((manifest) => manifest.profile !== profile || manifest.chainId !== chainId.toString())) {
    throw new Error("migration manifests do not match the connected chain");
  }

  const v2Token = new Contract(v2.contracts.token, V2_ABI, ethers.provider);
  const migration = new Contract(v2.contracts.migration, MIGRATION_ABI, ethers.provider);
  if ((await v2Token.totalSupply()) !== 0n) throw new Error("V2 supply must be zero before V1 migration mode entry");
  if (!(await migration.vaultPairsLocked()) || (await migration.vaultPairCount()) !== 7n) {
    throw new Error("exactly seven V1/V2 vault pairs must be locked first");
  }
  for (const source of v1.vaults) {
    const destination = v2.vaults.find((vault) => vault.key === source.key);
    if (!destination) throw new Error(`missing V2 vault for ${source.key}`);
    const mapped = (await migration.v2VaultFor(source.address)) as string;
    if (mapped.toLowerCase() !== destination.address.toLowerCase()) {
      throw new Error(`on-chain vault pair read-back mismatch for ${source.key}`);
    }
  }

  const timelock = new Contract(v1.contracts.timelock, TIMELOCK_ABI, ethers.provider);
  const delay = (await timelock.getMinDelay()) as bigint;
  const v1Interface = new Interface(V1_ABI);
  const targets = [v1.contracts.token];
  const values = [0n];
  const payloads = [v1Interface.encodeFunctionData("enterMigrationMode", [v2.contracts.migration])];
  const salt = id(`IROA_V1_ENTER_MIGRATION:${v2.manifestHash}`);
  const timelockInterface = new Interface(TIMELOCK_ABI);
  const safe = String(v1.controls.genesisSupplyRecipient);
  const schedule = encodeTransaction(v1.contracts.timelock, timelockInterface, "scheduleBatch", [
    targets,
    values,
    payloads,
    ZeroHash,
    salt,
    delay,
  ]);
  const execute = encodeTransaction(v1.contracts.timelock, timelockInterface, "executeBatch", [
    targets,
    values,
    payloads,
    ZeroHash,
    salt,
  ]);
  await writeJsonAtomic(
    `deployments/${profile}/safe-05-v1-enter-migration-schedule.json`,
    createSafeBatch({
      profile,
      safe,
      name: "IROA V1 irreversible migration mode — schedule",
      description: "Schedule V1 migration-only mode after audit, rehearsal, and V2 operations approval.",
      transactions: [schedule],
    }),
  );
  await writeJsonAtomic(
    `deployments/${profile}/safe-05-v1-enter-migration-execute.json`,
    createSafeBatch({
      profile,
      safe,
      name: "IROA V1 irreversible migration mode — execute",
      description: "Irreversible: execute only after a fresh zero-supply and seven-pair read-back.",
      transactions: [execute],
    }),
  );

  const vaultInterface = new Interface(VAULT_ABI);
  const callPlan = v1.vaults.map((source) => {
    const destination = v2.vaults.find((vault) => vault.key === source.key)!;
    const requiredCaller =
      source.kind === "monthly"
        ? v1.contracts.timelock
        : source.beneficiary ?? (() => { throw new Error(`beneficiary missing for ${source.key}`); })();
    const sourceScheduleId = id(`IROA:${v1.manifestHash}:${source.key}:schedule`);
    const sourceBatchId = id(`IROA:${v1.manifestHash}:${source.key}:batch`);
    return {
      key: source.key,
      requiredCaller,
      v1Vault: source.address,
      v2Vault: destination.address,
      sourceScheduleId,
      sourceBatchId,
      data: vaultInterface.encodeFunctionData("migrateRemaining", [
        v2.contracts.migration,
        destination.address,
        sourceScheduleId,
        sourceBatchId,
      ]),
    };
  });
  await writeJsonAtomic(`deployments/${profile}/v2-schedule-import-plan.json`, {
    createdAt: new Date().toISOString(),
    chainId: chainId.toString(),
    v1ManifestHash: v1.manifestHash,
    v2ManifestHash: v2.manifestHash,
    prerequisite: "Execute only after V1 migration mode read-back confirms the bound migration contract.",
    calls: callPlan,
  });
}

async function main(): Promise<void> {
  try {
    await prepareV2ScheduleImports();
    console.log("Irreversible V1 migration proposal and seven-vault schedule import plan written.");
  } catch (error) {
    throw safeError(error);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
