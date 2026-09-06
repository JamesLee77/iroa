import { createPublicClient, http, parseEventLogs, type Hex } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { NODE_REGISTRY_EVENTS, NODE_STATUS_ABI, REWARD_DISTRIBUTOR_EVENTS, ROOT_REGISTRY_EVENTS, type NetworkEvent, type NodeStatusCode } from './events';
import type { NetworkReader } from './snapshot';

export interface ClientConfig {
  chainId: 84532 | 8453;
  rpcUrl: string;
  nodeRegistry: Hex;
  receiptRootRegistry: Hex;
  rewardDistributor: Hex;
}

const ALL_EVENTS = [...NODE_REGISTRY_EVENTS, ...ROOT_REGISTRY_EVENTS, ...REWARD_DISTRIBUTOR_EVENTS] as const;

/** The viem-backed reader for a published deployment. */
export function createNetworkReader(config: ClientConfig): NetworkReader {
  const client = createPublicClient({
    chain: config.chainId === 8453 ? base : baseSepolia,
    transport: http(config.rpcUrl, { batch: true }),
  });
  const addresses = [config.nodeRegistry, config.receiptRootRegistry, config.rewardDistributor];

  return {
    latestBlock: () => client.getBlockNumber(),

    async events(fromBlock, toBlock) {
      const logs = await client.getLogs({ address: addresses, fromBlock, toBlock });
      const decoded = parseEventLogs({ abi: ALL_EVENTS, logs, strict: true });
      const events: NetworkEvent[] = [];
      for (const log of decoded) {
        const common = {
          blockNumber: log.blockNumber,
          logIndex: log.logIndex,
          transactionHash: log.transactionHash,
          timestamp: 0,
        };
        // Events are matched to the contract that emits them so a same-named
        // event on another address can never enter the tally.
        const from = log.address.toLowerCase();
        switch (log.eventName) {
          case 'NodeRegistered':
            if (from === config.nodeRegistry.toLowerCase()) {
              events.push({ ...common, kind: 'NodeRegistered', nodeId: log.args.nodeId, trustLevel: log.args.trustLevel as 0 | 1 | 2 | 3 });
            }
            break;
          case 'NodeStatusChanged':
            if (from === config.nodeRegistry.toLowerCase()) {
              events.push({ ...common, kind: 'NodeStatusChanged', nodeId: log.args.nodeId, previousStatus: log.args.previousStatus as NodeStatusCode, newStatus: log.args.newStatus as NodeStatusCode });
            }
            break;
          case 'NodeTrustLevelChanged':
            if (from === config.nodeRegistry.toLowerCase()) {
              events.push({ ...common, kind: 'NodeTrustLevelChanged', nodeId: log.args.nodeId, previousLevel: log.args.previousLevel as 0 | 1 | 2 | 3, newLevel: log.args.newLevel as 0 | 1 | 2 | 3 });
            }
            break;
          case 'RootProposed':
            if (from === config.receiptRootRegistry.toLowerCase()) {
              events.push({ ...common, kind: 'RootProposed', epoch: log.args.epoch, revision: log.args.revision });
            }
            break;
          case 'RootFinalized':
            if (from === config.receiptRootRegistry.toLowerCase()) {
              events.push({ ...common, kind: 'RootFinalized', epoch: log.args.epoch, revision: log.args.revision });
            }
            break;
          case 'RewardClaimed':
            if (from === config.rewardDistributor.toLowerCase()) {
              events.push({ ...common, kind: 'RewardClaimed', epoch: log.args.epoch, nodeId: log.args.nodeId });
            }
            break;
          default:
            break;
        }
      }
      return events;
    },

    async nodeStatuses(nodeIds) {
      const results = await client.multicall({
        contracts: nodeIds.map((nodeId) => ({
          address: config.nodeRegistry,
          abi: NODE_STATUS_ABI,
          functionName: 'nodeStatus',
          args: [nodeId],
        })),
        allowFailure: true,
      });
      const statuses = new Map<Hex, NodeStatusCode>();
      results.forEach((result, index) => {
        if (result.status === 'success') statuses.set(nodeIds[index], result.result as NodeStatusCode);
      });
      return statuses;
    },

    async blockTimestamps(blockNumbers) {
      const blocks = await Promise.all(blockNumbers.map((blockNumber) => client.getBlock({ blockNumber })));
      return new Map(blocks.map((block) => [block.number, Number(block.timestamp)]));
    },
  };
}
