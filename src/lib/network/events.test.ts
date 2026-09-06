import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import { aggregateNetworkMetrics, byNewest, NODE_STATUS, type NetworkEvent } from './events';

const id = (fill: string) => `0x${fill.repeat(64)}` as Hex;
const tx = id('f');
const base = { logIndex: 0, transactionHash: tx, timestamp: 1_700_000_000 };

const registered = (nodeId: Hex, trustLevel: 0 | 1 | 2 | 3, blockNumber = 10n): NetworkEvent => ({
  ...base, kind: 'NodeRegistered', nodeId, trustLevel, blockNumber,
});

describe('network metrics aggregation', () => {
  it('counts only nodes the registry currently reports as Active', () => {
    const events = [registered(id('1'), 1), registered(id('2'), 2), registered(id('3'), 2)];
    const statuses = new Map<Hex, 0 | 1 | 2 | 3>([
      [id('1'), NODE_STATUS.Active],
      [id('2'), NODE_STATUS.Pending],
      [id('3'), NODE_STATUS.Suspended],
    ]);
    const metrics = aggregateNetworkMetrics(events, statuses);
    expect(metrics.activeNodes).toBe(1);
    expect(metrics.trustMix).toEqual({ 0: 0, 1: 1, 2: 0, 3: 0 });
  });

  it('counts a node at the trust level compliance last set, not the one it registered with', () => {
    const events: NetworkEvent[] = [
      registered(id('1'), 1, 10n),
      { ...base, kind: 'NodeTrustLevelChanged', nodeId: id('1'), previousLevel: 1, newLevel: 3, blockNumber: 12n },
      { ...base, kind: 'NodeTrustLevelChanged', nodeId: id('1'), previousLevel: 3, newLevel: 2, blockNumber: 15n },
    ];
    const metrics = aggregateNetworkMetrics(events, new Map([[id('1'), NODE_STATUS.Active]]));
    expect(metrics.activeNodes).toBe(1);
    expect(metrics.trustMix).toEqual({ 0: 0, 1: 0, 2: 1, 3: 0 });
  });

  it('shows zero rather than a registration count when nothing is approved yet', () => {
    const metrics = aggregateNetworkMetrics([registered(id('1'), 0)], new Map());
    expect(metrics.activeNodes).toBe(0);
  });

  it('counts each finalized epoch once and keeps the latest finalization time', () => {
    const events: NetworkEvent[] = [
      { ...base, kind: 'RootFinalized', epoch: 1n, revision: 0, blockNumber: 20n, timestamp: 100 },
      { ...base, kind: 'RootFinalized', epoch: 1n, revision: 1, blockNumber: 25n, timestamp: 150 },
      { ...base, kind: 'RootFinalized', epoch: 2n, revision: 0, blockNumber: 30n, timestamp: 200 },
      { ...base, kind: 'RootProposed', epoch: 3n, revision: 0, blockNumber: 31n, timestamp: 250 },
    ];
    const metrics = aggregateNetworkMetrics(events, new Map());
    expect(metrics.finalizedEpochs).toBe(2);
    expect(metrics.lastRootAt).toBe(200);
  });

  it('counts reward claims without touching amounts', () => {
    const events: NetworkEvent[] = [
      { ...base, kind: 'RewardClaimed', epoch: 1n, nodeId: id('1'), blockNumber: 40n },
      { ...base, kind: 'RewardClaimed', epoch: 1n, nodeId: id('2'), blockNumber: 41n },
    ];
    const metrics = aggregateNetworkMetrics(events, new Map());
    expect(metrics.claims).toBe(2);
    expect(metrics.lastRootAt).toBeNull();
  });

  it('orders newest first by block, then by log index', () => {
    const events: NetworkEvent[] = [
      { ...base, kind: 'RewardClaimed', epoch: 1n, nodeId: id('1'), blockNumber: 40n, logIndex: 2 },
      { ...base, kind: 'RewardClaimed', epoch: 1n, nodeId: id('2'), blockNumber: 41n, logIndex: 0 },
      { ...base, kind: 'RewardClaimed', epoch: 1n, nodeId: id('3'), blockNumber: 40n, logIndex: 5 },
    ];
    expect([...events].sort(byNewest).map((event) => (event as { nodeId: Hex }).nodeId)).toEqual([id('2'), id('3'), id('1')]);
  });
});
