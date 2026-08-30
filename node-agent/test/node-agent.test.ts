import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '../src/canonical.js';
import { hashScratchDirectory } from '../src/deletion.js';
import { deriveNodeId, getDeviceIdentity, InjectedSecretProvider } from '../src/enrollment.js';
import {
  boundedFetch,
  EXECUTOR_RESPONSE_LIMIT_BYTES,
  ExecutorPolicyError,
} from '../src/policy.js';
import { runSyntheticTask } from '../src/runner.js';

const FIRST_PRIVATE_KEY = `0x${'11'.repeat(32)}` as const;
const SECOND_PRIVATE_KEY = `0x${'22'.repeat(32)}` as const;
const TASK_ID = `0x${'aa'.repeat(32)}` as const;
const NONCE = `0x${'cc'.repeat(32)}` as const;
const OPERATOR_ADDRESS = `0x${'34'.repeat(20)}` as const;
const RUNTIME_IMAGE_HASH = `0x${'ee'.repeat(32)}` as const;
const VERIFYING_CONTRACT = `0x${'12'.repeat(20)}` as const;

const secretProvider = new InjectedSecretProvider(async () => FIRST_PRIVATE_KEY, async () => 'key-1');
const directoriesToRemove = new Set<string>();

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all([...directoriesToRemove].map((directory) => rm(directory, { recursive: true, force: true })));
  directoriesToRemove.clear();
});

async function validRunInput(overrides: Record<string, unknown> = {}) {
  const identity = await getDeviceIdentity(secretProvider);
  const nodeId = deriveNodeId(OPERATOR_ADDRESS, identity.deviceKeyHash);
  return {
    capsule: {
      taskId: TASK_ID,
      policyVersion: '1.0.0',
      trustLevel: 'N0',
      capabilityScope: ['easy-language'],
      expiresAt: 2_000,
      inputCiphertextRef: 'iroa-blob://synthetic/input-1',
      expectedResultSchema: 'iroa-schema://synthetic/result-v1',
      userApprovalHash: `0x${'ff'.repeat(32)}`,
    },
    lease: { taskId: TASK_ID, nonce: NONCE, nodeId, createdAt: 900, expiresAt: 2_000 },
    executorId: 'easy-language',
    executorInput: { language: 'ko', text: '신청인은 구비서류를 제출하시기 바랍니다.' },
    operatorAddress: OPERATOR_ADDRESS,
    operatorIdHash: sha256Hex(OPERATOR_ADDRESS),
    runtimeImageHash: RUNTIME_IMAGE_HASH,
    expectedDeviceAddress: identity.deviceAddress,
    domain: { chainId: 31337 as const, verifyingContract: VERIFYING_CONTRACT, version: '1' },
    secretProvider,
    now: () => 1_000,
    ...overrides,
  };
}

describe('NODE Agent policy regressions', () => {
  it('rejects an executor outside the exact allowlist', async () => {
    await expect(runSyntheticTask(await validRunInput({ executorId: 'shell' }))).rejects.toThrow();
  });

  it('aborts an allowlisted network executor after 30 seconds', async () => {
    vi.useFakeTimers();
    const signal = new AbortController().signal;
    const pending = boundedFetch({
      executorId: 'public-information',
      url: 'https://api.open-meteo.com/v1/forecast',
      signal,
      fetchImplementation: vi.fn(async (_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      })),
    });
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(pending).rejects.toMatchObject<Partial<ExecutorPolicyError>>({ code: 'EXECUTOR_TIMEOUT' });
  });

  it('rejects a streamed response larger than 2 MB', async () => {
    const oversized = new Uint8Array(EXECUTOR_RESPONSE_LIMIT_BYTES + 1);
    await expect(boundedFetch({
      executorId: 'public-information',
      url: 'https://api.open-meteo.com/v1/forecast',
      signal: new AbortController().signal,
      fetchImplementation: vi.fn(async () => new Response(oversized, { status: 200 })),
    })).rejects.toMatchObject<Partial<ExecutorPolicyError>>({ code: 'EXECUTOR_RESPONSE_LIMIT_EXCEEDED' });
  });

  it('rejects a stale Task Capsule before execution', async () => {
    const input = await validRunInput();
    await expect(runSyntheticTask({
      ...input,
      capsule: { ...input.capsule, expiresAt: 999 },
      lease: { ...input.lease, expiresAt: 999 },
    })).rejects.toMatchObject({ code: 'LEASE_INACTIVE_OR_STALE' });
  });

  it('honors cancellation before creating task state', async () => {
    const controller = new AbortController();
    controller.abort('user cancelled');
    await expect(runSyntheticTask(await validRunInput({ signal: controller.signal })))
      .rejects.toMatchObject({ code: 'TASK_CANCELLED' });
  });

  it('does not return a Result Receipt when cancellation arrives during signing', async () => {
    const controller = new AbortController();
    let secretUses = 0;
    const cancellingProvider = new InjectedSecretProvider(async () => {
      secretUses += 1;
      if (secretUses === 2) controller.abort('lease revoked while signing');
      return FIRST_PRIVATE_KEY;
    }, async () => 'key-1');
    await expect(runSyntheticTask(await validRunInput({
      secretProvider: cancellingProvider,
      signal: controller.signal,
    }))).rejects.toMatchObject({ code: 'TASK_CANCELLED' });
  });

  it('rejects a forged operator identity before signing a Result Receipt', async () => {
    await expect(runSyntheticTask(await validRunInput({
      operatorIdHash: `0x${'dd'.repeat(32)}`,
    }))).rejects.toMatchObject({ code: 'OPERATOR_IDENTITY_MISMATCH' });
  });

  it('never follows a scratch root symbolic link', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'iroa-symlink-regression-'));
    directoriesToRemove.add(parent);
    const target = join(parent, 'target');
    const link = join(parent, 'scratch-link');
    await writeFile(target, 'must remain outside scratch');
    await symlink(target, link);
    await expect(hashScratchDirectory(link)).rejects.toThrow('SCRATCH_ROOT_SYMLINK_FORBIDDEN');
  });

  it('returns a Result Receipt but disables rewards when deletion cannot be confirmed', async () => {
    const removalAdapter = {
      async remove(directory: string) {
        directoriesToRemove.add(directory);
      },
    };
    const result = await runSyntheticTask(await validRunInput({ removalAdapter }));
    expect(result.resultReceipt.outcomeCode).toBe('SYNTHETIC_SUCCESS');
    expect(result.deletionReceipt).toBeNull();
    expect(result.rewardEligible).toBe(false);
    expect(result.deletionFailureCode).toBe('SCRATCH_DELETION_NOT_CONFIRMED');
  });

  it('does not sign deletion after the active lease expires', async () => {
    const times = [1_000, 1_000, 2_001];
    const result = await runSyntheticTask(await validRunInput({ now: () => times.shift() ?? 2_001 }));
    expect(result.resultReceipt.outcomeCode).toBe('SYNTHETIC_SUCCESS');
    expect(result.deletionReceipt).toBeNull();
    expect(result.rewardEligible).toBe(false);
    expect(result.deletionFailureCode).toBe('LEASE_EXPIRED_BEFORE_DELETION');
  });

  it('requires re-enrollment after device key rotation', async () => {
    const firstIdentity = await getDeviceIdentity(secretProvider);
    const rotatedProvider = new InjectedSecretProvider(async () => SECOND_PRIVATE_KEY, async () => 'key-2');
    const secondIdentity = await getDeviceIdentity(rotatedProvider);
    expect(secondIdentity.deviceKeyHash).not.toBe(firstIdentity.deviceKeyHash);
    await expect(runSyntheticTask(await validRunInput({ secretProvider: rotatedProvider })))
      .rejects.toMatchObject({ code: 'DEVICE_IDENTITY_MISMATCH' });
  });
});
