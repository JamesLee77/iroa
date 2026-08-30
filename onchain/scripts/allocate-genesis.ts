import { pathToFileURL } from "node:url";
import { Contract, Interface } from "ethers";
import { network } from "hardhat";
import {
  ALLOCATIONS,
  GENESIS_SUPPLY,
  assertAllocationPlan,
  assertProfileChain,
  assertUniqueAddresses,
  createSafeBatch,
  encodeTransaction,
  parseProfile,
  readJson,
  requireAddress,
  safeError,
  verifyManifestSignature,
  writeJsonAtomic,
  type DeploymentManifest,
} from "./deployment-common.js";

const TOKEN_ABI = [
  "function setAllowed(address account,bool allowed)",
  "function isAllowed(address account) view returns (bool)",
  "function ALLOWLIST_MANAGER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role,address account) view returns (bool)",
  "function transfer(address recipient,uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
] as const;

export async function buildGenesisBatches(): Promise<{ allowlistPath: string; allocationPath?: string }> {
  const profile = parseProfile(process.env.DEPLOYMENT_PROFILE);
  const manifestPath = process.env.DEPLOYMENT_MANIFEST ?? `deployments/${profile}/v1.json`;
  const manifest = await readJson<DeploymentManifest>(manifestPath);
  verifyManifestSignature(manifest);
  const { ethers } = await network.connect();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  assertProfileChain(profile, chainId);
  if (manifest.release !== "v1" || manifest.profile !== profile || manifest.chainId !== chainId.toString()) {
    throw new Error("V1 manifest does not match the selected deployment profile");
  }

  const safe = requireAddress(String(manifest.controls.genesisSupplyRecipient), "genesis Safe");
  const tokenAddress = requireAddress(manifest.contracts.token, "V1 token");
  assertAllocationPlan();
  if (manifest.vaults.length !== ALLOCATIONS.length) throw new Error("manifest must contain exactly seven vaults");
  assertUniqueAddresses(manifest.vaults);

  for (const allocation of ALLOCATIONS) {
    const vault = manifest.vaults.find((entry) => entry.key === allocation.key);
    if (!vault || BigInt(vault.allocation) !== allocation.amount) {
      throw new Error(`manifest allocation mismatch for ${allocation.key}`);
    }
  }

  const tokenInterface = new Interface(TOKEN_ABI);
  const allowlistAccounts = [safe, ...manifest.vaults.map((vault) => vault.address)];
  const token = new Contract(tokenAddress, TOKEN_ABI, ethers.provider);
  const ALLOWLIST_MANAGER_ROLE = (await token.ALLOWLIST_MANAGER_ROLE()) as string;
  if (!(await token.hasRole(ALLOWLIST_MANAGER_ROLE, safe))) {
    throw new Error("Genesis Safe does not hold ALLOWLIST_MANAGER_ROLE; role handoff must complete first");
  }
  const allowlistBatch = createSafeBatch({
    profile,
    safe,
    name: "IROA V1 allowlist",
    description: "Allowlist the Genesis Safe and exactly seven allocation vaults before allocation.",
    transactions: allowlistAccounts.map((account) =>
      encodeTransaction(tokenAddress, tokenInterface, "setAllowed", [account, true]),
    ),
  });
  const allowlistPath = process.env.ALLOWLIST_BATCH ?? `deployments/${profile}/safe-01-allowlist.json`;
  await writeJsonAtomic(allowlistPath, allowlistBatch);

  const readBack = await Promise.all(allowlistAccounts.map((account) => token.isAllowed(account) as Promise<boolean>));
  if (readBack.some((allowed) => !allowed)) {
    return { allowlistPath };
  }
  if ((await token.balanceOf(safe)) !== GENESIS_SUPPLY) {
    throw new Error("Genesis Safe balance must equal the full genesis supply before allocation");
  }

  const allocationBatch = createSafeBatch({
    profile,
    safe,
    name: "IROA V1 genesis allocation",
    description: "Transfer the exact 10 billion IROA genesis supply into the seven verified vaults.",
    transactions: ALLOCATIONS.map((allocation) => {
      const vault = manifest.vaults.find((entry) => entry.key === allocation.key)!;
      return encodeTransaction(tokenAddress, tokenInterface, "transfer", [vault.address, allocation.amount]);
    }),
  });
  const allocationPath = process.env.ALLOCATION_BATCH ?? `deployments/${profile}/safe-02-allocation.json`;
  await writeJsonAtomic(allocationPath, allocationBatch);
  return { allowlistPath, allocationPath };
}

async function main(): Promise<void> {
  try {
    const result = await buildGenesisBatches();
    if (!result.allocationPath) {
      console.log(`Allowlist batch written to ${result.allowlistPath}; allocation is withheld until on-chain read-back passes.`);
      return;
    }
    console.log(`Verified allowlist and wrote allocation batch to ${result.allocationPath}`);
  } catch (error) {
    throw safeError(error);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
