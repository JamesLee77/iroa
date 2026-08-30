import { describe, expect, it } from 'vitest';
import type { Address, Hex32 } from '@iroa/protocol';
import { hashIdentifier } from '../src/audit.js';
import type { AuthenticatedActor } from '../src/auth.js';
import { OperatorService, type OperatorRewardProvider } from '../src/operator.js';
import { MemoryStorage } from '../src/storage.js';

const wallet = '0x1111111111111111111111111111111111111111' as Address;
const actor: AuthenticatedActor = {
  type: 'operator',
  id: wallet,
  idHash: hashIdentifier(wallet),
  sessionId: 'operator-session',
};

describe('operator reward records', () => {
  it('accepts an empty Merkle proof for a valid single-leaf reward tree', async () => {
    const provider: OperatorRewardProvider = {
      async listForOperator() {
        return [{
          recordId: `0x${'20'.repeat(32)}` as Hex32,
          leaf: {
            epoch: 1_800_000_000,
            operatorIdHash: actor.idHash,
            nodeId: `0x${'21'.repeat(32)}` as Hex32,
            score: '100',
            rewardAmount: '1000000000000000000',
            receiptBatchRoot: `0x${'22'.repeat(32)}` as Hex32,
            policyVersion: '1.0.0',
            claimNonce: `0x${'23'.repeat(32)}` as Hex32,
          },
          proof: [],
          scoreBreakdown: {
            validatedTasks: 1,
            resultQualityBps: 10_000,
            accessibilityQualityBps: 10_000,
            securityGate: true,
          },
          excludedReasons: [],
        }];
      },
    };
    const service = new OperatorService(new MemoryStorage(), provider);
    await expect(service.listRewards(actor)).resolves.toHaveLength(1);
  });

  it('rejects a reward leaf that is bound to a different operator identity', async () => {
    const provider: OperatorRewardProvider = {
      async listForOperator() {
        return [{
          recordId: `0x${'30'.repeat(32)}` as Hex32,
          leaf: {
            epoch: 1_800_000_000,
            operatorIdHash: `0x${'31'.repeat(32)}` as Hex32,
            nodeId: `0x${'32'.repeat(32)}` as Hex32,
            score: '1',
            rewardAmount: '1',
            receiptBatchRoot: `0x${'33'.repeat(32)}` as Hex32,
            policyVersion: '1.0.0',
            claimNonce: `0x${'34'.repeat(32)}` as Hex32,
          },
          proof: [],
          scoreBreakdown: {
            validatedTasks: 1,
            resultQualityBps: 10_000,
            accessibilityQualityBps: 10_000,
            securityGate: true,
          },
          excludedReasons: [],
        }];
      },
    };
    const service = new OperatorService(new MemoryStorage(), provider);
    await expect(service.listRewards(actor)).rejects.toThrow('REWARD_OPERATOR_MISMATCH');
  });
});
