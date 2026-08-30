import { describe, expect, it } from 'vitest';
import { assertManifestForChain } from './manifest.js';

const plannedBaseManifest = {
  schemaVersion: 1,
  project: 'IROA',
  network: 'base',
  chainId: 8453,
  deploymentStatus: 'planned',
  deploymentCommit: null,
  contracts: {},
} as const;

describe('IROA deployment manifests', () => {
  it('accepts a planned manifest for its exact chain', () => {
    expect(assertManifestForChain(plannedBaseManifest, 8453).chainId).toBe(8453);
  });

  it('rejects cross-chain manifests and empty deployment addresses', () => {
    expect(() => assertManifestForChain(plannedBaseManifest, 84532)).toThrow(/does not match/);
    expect(() =>
      assertManifestForChain(
        {
          ...plannedBaseManifest,
          deploymentStatus: 'deployed',
          deploymentCommit: 'a'.repeat(40),
          contracts: {
            IROATokenV1: {
              address: '',
              transactionHash: `0x${'11'.repeat(32)}`,
              bytecodeHash: `0x${'22'.repeat(32)}`,
            },
          },
        },
        8453,
      ),
    ).toThrow();
  });

  it('rejects duplicate deployed contract addresses', () => {
    const duplicatedAddress = `0x${'33'.repeat(20)}`;
    const deployment = {
      address: duplicatedAddress,
      transactionHash: `0x${'11'.repeat(32)}`,
      bytecodeHash: `0x${'22'.repeat(32)}`,
    };

    expect(() =>
      assertManifestForChain(
        {
          ...plannedBaseManifest,
          deploymentStatus: 'deployed',
          deploymentCommit: 'a'.repeat(40),
          contracts: {
            IROATokenV1: deployment,
            IROATimelock: deployment,
          },
        },
        8453,
      ),
    ).toThrow(/duplicate contract address/i);
  });
});
