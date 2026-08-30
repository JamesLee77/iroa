import type { Hex32, TaskState } from '@iroa/protocol';
import { Hex32Schema, TaskCapsuleSchema, canTransition } from '@iroa/protocol';
import { z } from 'zod';
import { appendAudit, hashIdentifier } from './audit.js';
import type { AuthenticatedActor } from './auth.js';
import type { Storage, StorageTransaction, TaskRecord } from './storage.js';

const APPROVAL_SCHEMA = z.object({ approvalHash: Hex32Schema }).strict();
const DISPUTE_SCHEMA = z.object({
  reasonCode: z.enum(['RESULT_INCORRECT', 'RESULT_INCOMPLETE', 'ACCESSIBILITY_ISSUE', 'OTHER']),
  evidenceHash: Hex32Schema.optional(),
}).strict();

function assertTaskOwner(task: TaskRecord, actor: AuthenticatedActor): void {
  if (actor.type !== 'user' || !actor.sessionId || task.ownerSessionId !== actor.sessionId) {
    throw new Error('TASK_OWNER_REQUIRED');
  }
}

export function transitionTask(
  transaction: StorageTransaction,
  task: TaskRecord,
  nextState: TaskState,
  actor: AuthenticatedActor | { type: 'system'; id: string },
  reasonCode: string,
  now: number,
  assignment?: { nodeId: Hex32 | null; leaseNonce: Hex32 | null },
): TaskRecord {
  if (!canTransition(task.state, nextState)) {
    throw new Error(`INVALID_TASK_TRANSITION:${task.state}:${nextState}`);
  }
  const updated: TaskRecord = {
    ...task,
    state: nextState,
    assignedNodeId: assignment ? assignment.nodeId : task.assignedNodeId,
    currentLeaseNonce: assignment ? assignment.leaseNonce : task.currentLeaseNonce,
    rowVersion: task.rowVersion + 1,
    updatedAt: now,
  };
  transaction.updateTask(updated, task.rowVersion);
  transaction.appendTaskEvent({
    taskId: task.taskId,
    previousState: task.state,
    nextState,
    actorType: actor.type,
    actorIdHash: actor.type === 'system' ? hashIdentifier(actor.id) : actor.idHash,
    reasonCode,
    createdAt: now,
  });
  return updated;
}

export class TaskService {
  constructor(
    private readonly storage: Storage,
    private readonly now: () => number = () => Math.floor(Date.now() / 1_000),
  ) {}

  async create(actor: AuthenticatedActor, inputValue: unknown): Promise<TaskRecord> {
    if (actor.type !== 'user' || !actor.sessionId) throw new Error('SANDBOX_USER_REQUIRED');
    const capsule = TaskCapsuleSchema.parse(inputValue);
    const now = this.now();
    if (capsule.expiresAt <= now) throw new Error('TASK_CAPSULE_EXPIRED');
    const draft: TaskRecord = {
      taskId: capsule.taskId,
      ownerSessionId: actor.sessionId,
      state: 'draft',
      policyVersion: capsule.policyVersion,
      capsule,
      assignedNodeId: null,
      currentLeaseNonce: null,
      rowVersion: 0,
      createdAt: now,
      updatedAt: now,
    };
    return this.storage.transaction((transaction) => {
      transaction.insertTask(draft);
      transaction.appendTaskEvent({
        taskId: draft.taskId,
        previousState: null,
        nextState: 'draft',
        actorType: 'user',
        actorIdHash: actor.idHash,
        reasonCode: 'TASK_CREATED',
        createdAt: now,
      });
      const awaiting = transitionTask(transaction, draft, 'awaiting_approval', actor, 'APPROVAL_REQUIRED', now);
      appendAudit(transaction, {
        action: 'TASK_CREATED',
        actorType: 'user',
        actorId: actor.id,
        subjectType: 'task',
        subjectId: draft.taskId,
        metadata: { policyVersion: draft.policyVersion, trustLevel: draft.capsule.trustLevel },
        now,
      });
      return awaiting;
    });
  }

  async approve(actor: AuthenticatedActor, taskIdInput: string, inputValue: unknown): Promise<TaskRecord> {
    const taskId = Hex32Schema.parse(taskIdInput);
    const input = APPROVAL_SCHEMA.parse(inputValue);
    const now = this.now();
    return this.storage.transaction((transaction) => {
      const task = transaction.getTask(taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      assertTaskOwner(task, actor);
      if (input.approvalHash !== task.capsule.userApprovalHash) throw new Error('APPROVAL_HASH_MISMATCH');
      if (task.capsule.expiresAt <= now) throw new Error('TASK_CAPSULE_EXPIRED');
      const queued = transitionTask(transaction, task, 'queued', actor, 'USER_APPROVED', now);
      appendAudit(transaction, {
        action: 'TASK_APPROVED',
        actorType: 'user',
        actorId: actor.id,
        subjectType: 'task',
        subjectId: taskId,
        metadata: { policyVersion: task.policyVersion },
        now,
      });
      return queued;
    });
  }

  async cancel(actor: AuthenticatedActor, taskIdInput: string): Promise<TaskRecord> {
    const taskId = Hex32Schema.parse(taskIdInput);
    const now = this.now();
    return this.storage.transaction((transaction) => {
      const task = transaction.getTask(taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      assertTaskOwner(task, actor);
      const cancelled = transitionTask(transaction, task, 'cancelled', actor, 'USER_CANCELLED', now, {
        nodeId: null,
        leaseNonce: null,
      });
      const activeLease = transaction.getActiveLease(taskId);
      if (activeLease) {
        transaction.updateLease({ ...activeLease, status: 'revoked', closedAt: now });
      }
      appendAudit(transaction, {
        action: 'TASK_CANCELLED',
        actorType: 'user',
        actorId: actor.id,
        subjectType: 'task',
        subjectId: taskId,
        metadata: {},
        now,
      });
      return cancelled;
    });
  }

  async confirm(actor: AuthenticatedActor, taskIdInput: string): Promise<TaskRecord> {
    const taskId = Hex32Schema.parse(taskIdInput);
    const now = this.now();
    return this.storage.transaction((transaction) => {
      const task = transaction.getTask(taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      assertTaskOwner(task, actor);
      if (!transaction.getReceipt(taskId, 'result')) throw new Error('RESULT_RECEIPT_REQUIRED');
      if (!transaction.getReceipt(taskId, 'deletion')) throw new Error('DELETION_RECEIPT_REQUIRED');
      const verified = transitionTask(transaction, task, 'verified', actor, 'USER_CONFIRMED_RESULT', now);
      const rewardPending = transitionTask(
        transaction,
        verified,
        'reward_pending',
        { type: 'system', id: 'receipt-settlement' },
        'RECEIPTS_COMPLETE',
        now,
      );
      appendAudit(transaction, {
        action: 'TASK_RESULT_CONFIRMED',
        actorType: 'user',
        actorId: actor.id,
        subjectType: 'task',
        subjectId: taskId,
        metadata: { policyVersion: task.policyVersion },
        now,
      });
      return rewardPending;
    });
  }

  async dispute(actor: AuthenticatedActor, taskIdInput: string, inputValue: unknown): Promise<TaskRecord> {
    const taskId = Hex32Schema.parse(taskIdInput);
    const input = DISPUTE_SCHEMA.parse(inputValue);
    const now = this.now();
    return this.storage.transaction((transaction) => {
      const task = transaction.getTask(taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      assertTaskOwner(task, actor);
      if (!transaction.getReceipt(taskId, 'result')) throw new Error('RESULT_RECEIPT_REQUIRED');
      const disputed = transitionTask(transaction, task, 'disputed', actor, input.reasonCode, now);
      appendAudit(transaction, {
        action: 'TASK_RESULT_DISPUTED',
        actorType: 'user',
        actorId: actor.id,
        subjectType: 'task',
        subjectId: taskId,
        metadata: {
          reasonCode: input.reasonCode,
          hasEvidence: Boolean(input.evidenceHash),
        },
        now,
      });
      return disputed;
    });
  }

  async get(actor: AuthenticatedActor, taskIdInput: string): Promise<TaskRecord> {
    const taskId = Hex32Schema.parse(taskIdInput);
    return this.storage.transaction((transaction) => {
      const task = transaction.getTask(taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      if (actor.type === 'user') assertTaskOwner(task, actor);
      return task;
    });
  }
}
