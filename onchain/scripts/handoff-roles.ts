import { pathToFileURL } from "node:url";
import { Contract, id } from "ethers";
import { network } from "hardhat";
import {
  ACCESS_CONTROL_ABI,
  assertProfileChain,
  parseProfile,
  readJson,
  requireAddress,
  safeError,
  writeJsonAtomic,
  type DeploymentManifest,
} from "./deployment-common.js";

interface RoleGrant {
  label: string;
  target: string;
  role: string;
  account: string;
}

interface RoleReceipt {
  label: string;
  target: string;
  role: string;
  account: string;
  transactionHash: string | null;
  confirmed: boolean;
}

const DEFAULT_ADMIN_ROLE = `0x${"00".repeat(32)}`;
const ALLOWLIST_MANAGER_ROLE = id("ALLOWLIST_MANAGER_ROLE");
const REWARD_DISTRIBUTOR_ROLE = id("REWARD_DISTRIBUTOR_ROLE");

function desiredGrants(manifest: DeploymentManifest): RoleGrant[] {
  const timelock = requireAddress(manifest.contracts.timelock, "timelock");
  const genesisSafe = requireAddress(String(manifest.controls.genesisSupplyRecipient), "genesis Safe");
  const rewardDistributor = requireAddress(process.env.REWARD_DISTRIBUTOR, "REWARD_DISTRIBUTOR");
  const nodeVault = manifest.vaults.find((vault) => vault.key === "node");
  if (!nodeVault) throw new Error("node vault missing from manifest");

  return [
    { label: "token admin", target: manifest.contracts.token, role: DEFAULT_ADMIN_ROLE, account: timelock },
    { label: "token allowlist manager", target: manifest.contracts.token, role: ALLOWLIST_MANAGER_ROLE, account: genesisSafe },
    ...manifest.vaults
      .filter((vault) => vault.kind === "monthly")
      .map((vault) => ({
        label: `${vault.key} vault admin`,
        target: vault.address,
        role: DEFAULT_ADMIN_ROLE,
        account: timelock,
      })),
    {
      label: "node reward distributor",
      target: nodeVault.address,
      role: REWARD_DISTRIBUTOR_ROLE,
      account: rewardDistributor,
    },
  ];
}

export async function handoffRoles(): Promise<RoleReceipt[]> {
  if (process.env.ROLE_HANDOFF_ENABLED !== "true") {
    throw new Error("ROLE_HANDOFF_ENABLED=true is required for state-changing role handoff");
  }
  const profile = parseProfile(process.env.DEPLOYMENT_PROFILE);
  const manifestPath = process.env.DEPLOYMENT_MANIFEST ?? `deployments/${profile}/v1.json`;
  const manifest = await readJson<DeploymentManifest>(manifestPath);
  const { ethers } = await network.connect();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  assertProfileChain(profile, chainId);
  if (manifest.profile !== profile || manifest.chainId !== chainId.toString()) {
    throw new Error("deployment manifest chain mismatch");
  }
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  if (deployerAddress.toLowerCase() !== manifest.deployer.toLowerCase()) {
    throw new Error("connected signer is not the manifest deployer");
  }

  const grants = desiredGrants(manifest);
  const receipts: RoleReceipt[] = [];
  for (const grant of grants) {
    const contract = new Contract(grant.target, ACCESS_CONTROL_ABI, deployer);
    let transactionHash: string | null = null;
    if (!(await contract.hasRole(grant.role, grant.account))) {
      const transaction = await contract.grantRole(grant.role, grant.account);
      const receipt = await transaction.wait();
      if (!receipt || receipt.status !== 1) throw new Error(`grant failed for ${grant.label}`);
      transactionHash = receipt.hash;
    }
    const confirmed = Boolean(await contract.hasRole(grant.role, grant.account));
    receipts.push({ ...grant, transactionHash, confirmed });
  }

  const reportPath = process.env.ROLE_REPORT ?? `deployments/${profile}/role-handoff.json`;
  await writeJsonAtomic(reportPath, {
    profile,
    chainId: chainId.toString(),
    deployer: deployerAddress,
    createdAt: new Date().toISOString(),
    grants: receipts,
  });
  if (receipts.some((receipt) => !receipt.confirmed)) {
    throw new Error("role read-back failed; deployer roles were not renounced");
  }

  const renounceTargets = new Map<string, Set<string>>();
  for (const grant of grants) {
    const key = grant.target.toLowerCase();
    const roles = renounceTargets.get(key) ?? new Set<string>();
    if (grant.role === DEFAULT_ADMIN_ROLE || grant.role === ALLOWLIST_MANAGER_ROLE) roles.add(grant.role);
    renounceTargets.set(key, roles);
  }
  for (const [target, roles] of renounceTargets) {
    const contract = new Contract(target, ACCESS_CONTROL_ABI, deployer);
    for (const role of roles) {
      if (await contract.hasRole(role, deployerAddress)) {
        const transaction = await contract.renounceRole(role, deployerAddress);
        const receipt = await transaction.wait();
        if (!receipt || receipt.status !== 1) throw new Error(`renounce failed for ${target}`);
        if (await contract.hasRole(role, deployerAddress)) throw new Error(`renounce read-back failed for ${target}`);
      }
    }
  }
  return receipts;
}

async function main(): Promise<void> {
  try {
    const receipts = await handoffRoles();
    console.log(`Role handoff confirmed for ${receipts.length} grants; deployer roles were renounced after read-back.`);
  } catch (error) {
    throw safeError(error);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
