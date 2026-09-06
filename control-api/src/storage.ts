import { randomUUID } from 'node:crypto';
import type { Address, Hex32, PolicyVersion, TaskCapsule, TaskState, TaskTrustLevel } from '@iroa/protocol';

export type ActorType = 'user' | 'operator' | 'node' | 'system';
export type NodeStatus = 'pending' | 'active' | 'suspended' | 'revoked';
export type LeaseStatus = 'active' | 'completed' | 'expired' | 'revoked';
export type ReceiptKind = 'result' | 'deletion';

export interface TaskRecord {
  taskId: Hex32;
  ownerSessionId: string;
  state: TaskState;
  policyVersion: PolicyVersion;
  capsule: TaskCapsule;
  assignedNodeId: Hex32 | null;
  currentLeaseNonce: Hex32 | null;
  rowVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface TaskEventRecord {
  eventId: string;
  taskId: Hex32;
  previousState: TaskState | null;
  nextState: TaskState;
  actorType: ActorType;
  actorIdHash: Hex32;
  reasonCode: string;
  createdAt: number;
}

export interface NodeDeviceRecord {
  nodeId: Hex32;
  operatorAddress: Address;
  deviceAddress: Address;
  deviceKeyHash: Hex32;
  trustLevel: Exclude<TaskTrustLevel, 'N4'>;
  policyVersion: PolicyVersion;
  status: NodeStatus;
  agentVersion: string | null;
  capacityBucket: string | null;
  lastSeenAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface TaskLeaseRecord {
  leaseId: string;
  taskId: Hex32;
  nonce: Hex32;
  nodeId: Hex32;
  status: LeaseStatus;
  expiresAt: number;
  createdAt: number;
  closedAt: number | null;
}

export interface ReceiptRecord {
  receiptId: string;
  taskId: Hex32;
  leaseNonce: Hex32;
  nodeId: Hex32;
  kind: ReceiptKind;
  policyVersion: PolicyVersion;
  receiptHash: Hex32;
  payload: Readonly<Record<string, unknown>>;
  createdAt: number;
}

export type SettlementDisputeStatus = 'open' | 'upheld' | 'rejected';

/**
 * An operator's objection to one epoch's settlement. The note is kept for the
 * operator and compliance only; audit rows carry the evidence hash, never the note.
 */
export interface SettlementDisputeRecord {
  disputeId: string;
  epoch: number;
  operatorAddress: Address;
  operatorIdHash: Hex32;
  nodeId: Hex32 | null;
  reasonCode: string;
  evidenceHash: Hex32;
  note: string;
  status: SettlementDisputeStatus;
  resolutionNote: string | null;
  openedAt: number;
  resolvedAt: number | null;
}

export interface AuditRecord {
  auditId: string;
  action: string;
  actorType: ActorType;
  actorIdHash: Hex32;
  subjectType: 'task' | 'node' | 'lease' | 'receipt' | 'session' | 'settlement';
  subjectIdHash: Hex32;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  createdAt: number;
}

export interface StorageTransaction {
  insertTask(task: TaskRecord): void;
  getTask(taskId: Hex32): TaskRecord | undefined;
  listTasks(): readonly TaskRecord[];
  updateTask(task: TaskRecord, expectedVersion: number): void;
  appendTaskEvent(event: Omit<TaskEventRecord, 'eventId'>): TaskEventRecord;
  listTaskEvents(taskId: Hex32): readonly TaskEventRecord[];

  insertNode(node: NodeDeviceRecord): void;
  getNode(nodeId: Hex32): NodeDeviceRecord | undefined;
  listNodes(): readonly NodeDeviceRecord[];
  getNodeByDeviceAddress(deviceAddress: Address): NodeDeviceRecord | undefined;
  updateNode(node: NodeDeviceRecord): void;

  insertLease(lease: Omit<TaskLeaseRecord, 'leaseId'>): TaskLeaseRecord;
  getLease(taskId: Hex32, nonce: Hex32): TaskLeaseRecord | undefined;
  getActiveLease(taskId: Hex32): TaskLeaseRecord | undefined;
  listExpiredActiveLeases(now: number): readonly TaskLeaseRecord[];
  updateLease(lease: TaskLeaseRecord): void;

  insertReceipt(receipt: Omit<ReceiptRecord, 'receiptId'>): ReceiptRecord;
  getReceipt(taskId: Hex32, kind: ReceiptKind): ReceiptRecord | undefined;

  insertSettlementDispute(dispute: Omit<SettlementDisputeRecord, 'disputeId'>): SettlementDisputeRecord;
  getSettlementDispute(disputeId: string): SettlementDisputeRecord | undefined;
  listSettlementDisputes(): readonly SettlementDisputeRecord[];
  updateSettlementDispute(dispute: SettlementDisputeRecord): void;

  appendAudit(event: Omit<AuditRecord, 'auditId'>): AuditRecord;
  listAudit(): readonly AuditRecord[];
}

export interface Storage {
  transaction<T>(operation: (transaction: StorageTransaction) => Promise<T> | T): Promise<T>;
}

interface MemoryState {
  tasks: Map<Hex32, TaskRecord>;
  taskEvents: TaskEventRecord[];
  nodes: Map<Hex32, NodeDeviceRecord>;
  leases: Map<string, TaskLeaseRecord>;
  receipts: Map<string, ReceiptRecord>;
  settlementDisputes: Map<string, SettlementDisputeRecord>;
  audit: AuditRecord[];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function leaseKey(taskId: Hex32, nonce: Hex32): string {
  return `${taskId}:${nonce}`;
}

function receiptKey(taskId: Hex32, kind: ReceiptKind): string {
  return `${taskId}:${kind}`;
}

class MemoryTransaction implements StorageTransaction {
  constructor(readonly state: MemoryState) {}

  insertTask(task: TaskRecord): void {
    if (this.state.tasks.has(task.taskId)) throw new Error('TASK_ALREADY_EXISTS');
    this.state.tasks.set(task.taskId, clone(task));
  }

  getTask(taskId: Hex32): TaskRecord | undefined {
    const task = this.state.tasks.get(taskId);
    return task ? clone(task) : undefined;
  }

  listTasks(): readonly TaskRecord[] {
    return clone([...this.state.tasks.values()]);
  }

  updateTask(task: TaskRecord, expectedVersion: number): void {
    const current = this.state.tasks.get(task.taskId);
    if (!current) throw new Error('TASK_NOT_FOUND');
    if (current.rowVersion !== expectedVersion) throw new Error('TASK_VERSION_CONFLICT');
    if (task.rowVersion !== expectedVersion + 1) throw new Error('TASK_VERSION_INCREMENT_REQUIRED');
    this.state.tasks.set(task.taskId, clone(task));
  }

  appendTaskEvent(event: Omit<TaskEventRecord, 'eventId'>): TaskEventRecord {
    const record = { ...clone(event), eventId: randomUUID() };
    this.state.taskEvents.push(record);
    return clone(record);
  }

  listTaskEvents(taskId: Hex32): readonly TaskEventRecord[] {
    return clone(this.state.taskEvents.filter((event) => event.taskId === taskId));
  }

  insertNode(node: NodeDeviceRecord): void {
    if (this.state.nodes.has(node.nodeId)) throw new Error('NODE_ALREADY_EXISTS');
    for (const current of this.state.nodes.values()) {
      if (current.deviceAddress.toLowerCase() === node.deviceAddress.toLowerCase()) {
        throw new Error('DEVICE_ADDRESS_ALREADY_EXISTS');
      }
      if (current.deviceKeyHash === node.deviceKeyHash) throw new Error('DEVICE_KEY_ALREADY_EXISTS');
    }
    this.state.nodes.set(node.nodeId, clone(node));
  }

  getNode(nodeId: Hex32): NodeDeviceRecord | undefined {
    const node = this.state.nodes.get(nodeId);
    return node ? clone(node) : undefined;
  }

  listNodes(): readonly NodeDeviceRecord[] {
    return clone([...this.state.nodes.values()]);
  }

  getNodeByDeviceAddress(deviceAddress: Address): NodeDeviceRecord | undefined {
    for (const node of this.state.nodes.values()) {
      if (node.deviceAddress.toLowerCase() === deviceAddress.toLowerCase()) return clone(node);
    }
    return undefined;
  }

  updateNode(node: NodeDeviceRecord): void {
    if (!this.state.nodes.has(node.nodeId)) throw new Error('NODE_NOT_FOUND');
    this.state.nodes.set(node.nodeId, clone(node));
  }

  insertLease(lease: Omit<TaskLeaseRecord, 'leaseId'>): TaskLeaseRecord {
    if (this.state.leases.has(leaseKey(lease.taskId, lease.nonce))) throw new Error('LEASE_NONCE_ALREADY_USED');
    if (this.getActiveLease(lease.taskId)) throw new Error('TASK_ALREADY_LEASED');
    const record = { ...clone(lease), leaseId: randomUUID() };
    this.state.leases.set(leaseKey(record.taskId, record.nonce), record);
    return clone(record);
  }

  getLease(taskId: Hex32, nonce: Hex32): TaskLeaseRecord | undefined {
    const lease = this.state.leases.get(leaseKey(taskId, nonce));
    return lease ? clone(lease) : undefined;
  }

  getActiveLease(taskId: Hex32): TaskLeaseRecord | undefined {
    for (const lease of this.state.leases.values()) {
      if (lease.taskId === taskId && lease.status === 'active') return clone(lease);
    }
    return undefined;
  }

  listExpiredActiveLeases(now: number): readonly TaskLeaseRecord[] {
    return clone(
      [...this.state.leases.values()].filter((lease) => lease.status === 'active' && lease.expiresAt <= now),
    );
  }

  updateLease(lease: TaskLeaseRecord): void {
    const key = leaseKey(lease.taskId, lease.nonce);
    if (!this.state.leases.has(key)) throw new Error('LEASE_NOT_FOUND');
    this.state.leases.set(key, clone(lease));
  }

  insertReceipt(receipt: Omit<ReceiptRecord, 'receiptId'>): ReceiptRecord {
    const key = receiptKey(receipt.taskId, receipt.kind);
    const existing = this.state.receipts.get(key);
    if (existing) {
      if (existing.receiptHash === receipt.receiptHash) return clone(existing);
      throw new Error('RECEIPT_CONFLICT');
    }
    const record = { ...clone(receipt), receiptId: randomUUID() };
    this.state.receipts.set(key, record);
    return clone(record);
  }

  getReceipt(taskId: Hex32, kind: ReceiptKind): ReceiptRecord | undefined {
    const receipt = this.state.receipts.get(receiptKey(taskId, kind));
    return receipt ? clone(receipt) : undefined;
  }

  insertSettlementDispute(dispute: Omit<SettlementDisputeRecord, 'disputeId'>): SettlementDisputeRecord {
    const record = { ...dispute, disputeId: randomUUID() };
    this.state.settlementDisputes.set(record.disputeId, record);
    return record;
  }

  getSettlementDispute(disputeId: string): SettlementDisputeRecord | undefined {
    const record = this.state.settlementDisputes.get(disputeId);
    return record ? { ...record } : undefined;
  }

  listSettlementDisputes(): readonly SettlementDisputeRecord[] {
    return [...this.state.settlementDisputes.values()].map((record) => ({ ...record }));
  }

  updateSettlementDispute(dispute: SettlementDisputeRecord): void {
    if (!this.state.settlementDisputes.has(dispute.disputeId)) throw new Error('SETTLEMENT_DISPUTE_NOT_FOUND');
    this.state.settlementDisputes.set(dispute.disputeId, { ...dispute });
  }

  appendAudit(event: Omit<AuditRecord, 'auditId'>): AuditRecord {
    const record = { ...clone(event), auditId: randomUUID() };
    this.state.audit.push(record);
    return clone(record);
  }

  listAudit(): readonly AuditRecord[] {
    return clone(this.state.audit);
  }
}

export class MemoryStorage implements Storage {
  private state: MemoryState = {
    tasks: new Map(),
    taskEvents: [],
    nodes: new Map(),
    leases: new Map(),
    receipts: new Map(),
      settlementDisputes: new Map(),
    audit: [],
  };

  private tail: Promise<void> = Promise.resolve();

  async transaction<T>(operation: (transaction: StorageTransaction) => Promise<T> | T): Promise<T> {
    let release: () => void = () => undefined;
    const previous = this.tail;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const transaction = new MemoryTransaction(clone(this.state));
    try {
      const result = await operation(transaction);
      this.state = transaction.state;
      return clone(result);
    } finally {
      release();
    }
  }
}
