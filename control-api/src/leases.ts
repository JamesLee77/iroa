import { createHash } from 'node:crypto';
import type { Hex32 } from '@iroa/protocol';
import { Hex32Schema } from '@iroa/protocol';
import { z } from 'zod';
import { appendAudit } from './audit.js';
import type { AuthenticatedActor } from './auth.js';
import type { Storage, StorageTransaction, TaskLeaseRecord } from './storage.js';
import { transitionTask } from './tasks.js';

const CLAIM_SCHEMA = z.object({ requestId: Hex32Schema }).strict();
const TRUST_RANK = { N0: 0, N1: 1, N2: 2, N3: 3, N4: 3 } as const;

function deriveLeaseNonce(taskId: Hex32, nodeId: Hex32, requestId: Hex32): Hex32 {
  return `0x${createHash('sha256').update(`iroa-lease:${taskId}:${nodeId}:${requestId}`).digest('hex')}` as Hex32;
}

export function requireMatchingActiveLease(
  transaction: StorageTransaction,
  taskId: Hex32,
  nonce: Hex32,
  nodeId: Hex32,
  now: number,
): TaskLeaseRecord {
  const lease = transaction.getLease(taskId, nonce);
  if (!lease || lease.status !== 'active') throw new Error('LEASE_INACTIVE_OR_STALE');
  if (lease.nodeId !== nodeId) throw new Error('LEASE_NODE_MISMATCH');
  if (lease.expiresAt <= now) throw new Error('LEASE_EXPIRED');
  return lease;
}

export class LeaseService {
  constructor(
    private readonly storage: Storage,
    private readonly now: () => number = () => Math.floor(Date.now() / 1_000),
    private readonly leaseTtlSeconds = 5 * 60,
    private readonly heartbeatFreshnessSeconds = 2 * 60,
  ) {
    if (leaseTtlSeconds < 30 || heartbeatFreshnessSeconds < 30) throw new Error('INVALID_LEASE_CONFIGURATION');
  }

  async claim(actor: AuthenticatedActor, taskIdInput: string, inputValue: unknown): Promise<TaskLeaseRecord> {
    if (actor.type !== 'node') throw new Error('NODE_AUTH_REQUIRED');
    const taskId = Hex32Schema.parse(taskIdInput);
    const nodeId = Hex32Schema.parse(actor.id);
    const input = CLAIM_SCHEMA.parse(inputValue);
    const nonce = deriveLeaseNonce(taskId, nodeId, input.requestId);
    const now = this.now();

    return this.storage.transaction((transaction) => {
      const retry = transaction.getLease(taskId, nonce);
      if (retry) {
        if (retry.nodeId !== nodeId) throw new Error('LEASE_NODE_MISMATCH');
        if (retry.status !== 'active' || retry.expiresAt <= now) throw new Error('LEASE_REQUEST_ALREADY_CLOSED');
        const retryTask = transaction.getTask(taskId);
        if (
          !retryTask ||
          retryTask.state !== 'assigned' ||
          retryTask.assignedNodeId !== nodeId ||
          retryTask.currentLeaseNonce !== nonce
        ) {
          throw new Error('LEASE_IDEMPOTENCY_STATE_MISMATCH');
        }
        return retry;
      }

      const task = transaction.getTask(taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      if (task.state !== 'queued') throw new Error('TASK_NOT_QUEUED');
      if (task.capsule.expiresAt <= now) throw new Error('TASK_CAPSULE_EXPIRED');
      const node = transaction.getNode(nodeId);
      if (!node || node.status !== 'active') throw new Error('ACTIVE_NODE_REQUIRED');
      if (node.policyVersion !== task.policyVersion) throw new Error('POLICY_VERSION_MISMATCH');
      if (node.lastSeenAt === null || now - node.lastSeenAt > this.heartbeatFreshnessSeconds) {
        throw new Error('NODE_HEARTBEAT_STALE');
      }
      if (TRUST_RANK[node.trustLevel] < TRUST_RANK[task.capsule.trustLevel]) {
        throw new Error('NODE_TRUST_INSUFFICIENT');
      }

      const lease = transaction.insertLease({
        taskId,
        nonce,
        nodeId,
        status: 'active',
        expiresAt: Math.min(now + this.leaseTtlSeconds, task.capsule.expiresAt),
        createdAt: now,
        closedAt: null,
      });
      transitionTask(transaction, task, 'assigned', actor, 'NODE_CLAIMED', now, { nodeId, leaseNonce: nonce });
      appendAudit(transaction, {
        action: 'LEASE_CLAIMED',
        actorType: 'node',
        actorId: nodeId,
        subjectType: 'lease',
        subjectId: nonce,
        metadata: { expiresAt: lease.expiresAt },
        now,
      });
      return lease;
    });
  }

  async expire(taskIdInput: string, nonceInput: string): Promise<TaskLeaseRecord> {
    const taskId = Hex32Schema.parse(taskIdInput);
    const nonce = Hex32Schema.parse(nonceInput);
    const now = this.now();
    return this.storage.transaction((transaction) => {
      const lease = transaction.getLease(taskId, nonce);
      if (!lease) throw new Error('LEASE_NOT_FOUND');
      if (lease.status !== 'active') return lease;
      if (lease.expiresAt > now) throw new Error('LEASE_NOT_EXPIRED');
      const task = transaction.getTask(taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      const expired = { ...lease, status: 'expired' as const, closedAt: now };
      transaction.updateLease(expired);
      if (task.state === 'assigned') {
        transitionTask(transaction, task, 'queued', { type: 'system', id: 'lease-expirer' }, 'LEASE_EXPIRED', now, {
          nodeId: null,
          leaseNonce: null,
        });
      } else if (task.state !== 'cancelled' && task.state !== 'failed') {
        throw new Error('LEASE_EXPIRY_STATE_MISMATCH');
      }
      appendAudit(transaction, {
        action: 'LEASE_EXPIRED',
        actorType: 'system',
        actorId: 'lease-expirer',
        subjectType: 'lease',
        subjectId: nonce,
        metadata: {},
        now,
      });
      return expired;
    });
  }

  async expireDue(): Promise<number> {
    const due = await this.storage.transaction((transaction) => transaction.listExpiredActiveLeases(this.now()));
    let expiredCount = 0;
    for (const lease of due) {
      const result = await this.expire(lease.taskId, lease.nonce);
      if (result.status === 'expired') expiredCount += 1;
    }
    return expiredCount;
  }
}
