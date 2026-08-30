import { pathToFileURL } from "node:url";
import { Contract } from "ethers";
import { network } from "hardhat";
import {
  ALLOCATIONS,
  GENESIS_SUPPLY,
  assertCodeHashes,
  assertProfileChain,
  assertUniqueAddresses,
  parseProfile,
  readJson,
  safeError,
  verifyManifestSignature,
  writeJsonAtomic,
  type DeploymentManifest,
} from "./deployment-common.js";

const TOKEN_ABI = [
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function migrationContract() view returns (address)",
] as const;
const ALLOCATION_ABI = ["function allocation() view returns (uint256)"] as const;
const TOTAL_ABI = ["function total() view returns (uint256)"] as const;
const LIQUIDITY_ABI = ["function TOTAL_ALLOCATION() view returns (uint256)"] as const;

export async function verifyDeployment(): Promise<Record<string, unknown>> {
  const profile = parseProfile(process.env.DEPLOYMENT_PROFILE);
  const manifestPath = process.env.DEPLOYMENT_MANIFEST ?? `deployments/${profile}/v1.json`;
  const manifest = await readJson<DeploymentManifest>(manifestPath);
  verifyManifestSignature(manifest);

  const { ethers } = await network.connect();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  assertProfileChain(profile, chainId);
  if (manifest.profile !== profile || manifest.chainId !== chainId.toString()) {
    throw new Error("manifest profile or chain does not match the connected network");
  }
  if (manifest.vaults.length !== 7) throw new Error("manifest must contain exactly seven vaults");
  assertUniqueAddresses(manifest.vaults);

  const addresses: Record<string, string> = { ...manifest.contracts };
  for (const vault of manifest.vaults) addresses[`vault:${vault.key}`] = vault.address;
  await assertCodeHashes(ethers.provider, manifest.bytecodeHashes, addresses);

  const token = new Contract(manifest.contracts.token, TOKEN_ABI, ethers.provider);
  const totalSupply = (await token.totalSupply()) as bigint;
  if (manifest.release === "v1" && totalSupply !== GENESIS_SUPPLY) {
    throw new Error(`V1 supply mismatch: ${totalSupply}`);
  }
  if (manifest.release === "v2-migration" && totalSupply !== 0n) {
    throw new Error(`V2 must have zero supply before migration: ${totalSupply}`);
  }

  const vaultChecks: Array<Record<string, unknown>> = [];
  for (const expected of ALLOCATIONS) {
    const vault = manifest.vaults.find((entry) => entry.key === expected.key);
    if (!vault || BigInt(vault.allocation) !== expected.amount) {
      throw new Error(`vault manifest mismatch for ${expected.key}`);
    }
    let configured: bigint;
    if (vault.kind === "monthly") {
      configured = (await new Contract(vault.address, ALLOCATION_ABI, ethers.provider).allocation()) as bigint;
    } else if (vault.kind === "cliff-linear") {
      configured = (await new Contract(vault.address, TOTAL_ABI, ethers.provider).total()) as bigint;
    } else if (vault.kind === "liquidity") {
      configured = (await new Contract(vault.address, LIQUIDITY_ABI, ethers.provider).TOTAL_ALLOCATION()) as bigint;
    } else {
      configured = expected.amount;
    }
    if (configured !== expected.amount) throw new Error(`on-chain allocation mismatch for ${expected.key}`);
    vaultChecks.push({ key: expected.key, address: vault.address, configured: configured.toString() });
  }

  const report = {
    verifiedAt: new Date().toISOString(),
    profile,
    chainId: chainId.toString(),
    release: manifest.release,
    manifestHash: manifest.manifestHash,
    bytecodeHashesVerified: true,
    totalSupply: totalSupply.toString(),
    vaults: vaultChecks,
  };
  const output = process.env.VERIFICATION_REPORT ?? `deployments/${profile}/verification-${manifest.release}.json`;
  await writeJsonAtomic(output, report);
  return report;
}

async function main(): Promise<void> {
  try {
    const report = await verifyDeployment();
    console.log(`Deployment verified on chain ${report.chainId}`);
  } catch (error) {
    throw safeError(error);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
