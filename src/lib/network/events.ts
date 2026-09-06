import type { Hex } from 'viem';

/**
 * The five events the public network state reads, copied from the pilot
 * contracts (`onchain/contracts/node/IROANodeRegistry.sol`,
 * `settlement/IROAReceiptRootRegistry.sol`, `settlement/IROARewardDistributor.sol`).
 * Only the fields the page prints are decoded; wallets and amounts are read
 * from the chain but never rendered.
 */
export const NODE_REGISTRY_EVENTS = [
  {
    type: 'event',
    name: 'NodeRegistered',
    inputs: [
      { name: 'nodeId', type: 'bytes32', indexed: true },
      { name: 'operatorWallet', type: 'address', indexed: true },
      { name: 'operatorIdHash', type: 'bytes32', indexed: true },
      { name: 'deviceKeyHash', type: 'bytes32', indexed: false },
      { name: 'trustLevel', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'NodeStatusChanged',
    inputs: [
      { name: 'nodeId', type: 'bytes32', indexed: true },
      { name: 'previousStatus', type: 'uint8', indexed: true },
      { name: 'newStatus', type: 'uint8', indexed: true },
    ],
  },
] as const;

export const ROOT_REGISTRY_EVENTS = [
  {
    type: 'event',
    name: 'RootProposed',
    inputs: [
      { name: 'epoch', type: 'uint256', indexed: true },
      { name: 'revision', type: 'uint32', indexed: true },
      { name: 'rewardRoot', type: 'bytes32', indexed: true },
      { name: 'receiptBatchRoot', type: 'bytes32', indexed: false },
      { name: 'policyVersionHash', type: 'bytes32', indexed: false },
      { name: 'challengeDeadline', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RootFinalized',
    inputs: [
      { name: 'epoch', type: 'uint256', indexed: true },
      { name: 'revision', type: 'uint32', indexed: true },
      { name: 'rewardRoot', type: 'bytes32', indexed: true },
    ],
  },
] as const;

export const REWARD_DISTRIBUTOR_EVENTS = [
  {
    type: 'event',
    name: 'RewardClaimed',
    inputs: [
      { name: 'epoch', type: 'uint64', indexed: true },
      { name: 'operatorIdHash', type: 'bytes32', indexed: true },
      { name: 'nodeId', type: 'bytes32', indexed: true },
      { name: 'operatorWallet', type: 'address', indexed: false },
      { name: 'score', type: 'uint256', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'leafHash', type: 'bytes32', indexed: false },
      { name: 'rootRevision', type: 'uint32', indexed: false },
    ],
  },
] as const;

export const NODE_STATUS_ABI = [
  {
    type: 'function',
    name: 'nodeStatus',
    stateMutability: 'view',
    inputs: [{ name: 'nodeId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

/** `IROANodeRegistry.NodeStatus` enum order. */
export const NODE_STATUS = { Pending: 0, Active: 1, Suspended: 2, Revoked: 3 } as const;
export type NodeStatusCode = (typeof NODE_STATUS)[keyof typeof NODE_STATUS];

/** Registry trust levels run N0–N3; N4 is the person's own device, never a registered NODE. */
export type RegistryTrustLevel = 0 | 1 | 2 | 3;

interface EventBase {
  blockNumber: bigint;
  logIndex: number;
  transactionHash: Hex;
  /** Unix seconds of the block, filled in after the block is fetched. */
  timestamp: number;
}

export type NetworkEvent =
  | (EventBase & { kind: 'NodeRegistered'; nodeId: Hex; trustLevel: RegistryTrustLevel })
  | (EventBase & { kind: 'NodeStatusChanged'; nodeId: Hex; previousStatus: NodeStatusCode; newStatus: NodeStatusCode })
  | (EventBase & { kind: 'RootProposed'; epoch: bigint; revision: number })
  | (EventBase & { kind: 'RootFinalized'; epoch: bigint; revision: number })
  | (EventBase & { kind: 'RewardClaimed'; epoch: bigint; nodeId: Hex });

export interface NetworkMetrics {
  activeNodes: number;
  /** Active NODEs per registry trust level. */
  trustMix: Record<RegistryTrustLevel, number>;
  finalizedEpochs: number;
  /** Unix seconds of the latest RootFinalized, or null before the first one. */
  lastRootAt: number | null;
  claims: number;
}

/** Newest first: higher block, then higher log index. */
export function byNewest(left: NetworkEvent, right: NetworkEvent): number {
  if (left.blockNumber !== right.blockNumber) return left.blockNumber > right.blockNumber ? -1 : 1;
  return right.logIndex - left.logIndex;
}

/**
 * Folds the event history and the registry's current answer for each node
 * into the five figures the page prints. Only nodes the registry reports as
 * Active are counted; registration alone never moves a number.
 */
export function aggregateNetworkMetrics(
  events: readonly NetworkEvent[],
  statuses: ReadonlyMap<Hex, NodeStatusCode>,
): NetworkMetrics {
  const trustMix: Record<RegistryTrustLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const finalized = new Set<string>();
  let lastRootAt: number | null = null;
  let claims = 0;
  let activeNodes = 0;

  for (const event of events) {
    switch (event.kind) {
      case 'NodeRegistered':
        if (statuses.get(event.nodeId) === NODE_STATUS.Active) {
          activeNodes += 1;
          trustMix[event.trustLevel] += 1;
        }
        break;
      case 'RootFinalized':
        finalized.add(event.epoch.toString());
        if (lastRootAt === null || event.timestamp > lastRootAt) lastRootAt = event.timestamp;
        break;
      case 'RewardClaimed':
        claims += 1;
        break;
      default:
        break;
    }
  }

  return { activeNodes, trustMix, finalizedEpochs: finalized.size, lastRootAt, claims };
}
