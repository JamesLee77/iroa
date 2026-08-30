import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { network } from "hardhat";
import { deployV1 } from "./deploy-v1.js";
import { stableStringify } from "./deployment-common.js";
import { verifyDeployment } from "./verify-deployment.js";

function comparableManifest(manifest: Awaited<ReturnType<typeof deployV1>>) {
  return {
    profile: manifest.profile,
    chainId: manifest.chainId,
    contracts: manifest.contracts,
    vaults: manifest.vaults.map(({ key, kind, address, allocation, beneficiary }) => ({
      key,
      kind,
      address,
      allocation,
      beneficiary,
    })),
    bytecodeHashes: manifest.bytecodeHashes,
  };
}

async function main(): Promise<void> {
  const firstConnection = await network.create();
  const secondConnection = await network.create();
  const { ethers } = firstConnection;
  const signers = await ethers.getSigners();
  if (signers.length < 12) throw new Error("local deployment verification requires twelve deterministic signers");
  const latest = await ethers.provider.getBlock("latest");
  if (!latest) throw new Error("local latest block is unavailable");
  const evidenceDirectory = await mkdtemp(join(tmpdir(), "iroa-local-deploy-"));

  Object.assign(process.env, {
    DEPLOYMENT_PROFILE: "local",
    GENESIS_SAFE: signers[1].address,
    PAUSER_SAFE: signers[2].address,
    TEAM_BENEFICIARY: signers[3].address,
    INVESTOR_BENEFICIARY: signers[4].address,
    FOUNDATION_BENEFICIARY: signers[5].address,
    TREASURY: signers[6].address,
    RELEASE_MANAGER: signers[7].address,
    COMPLIANCE_SAFE: signers[8].address,
    SUSPENDER_SAFE: signers[9].address,
    ROOT_PROPOSER_SAFE: signers[10].address,
    CHALLENGER_SAFE: signers[11].address,
    VESTING_START_TIMESTAMP: String(latest.timestamp + 3_600),
  });

  process.env.DEPLOYMENT_MANIFEST = join(evidenceDirectory, "first-v1.json");
  process.env.VERIFICATION_REPORT = join(evidenceDirectory, "first-verification.json");
  try {
    const first = await deployV1(firstConnection);
    await verifyDeployment(firstConnection);

    process.env.DEPLOYMENT_MANIFEST = join(evidenceDirectory, "second-v1.json");
    process.env.VERIFICATION_REPORT = join(evidenceDirectory, "second-verification.json");
    const second = await deployV1(secondConnection);
    await verifyDeployment(secondConnection);

    const left = stableStringify(comparableManifest(first));
    const right = stableStringify(comparableManifest(second));
    if (left !== right) throw new Error("two clean local deployments produced different addresses, allocations, or bytecode hashes");
    process.stdout.write(`Two deterministic local V1 deployments verified; temporary evidence: ${evidenceDirectory}\n`);
  } finally {
    await Promise.all([firstConnection.close(), secondConnection.close()]);
  }
}

await main();
