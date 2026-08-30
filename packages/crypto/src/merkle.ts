import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { RewardLeafSchema, type Hex32, type RewardLeaf } from '@iroa/protocol';
import { encodeAbiParameters, keccak256, parseAbiParameters } from 'viem';

const REWARD_LEAF_TYPES = [
  'uint64',
  'bytes32',
  'bytes32',
  'uint256',
  'uint256',
  'bytes32',
  'string',
  'bytes32',
] as const;

const REWARD_LEAF_ABI = parseAbiParameters(
  'uint64 epoch, bytes32 operatorIdHash, bytes32 nodeId, uint256 score, uint256 rewardAmount, bytes32 receiptBatchRoot, string policyVersion, bytes32 claimNonce',
);

type RewardLeafValue = [string, string, string, string, string, string, string, string];

export type RewardClaim = {
  leaf: RewardLeaf;
  leafHash: Hex32;
  proof: Hex32[];
};

export type RewardTree = {
  root: Hex32;
  claims: RewardClaim[];
};

function rewardLeafValue(input: RewardLeaf): RewardLeafValue {
  const leaf = RewardLeafSchema.parse(input);
  return [
    leaf.epoch.toString(10),
    leaf.operatorIdHash,
    leaf.nodeId,
    leaf.score,
    leaf.rewardAmount,
    leaf.receiptBatchRoot,
    leaf.policyVersion,
    leaf.claimNonce,
  ];
}

export function rewardLeafHash(input: RewardLeaf): Hex32 {
  const leaf = RewardLeafSchema.parse(input);
  const innerHash = keccak256(
    encodeAbiParameters(REWARD_LEAF_ABI, [
      BigInt(leaf.epoch),
      leaf.operatorIdHash,
      leaf.nodeId,
      BigInt(leaf.score),
      BigInt(leaf.rewardAmount),
      leaf.receiptBatchRoot,
      leaf.policyVersion,
      leaf.claimNonce,
    ]),
  );
  return keccak256(innerHash) as Hex32;
}

export function buildRewardTree(inputs: readonly RewardLeaf[]): RewardTree {
  if (inputs.length === 0) {
    throw new Error('A reward tree requires at least one leaf');
  }

  const parsedLeaves = inputs.map((input) => RewardLeafSchema.parse(input));
  const leafByHash = new Map<string, RewardLeaf>();
  for (const leaf of parsedLeaves) {
    const hash = rewardLeafHash(leaf);
    if (leafByHash.has(hash)) {
      throw new Error(`Duplicate reward leaf ${hash}`);
    }
    leafByHash.set(hash, leaf);
  }

  const tree = StandardMerkleTree.of(
    parsedLeaves.map(rewardLeafValue),
    [...REWARD_LEAF_TYPES],
  );
  const claims: RewardClaim[] = [];

  for (const [index, value] of tree.entries()) {
    const leaf = RewardLeafSchema.parse({
      epoch: Number(value[0]),
      operatorIdHash: value[1],
      nodeId: value[2],
      score: value[3],
      rewardAmount: value[4],
      receiptBatchRoot: value[5],
      policyVersion: value[6],
      claimNonce: value[7],
    });
    claims.push({
      leaf,
      leafHash: rewardLeafHash(leaf),
      proof: tree.getProof(index) as Hex32[],
    });
  }

  claims.sort((left, right) => left.leafHash.localeCompare(right.leafHash));
  return { root: tree.root as Hex32, claims };
}

export function verifyRewardProof(root: Hex32, leaf: RewardLeaf, proof: readonly Hex32[]): boolean {
  return StandardMerkleTree.verify(
    root,
    [...REWARD_LEAF_TYPES],
    rewardLeafValue(leaf),
    [...proof],
  );
}
