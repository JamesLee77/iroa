import { describe, expect, it } from 'vitest';
import type { AdminSettlement } from './api';
import { buildVerifiedSafeProposal } from './settlement-proposal';

const HEX = `0x${'11'.repeat(32)}` as const;
const ROOT = '0x1000000000000000000000000000000000000001' as const;
const SAFE = '0x1000000000000000000000000000000000000002' as const;

describe('server-approved root proposal boundary', () => {
  it('rejects a server transaction whose target differs from the selected root registry', () => {
    const settlement = {
      epoch: 1, policyVersion: '1.0.0', rewardRoot: HEX, receiptBatchRoot: HEX,
      claims: [{}], artifactSha256: HEX,
    } as unknown as AdminSettlement;
    expect(() => buildVerifiedSafeProposal({
      settlement,
      transaction: { to: '0x9000000000000000000000000000000000000009', data: '0x1234', value: '0', artifactSha256: HEX, policyVersionHash: HEX },
      profile: { chainId: 84532, safe: SAFE, rootRegistry: ROOT, manifestHash: HEX },
    })).toThrow('ROOT_PROPOSAL_TRANSACTION_MISMATCH');
  });
});
