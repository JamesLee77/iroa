import { createHash } from 'node:crypto';
import type { DeletionReceipt, Hex32, ResultReceipt } from '@iroa/protocol';
import { DeletionReceiptSchema, ResultReceiptSchema } from '@iroa/protocol';
import { appendAudit } from './audit.js';
import type { AuthenticatedActor } from './auth.js';
import { requireMatchingActiveLease } from './leases.js';
import type { ReceiptRecord, Storage } from './storage.js';
import { transitionTask } from './tasks.js';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function receiptHash(receipt: ResultReceipt | DeletionReceipt): Hex32 {
  return `0x${createHash('sha256').update(canonical(receipt)).digest('hex')}` as Hex32;
}

function assertReceiptContext(
  actor: AuthenticatedActor,
  task: { taskId: Hex32; assignedNodeId: Hex32 | null; currentLeaseNonce: Hex32 | null; policyVersion: string },
  receipt: ResultReceipt | DeletionReceipt,
): asserts task is typeof task & { assignedNodeId: Hex32; currentLeaseNonce: Hex32 } {
  if (actor.type !== 'node') throw new Error('NODE_AUTH_REQUIRED');
  if (receipt.taskId !== task.taskId) throw new Error('RECEIPT_TASK_MISMATCH');
  if (receipt.nodeId !== actor.id || receipt.nodeId !== task.assignedNodeId) throw new Error('RECEIPT_NODE_MISMATCH');
  if (receipt.nonce !== task.currentLeaseNonce) throw new Error('RECEIPT_LEASE_MISMATCH');
  if (receipt.policyVersion !== task.policyVersion) throw new Error('RECEIPT_POLICY_MISMATCH');
  if (!task.assignedNodeId || !task.currentLeaseNonce) throw new Error('TASK_ASSIGNMENT_MISSING');
}

export class ReceiptService {
  constructor(
    private readonly storage: Storage,
    private readonly chainId: number,
    private readonly verifyingContract: string,
    private readonly now: () => number = () => Math.floor(Date.now() / 1_000),
  ) {}

  async submitResult(actor: AuthenticatedActor, inputValue: unknown): Promise<ReceiptRecord> {
    const receipt = ResultReceiptSchema.parse(inputValue);
    const now = this.now();
    const hash = receiptHash(receipt);
    return this.storage.transaction((transaction) => {
      const task = transaction.getTask(receipt.taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      assertReceiptContext(actor, task, receipt);
      this.assertChainContext(receipt.chainId, receipt.verifyingContract);
      const existing = transaction.getReceipt(task.taskId, 'result');
      if (existing) {
        if (existing.receiptHash !== hash) throw new Error('RECEIPT_CONFLICT');
        return existing;
      }
      if (task.state !== 'assigned') throw new Error('TASK_NOT_ASSIGNED');
      if (receipt.completedAt > now + 30) throw new Error('RECEIPT_TIME_IN_FUTURE');
      requireMatchingActiveLease(transaction, task.taskId, task.currentLeaseNonce, task.assignedNodeId, now);
      const running = transitionTask(transaction, task, 'running', actor, 'NODE_STARTED', receipt.startedAt);
      transitionTask(transaction, running, 'awaiting_confirmation', actor, 'RESULT_RECEIVED', receipt.completedAt);
      const stored = transaction.insertReceipt({
        taskId: task.taskId,
        leaseNonce: task.currentLeaseNonce,
        nodeId: task.assignedNodeId,
        kind: 'result',
        policyVersion: task.policyVersion,
        receiptHash: hash,
        payload: receipt,
        createdAt: now,
      });
      appendAudit(transaction, {
        action: 'RESULT_RECEIPT_RECEIVED',
        actorType: 'node',
        actorId: actor.id,
        subjectType: 'receipt',
        subjectId: hash,
        metadata: { outcomeCode: receipt.outcomeCode, policyVersion: receipt.policyVersion },
        now,
      });
      return stored;
    });
  }

  async submitDeletion(actor: AuthenticatedActor, inputValue: unknown): Promise<ReceiptRecord> {
    const receipt = DeletionReceiptSchema.parse(inputValue);
    const now = this.now();
    const hash = receiptHash(receipt);
    return this.storage.transaction((transaction) => {
      const task = transaction.getTask(receipt.taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      assertReceiptContext(actor, task, receipt);
      this.assertChainContext(receipt.chainId, receipt.verifyingContract);
      const existing = transaction.getReceipt(task.taskId, 'deletion');
      if (existing) {
        if (existing.receiptHash !== hash) throw new Error('RECEIPT_CONFLICT');
        return existing;
      }
      if (task.state !== 'awaiting_confirmation') throw new Error('RESULT_RECEIPT_REQUIRED');
      const result = transaction.getReceipt(task.taskId, 'result');
      if (!result) throw new Error('RESULT_RECEIPT_REQUIRED');
      const resultPayload = ResultReceiptSchema.parse(result.payload);
      if (receipt.deletedAt < resultPayload.completedAt || receipt.deletedAt > now + 30) {
        throw new Error('INVALID_DELETION_TIME');
      }
      const lease = requireMatchingActiveLease(
        transaction,
        task.taskId,
        task.currentLeaseNonce,
        task.assignedNodeId,
        now,
      );
      const stored = transaction.insertReceipt({
        taskId: task.taskId,
        leaseNonce: task.currentLeaseNonce,
        nodeId: task.assignedNodeId,
        kind: 'deletion',
        policyVersion: task.policyVersion,
        receiptHash: hash,
        payload: receipt,
        createdAt: now,
      });
      transaction.updateLease({ ...lease, status: 'completed', closedAt: now });
      appendAudit(transaction, {
        action: 'DELETION_RECEIPT_RECEIVED',
        actorType: 'node',
        actorId: actor.id,
        subjectType: 'receipt',
        subjectId: hash,
        metadata: { deletionMethod: receipt.deletionMethod, policyVersion: receipt.policyVersion },
        now,
      });
      return stored;
    });
  }

  private assertChainContext(chainId: number, verifyingContract: string): void {
    if (chainId !== this.chainId) throw new Error('RECEIPT_CHAIN_MISMATCH');
    if (verifyingContract.toLowerCase() !== this.verifyingContract.toLowerCase()) {
      throw new Error('RECEIPT_CONTRACT_MISMATCH');
    }
  }
}
