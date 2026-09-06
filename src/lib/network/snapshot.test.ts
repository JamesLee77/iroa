import { describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';
import { NODE_STATUS, type NetworkEvent, type NodeStatusCode } from './events';
import { CHUNK_BLOCKS, RECENT_WINDOW_BLOCKS, readSnapshot, storageCheckpointStore, type CheckpointStore, type NetworkReader } from './snapshot';

const id = (fill: string) => `0x${fill.repeat(64)}` as Hex;
const tx = id('f');

function memoryStore(): CheckpointStore & { saved: Map<string, unknown> } {
  const saved = new Map<string, unknown>();
  return {
    saved,
    load: (key) => (saved.get(key) as never) ?? null,
    save: (key, checkpoint) => saved.set(key, checkpoint),
  };
}

function fakeReader(input: { latest: bigint; events: NetworkEvent[]; statuses?: Map<Hex, NodeStatusCode> }) {
  const ranges: Array<[bigint, bigint]> = [];
  const reader: NetworkReader = {
    latestBlock: async () => input.latest,
    events: async (from, to) => {
      ranges.push([from, to]);
      return input.events.filter((event) => event.blockNumber >= from && event.blockNumber <= to).map((event) => ({ ...event }));
    },
    nodeStatuses: async () => input.statuses ?? new Map(),
    blockTimestamps: async (blocks) => new Map(blocks.map((block) => [block, Number(block) * 10])),
  };
  return { reader, ranges };
}

const registered = (nodeId: Hex, blockNumber: bigint): NetworkEvent => ({
  kind: 'NodeRegistered', nodeId, trustLevel: 1, blockNumber, logIndex: 0, transactionHash: tx, timestamp: 0,
});

describe('network snapshot', () => {
  it('scans from the deployment block in chunks a public RPC accepts', async () => {
    const { reader, ranges } = fakeReader({ latest: 25_000n, events: [] });
    const snapshot = await readSnapshot({ reader, store: memoryStore(), key: 'k', deploymentBlock: 100n });
    expect(snapshot.scope).toBe('full');
    expect(ranges).toEqual([[100n, 100n + CHUNK_BLOCKS - 1n], [100n + CHUNK_BLOCKS, 100n + 2n * CHUNK_BLOCKS - 1n], [100n + 2n * CHUNK_BLOCKS, 25_000n]]);
  });

  it('reads only the recent window when the manifest names no deployment block', async () => {
    const { reader, ranges } = fakeReader({ latest: 200_000n, events: [] });
    const snapshot = await readSnapshot({ reader, store: memoryStore(), key: 'k' });
    expect(snapshot.scope).toBe('window');
    expect(ranges[0][0]).toBe(200_000n - RECENT_WINDOW_BLOCKS);
  });

  it('continues from the checkpoint on the next poll and re-reads every node status', async () => {
    const store = memoryStore();
    const first = fakeReader({ latest: 1_000n, events: [registered(id('1'), 500n)], statuses: new Map([[id('1'), NODE_STATUS.Pending]]) });
    const before = await readSnapshot({ reader: first.reader, store, key: 'k', deploymentBlock: 0n });
    expect(before.metrics.activeNodes).toBe(0);

    const second = fakeReader({ latest: 1_200n, events: [registered(id('1'), 500n)], statuses: new Map([[id('1'), NODE_STATUS.Active]]) });
    const statusSpy = vi.spyOn(second.reader, 'nodeStatuses');
    const after = await readSnapshot({ reader: second.reader, store, key: 'k', deploymentBlock: 0n });
    expect(second.ranges).toEqual([[1_001n, 1_200n]]);
    expect(statusSpy).toHaveBeenCalledWith([id('1')]);
    expect(after.metrics.activeNodes).toBe(1);
    expect(after.events).toHaveLength(1);
  });

  it('fills block timestamps for fresh events only', async () => {
    const { reader } = fakeReader({ latest: 600n, events: [registered(id('1'), 500n)] });
    const snapshot = await readSnapshot({ reader, store: memoryStore(), key: 'k', deploymentBlock: 0n });
    expect(snapshot.events[0].timestamp).toBe(5_000);
  });

  it('round-trips a checkpoint through Web Storage with its bigints intact', () => {
    const backing = new Map<string, string>();
    const store = storageCheckpointStore({ getItem: (key) => backing.get(key) ?? null, setItem: (key, value) => void backing.set(key, value) });
    store.save('k', { upTo: 42n, events: [registered(id('1'), 7n)] });
    const loaded = store.load('k');
    expect(loaded?.upTo).toBe(42n);
    expect(loaded?.events[0].blockNumber).toBe(7n);
  });

  it('treats a blocked store as empty rather than failing the page', () => {
    const store = storageCheckpointStore({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(store.load('k')).toBeNull();
    expect(() => store.save('k', { upTo: 1n, events: [] })).not.toThrow();
  });
});
