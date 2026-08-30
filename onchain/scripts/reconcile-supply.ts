import { pathToFileURL } from "node:url";
import { Contract } from "ethers";
import { network } from "hardhat";
import {
  GENESIS_SUPPLY,
  assertProfileChain,
  parseProfile,
  readJson,
  requireAddress,
  safeError,
  verifyManifestSignature,
  writeJsonAtomic,
  type DeploymentManifest,
  type VaultManifestEntry,
} from "./deployment-common.js";

const ERC20_ABI = ["function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)"];
const MIGRATION_ABI = ["function migrationBurned() view returns (uint256)", "function migrationMinted() view returns (uint256)"];
const MONTHLY_ABI = [
  "function allocation() view returns (uint256)",
  "function totalReleased() view returns (uint256)",
  "function releasableAt(uint64 timestamp) view returns (uint256)",
];
const CLIFF_ABI = [
  "function total() view returns (uint256)",
  "function released() view returns (uint256)",
  "function beneficiary() view returns (address)",
  "function releasable(address beneficiary) view returns (uint256)",
];
const LIQUIDITY_ABI = [
  "function TOTAL_ALLOCATION() view returns (uint256)",
  "function released() view returns (uint256)",
  "function releasableAt(uint64 timestamp) view returns (uint256)",
];
const IMPORTER_ABI = ["function totalImportedRemaining() view returns (uint256)"];

interface VaultBalanceReport {
  key: string;
  version: "v1" | "v2";
  address: string;
  balance: string;
  locked: string;
  claimable: string;
  backingError: string;
}

export function calculateSupplyError(v1Supply: bigint, v2Supply: bigint): bigint {
  return v1Supply + v2Supply - GENESIS_SUPPLY;
}

async function v1VaultReport(
  provider: unknown,
  token: Contract,
  vault: VaultManifestEntry,
  timestamp: bigint,
): Promise<VaultBalanceReport> {
  const balance = (await token.balanceOf(vault.address)) as bigint;
  let locked: bigint;
  let claimable: bigint;
  if (vault.kind === "monthly") {
    const contract = new Contract(vault.address, MONTHLY_ABI, provider as never);
    locked = (await contract.allocation()) - (await contract.totalReleased());
    claimable = await contract.releasableAt(timestamp);
  } else if (vault.kind === "cliff-linear") {
    const contract = new Contract(vault.address, CLIFF_ABI, provider as never);
    locked = (await contract.total()) - (await contract.released());
    claimable = await contract.releasable(await contract.beneficiary());
  } else if (vault.kind === "liquidity") {
    const contract = new Contract(vault.address, LIQUIDITY_ABI, provider as never);
    locked = (await contract.TOTAL_ALLOCATION()) - (await contract.released());
    claimable = await contract.releasableAt(timestamp);
  } else {
    throw new Error(`unsupported V1 vault kind for ${vault.key}`);
  }
  return {
    key: vault.key,
    version: "v1",
    address: vault.address,
    balance: balance.toString(),
    locked: locked.toString(),
    claimable: claimable.toString(),
    backingError: (balance - locked).toString(),
  };
}

async function v2VaultReport(provider: unknown, token: Contract, vault: VaultManifestEntry): Promise<VaultBalanceReport> {
  const balance = (await token.balanceOf(vault.address)) as bigint;
  const locked = (await new Contract(vault.address, IMPORTER_ABI, provider as never).totalImportedRemaining()) as bigint;
  return {
    key: vault.key,
    version: "v2",
    address: vault.address,
    balance: balance.toString(),
    locked: locked.toString(),
    claimable: "0",
    backingError: (balance - locked).toString(),
  };
}

export async function reconcileSupply(): Promise<Record<string, unknown>> {
  const profile = parseProfile(process.env.DEPLOYMENT_PROFILE);
  const v1Manifest = await readJson<DeploymentManifest>(
    process.env.V1_MANIFEST ?? `deployments/${profile}/v1.json`,
  );
  verifyManifestSignature(v1Manifest);
  const v2Path = process.env.V2_MANIFEST;
  const v2Manifest = v2Path ? await readJson<DeploymentManifest>(v2Path) : undefined;
  if (v2Manifest) verifyManifestSignature(v2Manifest);

  const { ethers } = await network.connect();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  assertProfileChain(profile, chainId);
  for (const manifest of [v1Manifest, ...(v2Manifest ? [v2Manifest] : [])]) {
    if (manifest.profile !== profile || manifest.chainId !== chainId.toString()) {
      throw new Error("supply reconciliation manifest chain mismatch");
    }
  }

  const v1 = new Contract(v1Manifest.contracts.token, ERC20_ABI, ethers.provider);
  const v2 = v2Manifest ? new Contract(v2Manifest.contracts.token, ERC20_ABI, ethers.provider) : undefined;
  const v1Supply = (await v1.totalSupply()) as bigint;
  const v2Supply = v2 ? ((await v2.totalSupply()) as bigint) : 0n;
  const supplyError = calculateSupplyError(v1Supply, v2Supply);
  const block = await ethers.provider.getBlock("latest");
  if (!block) throw new Error("latest block unavailable");

  const vaults: VaultBalanceReport[] = [];
  for (const vault of v1Manifest.vaults) {
    vaults.push(await v1VaultReport(ethers.provider, v1, vault, BigInt(block.timestamp)));
  }
  if (v2 && v2Manifest) {
    for (const vault of v2Manifest.vaults) vaults.push(await v2VaultReport(ethers.provider, v2, vault));
  }

  let migrationBurned = 0n;
  let migrationMinted = 0n;
  if (v2Manifest?.contracts.migration) {
    const migration = new Contract(v2Manifest.contracts.migration, MIGRATION_ABI, ethers.provider);
    migrationBurned = await migration.migrationBurned();
    migrationMinted = await migration.migrationMinted();
  }

  const participantInput = process.env.PARTICIPANT_ADDRESSES_JSON ?? "[]";
  const participantAddresses = JSON.parse(participantInput) as string[];
  const participants = await Promise.all(
    participantAddresses.map(async (entry) => {
      const address = requireAddress(entry, "participant address");
      return {
        address,
        v1Balance: ((await v1.balanceOf(address)) as bigint).toString(),
        v2Balance: v2 ? ((await v2.balanceOf(address)) as bigint).toString() : "0",
      };
    }),
  );

  const backingError = vaults.reduce((total, vault) => total + BigInt(vault.backingError), 0n);
  const pairBackingByKey = new Map<string, bigint>();
  for (const vault of vaults) {
    pairBackingByKey.set(vault.key, (pairBackingByKey.get(vault.key) ?? 0n) + BigInt(vault.backingError));
  }
  const pairBackingErrors = [...pairBackingByKey.entries()].map(([key, error]) => ({ key, error }));
  const everyVaultPairBacked = pairBackingErrors.every((error) => error.error === 0n);
  const report = {
    reconciledAt: new Date().toISOString(),
    profile,
    chainId: chainId.toString(),
    v1TotalSupply: v1Supply.toString(),
    v2TotalSupply: v2Supply.toString(),
    genesisSupply: GENESIS_SUPPLY.toString(),
    supplyError: supplyError.toString(),
    migrationBurned: migrationBurned.toString(),
    migrationMinted: migrationMinted.toString(),
    migrationCounterError: (migrationBurned - migrationMinted).toString(),
    vaultBackingError: backingError.toString(),
    vaultPairBackingErrors: pairBackingErrors.map(({ key, error }) => ({ key, error: error.toString() })),
    vaults,
    participants,
    exact: supplyError === 0n && migrationBurned === migrationMinted && everyVaultPairBacked,
  };
  const output = process.env.RECONCILIATION_REPORT ?? `deployments/${profile}/supply-reconciliation.json`;
  await writeJsonAtomic(output, report);
  if (!report.exact) throw new Error(`supply reconciliation failed; report written to ${output}`);
  return report;
}

async function main(): Promise<void> {
  try {
    const report = await reconcileSupply();
    console.log(`Supply reconciled exactly on chain ${report.chainId}`);
  } catch (error) {
    process.exitCode = 1;
    throw safeError(error);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
