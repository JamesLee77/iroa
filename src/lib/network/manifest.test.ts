import { describe, expect, it } from 'vitest';
import { readPublicDeployment, selectNetworkSource } from './manifest';

const address = (fill: string) => `0x${fill.repeat(40)}`;

const sepolia = {
  schemaVersion: 1,
  release: 'v1',
  profile: 'base-sepolia',
  chainId: '84532',
  createdAt: '2026-09-10T00:00:00Z',
  contracts: {
    nodeRegistry: address('a'),
    receiptRootRegistry: address('b'),
    rewardDistributor: address('c'),
  },
};

const mainnet = { ...sepolia, profile: 'base-mainnet', chainId: '8453' };

describe('public network source', () => {
  it('shows nothing when only the schema exists, so an undeployed network never renders as live', () => {
    expect(selectNetworkSource({ 'schema.json': { title: 'schema' } })).toEqual({ kind: 'none' });
  });

  it('never publishes the local profile', () => {
    expect(selectNetworkSource({ 'local.json': { ...sepolia, profile: 'local', chainId: '31337' } })).toEqual({ kind: 'none' });
  });

  it('shows Base Sepolia as the validation network when mainnet is not deployed', () => {
    const source = selectNetworkSource({ 'base-sepolia.json': sepolia });
    expect(source.kind).toBe('deployment');
    if (source.kind !== 'deployment') return;
    expect(source.deployment.profile).toBe('base-sepolia');
    expect(source.deployment.chainId).toBe(84532);
    expect(source.deployment.explorer).toBe('https://sepolia.basescan.org');
  });

  it('prefers the mainnet manifest once it exists', () => {
    const source = selectNetworkSource({ 'base-sepolia.json': sepolia, 'base-mainnet.json': mainnet });
    expect(source.kind === 'deployment' && source.deployment.profile).toBe('base-mainnet');
  });

  it('reads the deployment block from controls when present and rejects a malformed one', () => {
    expect(readPublicDeployment('base-sepolia', sepolia).deploymentBlock).toBeUndefined();
    expect(readPublicDeployment('base-sepolia', { ...sepolia, controls: { deploymentBlock: '123456' } }).deploymentBlock).toBe(123456n);
    expect(() => readPublicDeployment('base-sepolia', { ...sepolia, controls: { deploymentBlock: 'soon' } })).toThrow(/deploymentBlock/);
  });

  it('pairs each profile with its public RPC and explorer', () => {
    expect(readPublicDeployment('base-sepolia', sepolia).rpcUrl).toBe('https://sepolia.base.org');
    expect(readPublicDeployment('base-mainnet', mainnet).rpcUrl).toBe('https://mainnet.base.org');
  });

  it('rejects a manifest whose profile or chain does not match its file name', () => {
    expect(() => readPublicDeployment('base-sepolia', mainnet)).toThrow(/declares profile base-mainnet/);
    expect(() => readPublicDeployment('base-sepolia', { ...sepolia, chainId: '8453' })).toThrow(/declares chainId 8453/);
  });

  it('rejects a manifest that lacks one of the three contracts the page describes', () => {
    const { rewardDistributor: _omitted, ...partial } = sepolia.contracts;
    expect(() => readPublicDeployment('base-sepolia', { ...sepolia, contracts: partial })).toThrow(/rewardDistributor/);
  });
});
