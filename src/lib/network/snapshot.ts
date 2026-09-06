import type { Hex } from 'viem';
import { aggregateNetworkMetrics, type NetworkEvent, type NetworkMetrics, type NodeStatusCode } from './events';

/** What the page needs from a chain; the viem adapter in `client.ts` implements it. */
export interface NetworkReader {
  latestBlock(): Promise<bigint>;
  /** Decoded events of the three contracts in [fromBlock, toBlock]; timestamps may be 0. */
  events(fromBlock: bigint, toBlock: bigint): Promise<NetworkEvent[]>;
  nodeStatuses(nodeIds: readonly Hex[]): Promise<Map<Hex, NodeStatusCode>>;
  blockTimestamps(blockNumbers: readonly bigint[]): Promise<Map<bigint, number>>;
}

/** Events already scanned, kept so a poll only reads the blocks after `upTo`. */
export interface Checkpoint {
  upTo: bigint;
  events: NetworkEvent[];
}

export interface CheckpointStore {
  load(key: string): Checkpoint | null;
  save(key: string, checkpoint: Checkpoint): void;
}

export interface Snapshot {
  metrics: NetworkMetrics;
  events: NetworkEvent[];
  upTo: bigint;
  /** `full` when the scan starts at the deployment block, `window` when only recent blocks are read. */
  scope: 'full' | 'window';
}

/** Public RPCs cap a single eth_getLogs range; 10k blocks stays under every cap seen on Base. */
export const CHUNK_BLOCKS = 10_000n;
/** Without a deployment block the scan covers this many recent blocks (about a day on Base). */
export const RECENT_WINDOW_BLOCKS = 50_000n;

const serialize = (checkpoint: Checkpoint) =>
  JSON.stringify(checkpoint, (_key, value: unknown) => (typeof value === 'bigint' ? `${value.toString()}n` : value));

const revive = (text: string): Checkpoint =>
  JSON.parse(text, (_key, value: unknown) =>
    typeof value === 'string' && /^\d+n$/.test(value) ? BigInt(value.slice(0, -1)) : value,
  ) as Checkpoint;

/** A checkpoint store over Web Storage; every access is guarded because storage may be absent or full. */
export function storageCheckpointStore(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined): CheckpointStore {
  return {
    load(key) {
      try {
        const text = storage?.getItem(key);
        return text ? revive(text) : null;
      } catch {
        return null;
      }
    },
    save(key, checkpoint) {
      try {
        storage?.setItem(key, serialize(checkpoint));
      } catch {
        // A full or blocked store only costs a rescan next time.
      }
    },
  };
}

const max = (left: bigint, right: bigint) => (left > right ? left : right);
const min = (left: bigint, right: bigint) => (left < right ? left : right);

/**
 * Reads the chain up to its latest block, continuing from the checkpoint
 * when one exists, and folds the history into the page's metrics. Every
 * NODE's status is re-read on every call so a suspension shows on the
 * next poll rather than the next full scan.
 */
export async function readSnapshot(input: {
  reader: NetworkReader;
  store: CheckpointStore;
  key: string;
  deploymentBlock?: bigint;
}): Promise<Snapshot> {
  const { reader, store, key, deploymentBlock } = input;
  const latest = await reader.latestBlock();
  const scope: Snapshot['scope'] = deploymentBlock === undefined ? 'window' : 'full';
  const windowStart = max(latest - RECENT_WINDOW_BLOCKS, 0n);
  const previous = store.load(key);

  let from = previous ? previous.upTo + 1n : deploymentBlock ?? windowStart;
  if (scope === 'window' && from < windowStart) from = windowStart;
  const fresh: NetworkEvent[] = [];
  while (from <= latest) {
    const to = min(from + CHUNK_BLOCKS - 1n, latest);
    fresh.push(...(await reader.events(from, to)));
    from = to + 1n;
  }

  const blocks = [...new Set(fresh.filter((event) => !event.timestamp).map((event) => event.blockNumber))];
  const timestamps = blocks.length ? await reader.blockTimestamps(blocks) : new Map<bigint, number>();
  for (const event of fresh) {
    if (!event.timestamp) event.timestamp = timestamps.get(event.blockNumber) ?? 0;
  }

  let events = [...(previous?.events ?? []), ...fresh];
  if (scope === 'window') events = events.filter((event) => event.blockNumber >= windowStart);

  const nodeIds = [...new Set(events.filter((event) => event.kind === 'NodeRegistered').map((event) => event.nodeId))];
  const statuses = nodeIds.length ? await reader.nodeStatuses(nodeIds) : new Map<Hex, NodeStatusCode>();

  store.save(key, { upTo: latest, events });
  return { metrics: aggregateNetworkMetrics(events, statuses), events, upTo: latest, scope };
}
