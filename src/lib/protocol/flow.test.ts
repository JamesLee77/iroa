import { describe, expect, it } from 'vitest';
import { PRIVACY_BOUNDARY, PROTOCOL_STAGES } from './flow';

describe('IROA protocol flow', () => {
  it('keeps the approved execution order and planned settlement boundary', () => {
    expect(PROTOCOL_STAGES.map(({ id }) => id)).toEqual([
      'request',
      'task-capsule',
      'verified-node',
      'proof-receipt',
      'base-settlement',
    ]);
    expect(PROTOCOL_STAGES.at(-1)).toMatchObject({
      network: 'Base',
      asset: 'Circle Native USDC',
    });
  });

  it('keeps personal source data off-chain', () => {
    expect(PRIVACY_BOUNDARY.onChain).not.toContain('개인정보 원문');
    expect(PRIVACY_BOUNDARY.offChain).toContain('개인정보 원문');
  });
});
