import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ReceiptDomainInput } from '@iroa/crypto';
import {
  AddressSchema,
  Hex32Schema,
  TaskCapsuleSchema,
  type DeletionReceipt,
  type Hex32,
  type ResultReceipt,
  type TaskCapsule,
} from '@iroa/protocol';
import { getAddress } from 'viem';
import { canonicalJson, sha256Hex } from './canonical.js';
import {
  hashAndDeleteScratchDirectory,
  type ScratchRemovalAdapter,
} from './deletion.js';
import { deriveNodeId, getDeviceIdentity, type DeviceSecretProvider } from './enrollment.js';
import { easyLanguageExecutor } from './executors/easy-language.js';
import { mockAvailabilityExecutor } from './executors/mock-availability.js';
import { publicInformationExecutor } from './executors/public-information.js';
import {
  EXECUTOR_RESPONSE_LIMIT_BYTES,
  EXECUTOR_TIMEOUT_MS,
  ExecutorIdSchema,
  ExecutorPolicyError,
  type ExecutorId,
  type SyntheticExecutor,
} from './policy.js';
import { signDeletionReceipt, signResultReceipt } from './receipts.js';

const EXECUTORS: Readonly<Record<ExecutorId, SyntheticExecutor>> = {
  'public-information': publicInformationExecutor,
  'mock-availability': mockAvailabilityExecutor,
  'easy-language': easyLanguageExecutor,
};

export interface TaskLease {
  readonly taskId: Hex32;
  readonly nonce: Hex32;
  readonly nodeId: Hex32;
  readonly createdAt: number;
  readonly expiresAt: number;
}

export interface TaskExecutionResult {
  readonly resultReceipt: ResultReceipt;
  readonly deletionReceipt: DeletionReceipt | null;
  readonly rewardEligible: boolean;
  readonly deletionFailureCode: string | null;
}

export class TaskExecutionError extends Error {
  constructor(
    readonly code: string,
    readonly deletionFailureCode: string | null = null,
  ) {
    super(code);
    this.name = 'TaskExecutionError';
  }
}

function assertLease(input: {
  capsule: TaskCapsule;
  lease: TaskLease;
  now: number;
  nodeId: Hex32;
}): void {
  if (input.lease.taskId !== input.capsule.taskId) throw new TaskExecutionError('LEASE_TASK_MISMATCH');
  if (input.lease.nodeId !== input.nodeId) throw new TaskExecutionError('LEASE_NODE_MISMATCH');
  if (input.lease.createdAt > input.now || input.lease.expiresAt <= input.now) {
    throw new TaskExecutionError('LEASE_INACTIVE_OR_STALE');
  }
  if (input.capsule.expiresAt <= input.now || input.lease.expiresAt > input.capsule.expiresAt) {
    throw new TaskExecutionError('TASK_CAPSULE_EXPIRED_OR_LEASE_INVALID');
  }
}

function errorCode(error: unknown): string {
  if (error instanceof TaskExecutionError || error instanceof ExecutorPolicyError) return error.code;
  if (error instanceof Error && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.message)) return error.message;
  return 'TASK_EXECUTION_FAILED';
}

function deletionErrorCode(error: unknown): string {
  const code = errorCode(error);
  return code === 'TASK_EXECUTION_FAILED' ? 'SCRATCH_DELETION_FAILED' : code;
}

export async function runSyntheticTask(input: {
  readonly capsule: unknown;
  readonly lease: TaskLease;
  readonly executorId: string;
  readonly executorInput: unknown;
  readonly operatorAddress: string;
  readonly operatorIdHash: string;
  readonly runtimeImageHash: string;
  readonly expectedDeviceAddress: string;
  readonly domain: ReceiptDomainInput;
  readonly secretProvider: DeviceSecretProvider;
  readonly signal?: AbortSignal;
  readonly fetchImplementation?: typeof fetch;
  readonly removalAdapter?: ScratchRemovalAdapter;
  readonly now?: () => number;
}): Promise<TaskExecutionResult> {
  const capsule = TaskCapsuleSchema.parse(input.capsule);
  const executorId = ExecutorIdSchema.parse(input.executorId);
  const nodeId = Hex32Schema.parse(input.lease.nodeId);
  const nonce = Hex32Schema.parse(input.lease.nonce);
  const operatorAddress = getAddress(AddressSchema.parse(input.operatorAddress));
  const operatorIdHash = Hex32Schema.parse(input.operatorIdHash);
  const runtimeImageHash = Hex32Schema.parse(input.runtimeImageHash);
  const expectedDeviceAddress = AddressSchema.parse(input.expectedDeviceAddress);
  const clock = input.now ?? (() => Math.floor(Date.now() / 1_000));
  const startedAt = clock();
  assertLease({ capsule, lease: { ...input.lease, nonce, nodeId }, now: startedAt, nodeId });
  if (capsule.policyVersion.split('.')[0] !== input.domain.version) {
    throw new TaskExecutionError('RECEIPT_DOMAIN_POLICY_MISMATCH');
  }
  if (!capsule.capabilityScope.includes(executorId)) {
    throw new TaskExecutionError('EXECUTOR_CAPABILITY_NOT_GRANTED');
  }
  const identity = await getDeviceIdentity(input.secretProvider);
  if (identity.deviceAddress.toLowerCase() !== expectedDeviceAddress.toLowerCase()) {
    throw new TaskExecutionError('DEVICE_IDENTITY_MISMATCH');
  }
  if (sha256Hex(operatorAddress) !== operatorIdHash) {
    throw new TaskExecutionError('OPERATOR_IDENTITY_MISMATCH');
  }
  if (deriveNodeId(operatorAddress, identity.deviceKeyHash) !== nodeId) {
    throw new TaskExecutionError('NODE_IDENTITY_MISMATCH');
  }
  if (input.signal?.aborted) throw new TaskExecutionError('TASK_CANCELLED');

  const scratchDirectory = await mkdtemp(join(tmpdir(), 'iroa-task-'));
  const executionController = new AbortController();
  let timedOut = false;
  const cancelExecution = () => executionController.abort(input.signal?.reason);
  input.signal?.addEventListener('abort', cancelExecution, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    executionController.abort(new TaskExecutionError('EXECUTOR_TIMEOUT'));
  }, EXECUTOR_TIMEOUT_MS);
  timeout.unref?.();

  let executionError: unknown;
  let resultReceipt: ResultReceipt | null = null;
  try {
    const result = await EXECUTORS[executorId].execute(input.executorInput, {
      scratchDirectory,
      signal: executionController.signal,
      fetchImplementation: input.fetchImplementation,
    });
    if (executionController.signal.aborted) {
      throw new TaskExecutionError(timedOut ? 'EXECUTOR_TIMEOUT' : 'TASK_CANCELLED');
    }
    const encodedResult = canonicalJson(result);
    if (Buffer.byteLength(encodedResult, 'utf8') > EXECUTOR_RESPONSE_LIMIT_BYTES) {
      throw new TaskExecutionError('EXECUTOR_OUTPUT_LIMIT_EXCEEDED');
    }
    await writeFile(join(scratchDirectory, 'result.json'), encodedResult, { encoding: 'utf8', mode: 0o600 });
    const completedAt = clock();
    if (completedAt > input.lease.expiresAt || completedAt > capsule.expiresAt) {
      throw new TaskExecutionError('LEASE_EXPIRED_DURING_EXECUTION');
    }
    if (input.signal?.aborted) throw new TaskExecutionError('TASK_CANCELLED');
    const signedResultReceipt = await signResultReceipt({
      secretProvider: input.secretProvider,
      expectedDeviceAddress,
      domain: input.domain,
      receipt: {
        chainId: input.domain.chainId,
        verifyingContract: input.domain.verifyingContract,
        policyVersion: capsule.policyVersion,
        nonce,
        taskId: capsule.taskId,
        nodeId,
        operatorIdHash,
        startedAt,
        completedAt,
        resultHash: sha256Hex(encodedResult),
        outcomeCode: 'SYNTHETIC_SUCCESS',
        accessibilityMetricsHash: sha256Hex(canonicalJson({ executorId, schema: 'synthetic-v1' })),
      },
    });
    if (input.signal?.aborted) throw new TaskExecutionError('TASK_CANCELLED');
    resultReceipt = signedResultReceipt;
  } catch (error) {
    executionError = error;
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort', cancelExecution);
  }

  let deletionReceipt: DeletionReceipt | null = null;
  let deletionFailureCode: string | null = null;
  try {
    const evidence = await hashAndDeleteScratchDirectory(scratchDirectory, input.removalAdapter);
    if (resultReceipt) {
      const deletedAt = clock();
      if (deletedAt > input.lease.expiresAt || deletedAt > capsule.expiresAt) {
        throw new TaskExecutionError('LEASE_EXPIRED_BEFORE_DELETION');
      }
      deletionReceipt = await signDeletionReceipt({
        secretProvider: input.secretProvider,
        expectedDeviceAddress,
        domain: input.domain,
        receipt: {
          chainId: input.domain.chainId,
          verifyingContract: input.domain.verifyingContract,
          policyVersion: capsule.policyVersion,
          nonce,
          taskId: capsule.taskId,
          nodeId,
          deletedAt,
          storageScopeHash: evidence.storageScopeHash,
          runtimeImageHash,
          deletionMethod: 'ephemeral-volume-destroyed',
        },
      });
    }
  } catch (error) {
    deletionFailureCode = deletionErrorCode(error);
  }

  if (executionError || !resultReceipt) {
    throw new TaskExecutionError(errorCode(executionError), deletionFailureCode);
  }
  return {
    resultReceipt,
    deletionReceipt,
    rewardEligible: deletionReceipt !== null,
    deletionFailureCode,
  };
}
