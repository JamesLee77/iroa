import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  AbiCoder,
  Contract,
  Interface,
  Signature,
  getAddress,
  getBytes,
  isAddress,
  keccak256,
  parseEther,
  toUtf8Bytes,
  verifyMessage,
  type Signer,
} from "ethers";

export const GENESIS_SUPPLY = parseEther("10000000000");
export const REQUIRED_VAULTS = 7;

export const PROFILES = {
  local: { chainId: 31337n, safeChainId: "31337" },
  "base-sepolia": { chainId: 84532n, safeChainId: "84532" },
  "base-mainnet": { chainId: 8453n, safeChainId: "8453" },
} as const;

export type DeploymentProfile = keyof typeof PROFILES;
export type VaultKey = "node" | "ecosystem" | "research" | "team" | "investor" | "foundation" | "liquidity";

export const ALLOCATIONS: ReadonlyArray<{
  key: VaultKey;
  label: string;
  amount: bigint;
  kind: "monthly" | "cliff-linear" | "liquidity";
}> = [
  { key: "node", label: "NODE", amount: parseEther("2500000000"), kind: "monthly" },
  { key: "ecosystem", label: "Ecosystem", amount: parseEther("2300000000"), kind: "monthly" },
  { key: "research", label: "Research and Development", amount: parseEther("1500000000"), kind: "monthly" },
  { key: "team", label: "Team and Advisors", amount: parseEther("1500000000"), kind: "cliff-linear" },
  { key: "investor", label: "Initial Investors", amount: parseEther("1000000000"), kind: "cliff-linear" },
  { key: "foundation", label: "Foundation", amount: parseEther("700000000"), kind: "cliff-linear" },
  { key: "liquidity", label: "Liquidity Operations", amount: parseEther("500000000"), kind: "liquidity" },
] as const;

export const ANNUAL_WEIGHTS = {
  node: [15, 13, 12, 11, 10, 9, 8, 7, 5, 4, 3, 3],
  ecosystem: [12, 12, 11, 11, 10, 10, 9, 9, 8, 8],
  research: [12, 12, 12, 12, 12, 10, 10, 8, 6, 6],
} as const;

export interface VaultManifestEntry {
  key: VaultKey;
  label: string;
  kind: "monthly" | "cliff-linear" | "liquidity" | "v2-vault";
  address: string;
  allocation: string;
  beneficiary?: string;
  sourceV1Vault?: string;
}

export interface DeploymentManifest {
  schemaVersion: 1;
  release: "v1" | "v2-migration";
  profile: DeploymentProfile;
  chainId: string;
  createdAt: string;
  deployer: string;
  contracts: Record<string, string>;
  vaults: VaultManifestEntry[];
  bytecodeHashes: Record<string, string>;
  controls: Record<string, boolean | string>;
  manifestHash: string;
  signer: string;
  signature: string;
}

export interface SafeTransaction {
  to: string;
  value: "0";
  data: string;
  contractMethod: null;
  contractInputsValues: null;
}

export interface SafeBatch {
  version: "1.0";
  chainId: string;
  createdAt: number;
  meta: {
    name: string;
    description: string;
    txBuilderVersion: "1.18.0";
    createdFromSafeAddress: string;
    checksum: string;
  };
  transactions: SafeTransaction[];
}

export function parseProfile(value: string | undefined): DeploymentProfile {
  if (!value || !(value in PROFILES)) {
    throw new Error("DEPLOYMENT_PROFILE must be local, base-sepolia, or base-mainnet");
  }
  return value as DeploymentProfile;
}

export function assertProfileChain(profile: DeploymentProfile, actualChainId: bigint): void {
  const expected = PROFILES[profile].chainId;
  if (actualChainId !== expected) {
    throw new Error(`deployment profile chain mismatch: expected ${expected}, received ${actualChainId}`);
  }
}

export function requireAddress(value: string | undefined, name: string): string {
  if (!value || !isAddress(value)) throw new Error(`${name} must be a valid address`);
  const address = getAddress(value);
  if (address === "0x0000000000000000000000000000000000000000") {
    throw new Error(`${name} must not be the zero address`);
  }
  return address;
}

export function assertUniqueAddresses(entries: ReadonlyArray<{ key: string; address: string }>): void {
  const seen = new Map<string, string>();
  for (const entry of entries) {
    const normalized = requireAddress(entry.address, entry.key).toLowerCase();
    const previous = seen.get(normalized);
    if (previous) throw new Error(`duplicate address for ${previous} and ${entry.key}`);
    seen.set(normalized, entry.key);
  }
}

export function assertAllocationPlan(entries = ALLOCATIONS): void {
  if (entries.length !== REQUIRED_VAULTS) throw new Error(`exactly ${REQUIRED_VAULTS} vaults are required`);
  const sum = entries.reduce((total, entry) => total + entry.amount, 0n);
  if (sum !== GENESIS_SUPPLY) throw new Error(`allocation mismatch: ${sum} != ${GENESIS_SUPPLY}`);
}

export function assertRoleHandoffComplete(receipts: ReadonlyArray<{ confirmed: boolean }>, expectedCount: number): void {
  if (receipts.length !== expectedCount || receipts.some((receipt) => !receipt.confirmed)) {
    throw new Error("role handoff is incomplete; deployer renounce is forbidden");
  }
}

export function assertV2MigrationReadiness(args: {
  expectedMigration: string;
  actualMigration: string;
  authorityLocked: boolean;
  pairCount: bigint;
  pairsLocked: boolean;
  totalSupply: bigint;
}): void {
  if (requireAddress(args.actualMigration, "V2 migration binding") !== requireAddress(args.expectedMigration, "migration")) {
    throw new Error("V2 migration binding changed");
  }
  if (!args.authorityLocked) throw new Error("V2 migration authority lock is missing");
  if (args.pairCount !== BigInt(REQUIRED_VAULTS) || !args.pairsLocked) {
    throw new Error("V1/V2 vault pair lock is incomplete");
  }
  if (args.totalSupply !== 0n) throw new Error("V2 pre-migration supply must be zero");
}

export function encodeTransaction(to: string, iface: Interface, method: string, values: readonly unknown[]): SafeTransaction {
  return {
    to: requireAddress(to, "transaction target"),
    value: "0",
    data: iface.encodeFunctionData(method, [...values]),
    contractMethod: null,
    contractInputsValues: null,
  };
}

export function createSafeBatch(args: {
  profile: DeploymentProfile;
  safe: string;
  name: string;
  description: string;
  transactions: SafeTransaction[];
  createdAt?: number;
}): SafeBatch {
  if (args.transactions.length === 0) throw new Error("Safe batch must contain at least one transaction");
  const safe = requireAddress(args.safe, "Safe address");
  const createdAt = args.createdAt ?? Date.now();
  const checksum = keccak256(
    toUtf8Bytes(stableStringify({ chainId: PROFILES[args.profile].safeChainId, safe, transactions: args.transactions })),
  );
  return {
    version: "1.0",
    chainId: PROFILES[args.profile].safeChainId,
    createdAt,
    meta: {
      name: args.name,
      description: args.description,
      txBuilderVersion: "1.18.0",
      createdFromSafeAddress: safe,
      checksum,
    },
    transactions: args.transactions,
  };
}

export function stableStringify(value: unknown): string {
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function manifestPayloadHash(manifest: Omit<DeploymentManifest, "manifestHash" | "signer" | "signature">): string {
  return keccak256(toUtf8Bytes(stableStringify(manifest)));
}

export async function signManifest(
  unsigned: Omit<DeploymentManifest, "manifestHash" | "signer" | "signature">,
  signer: Signer,
): Promise<DeploymentManifest> {
  const manifestHash = manifestPayloadHash(unsigned);
  const signerAddress = getAddress(await signer.getAddress());
  const signature = Signature.from(await signer.signMessage(getBytes(manifestHash))).serialized;
  return { ...unsigned, manifestHash, signer: signerAddress, signature };
}

export function verifyManifestSignature(manifest: DeploymentManifest): void {
  const { manifestHash, signer, signature, ...unsigned } = manifest;
  const actualHash = manifestPayloadHash(unsigned);
  if (actualHash !== manifestHash) throw new Error("deployment manifest hash mismatch");
  const recovered = getAddress(verifyMessage(getBytes(manifestHash), signature));
  if (recovered !== getAddress(signer) || recovered !== getAddress(manifest.deployer)) {
    throw new Error("deployment manifest signature mismatch");
  }
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const target = resolve(path);
  const temporary = `${target}.${process.pid}.tmp`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as T;
}

export async function deployedBytecodeHash(provider: { getCode(address: string): Promise<string> }, address: string): Promise<string> {
  const code = await provider.getCode(requireAddress(address, "contract address"));
  if (code === "0x") throw new Error(`no deployed bytecode at ${address}`);
  return keccak256(code);
}

export function redactSecrets(input: string): string {
  return input
    .replace(/https?:\/\/[^\s"']+/gi, "[REDACTED_RPC_URL]")
    .replace(/\b0x[0-9a-fA-F]{64}\b/g, "[REDACTED_PRIVATE_KEY]")
    .replace(/\b(?:api[_-]?key|secret|token|private[_-]?key)\s*[=:]\s*[^\s,;]+/gi, "[REDACTED_SECRET]");
}

export function safeError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(redactSecrets(message));
}

export async function assertCodeHashes(
  provider: { getCode(address: string): Promise<string> },
  expected: Record<string, string>,
  addresses: Record<string, string>,
): Promise<void> {
  for (const [name, expectedHash] of Object.entries(expected)) {
    const address = addresses[name];
    if (!address) throw new Error(`manifest is missing ${name}`);
    const actual = await deployedBytecodeHash(provider, address);
    if (actual !== expectedHash) throw new Error(`${name} bytecode hash mismatch`);
  }
}

export const ACCESS_CONTROL_ABI = [
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role,address account) view returns (bool)",
  "function grantRole(bytes32 role,address account)",
  "function renounceRole(bytes32 role,address callerConfirmation)",
] as const;

export async function readRole(provider: unknown, target: string, role: string, account: string): Promise<boolean> {
  const contract = new Contract(target, ACCESS_CONTROL_ABI, provider as never);
  return contract.hasRole(role, account) as Promise<boolean>;
}

// Makes ABI encoding availability explicit for downstream audit tools.
export const abiCoder = AbiCoder.defaultAbiCoder();
