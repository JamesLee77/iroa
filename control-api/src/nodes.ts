import type { Address, Hex32, PolicyVersion } from '@iroa/protocol';
import { AddressSchema, Hex32Schema, PolicyVersionSchema } from '@iroa/protocol';
import { z } from 'zod';
import { appendAudit, hashIdentifier } from './audit.js';
import type { AuthenticatedActor } from './auth.js';
import type { NodeDeviceRecord, NodeStatus, Storage } from './storage.js';

const ENROLLMENT_SCHEMA = z.object({
  deviceAddress: AddressSchema,
  deviceKeyHash: Hex32Schema,
  trustLevel: z.enum(['N0', 'N1', 'N2', 'N3']),
  policyVersion: PolicyVersionSchema,
}).strict();

const HEARTBEAT_SCHEMA = z.object({
  agentVersion: z.string().trim().regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/).max(64),
  policyVersion: PolicyVersionSchema,
  capacityBucket: z.enum(['idle', 'low', 'medium', 'high']),
}).strict();

export interface EnrollmentInput {
  deviceAddress: Address;
  deviceKeyHash: Hex32;
  trustLevel: 'N0' | 'N1' | 'N2' | 'N3';
  policyVersion: PolicyVersion;
}

export function deriveNodeId(operatorAddress: string, deviceKeyHash: Hex32): Hex32 {
  return hashIdentifier(`${operatorAddress.toLowerCase()}:${deviceKeyHash}`);
}

export class NodeService {
  private readonly complianceOperators: ReadonlySet<string>;

  constructor(
    private readonly storage: Storage,
    complianceOperators: readonly string[],
    private readonly now: () => number = () => Math.floor(Date.now() / 1_000),
  ) {
    this.complianceOperators = new Set(complianceOperators.map((address) => AddressSchema.parse(address).toLowerCase()));
  }

  async enroll(
    operator: AuthenticatedActor,
    inputValue: unknown,
    deviceProof: AuthenticatedActor,
  ): Promise<NodeDeviceRecord> {
    if (operator.type !== 'operator') throw new Error('OPERATOR_AUTH_REQUIRED');
    if (deviceProof.type !== 'node') throw new Error('DEVICE_PROOF_REQUIRED');
    const input = ENROLLMENT_SCHEMA.parse(inputValue);
    const operatorAddress = AddressSchema.parse(operator.id);
    const nodeId = deriveNodeId(operatorAddress, input.deviceKeyHash);
    if (deviceProof.id !== nodeId) throw new Error('DEVICE_PROOF_NODE_MISMATCH');
    const now = this.now();
    const node: NodeDeviceRecord = {
      nodeId,
      operatorAddress,
      deviceAddress: input.deviceAddress,
      deviceKeyHash: input.deviceKeyHash,
      trustLevel: input.trustLevel,
      policyVersion: input.policyVersion,
      status: 'pending',
      agentVersion: null,
      capacityBucket: null,
      lastSeenAt: null,
      createdAt: now,
      updatedAt: now,
    };
    return this.storage.transaction((transaction) => {
      transaction.insertNode(node);
      appendAudit(transaction, {
        action: 'NODE_ENROLLED',
        actorType: 'operator',
        actorId: operator.id,
        subjectType: 'node',
        subjectId: node.nodeId,
        metadata: { trustLevel: node.trustLevel, policyVersion: node.policyVersion },
        now,
      });
      return node;
    });
  }

  async setStatus(operator: AuthenticatedActor, nodeIdInput: string, status: NodeStatus): Promise<NodeDeviceRecord> {
    if (operator.type !== 'operator' || !this.complianceOperators.has(operator.id.toLowerCase())) {
      throw new Error('COMPLIANCE_AUTH_REQUIRED');
    }
    const nodeId = Hex32Schema.parse(nodeIdInput);
    if (!['active', 'suspended', 'revoked'].includes(status)) throw new Error('INVALID_NODE_STATUS_CHANGE');
    const now = this.now();
    return this.storage.transaction((transaction) => {
      const current = transaction.getNode(nodeId);
      if (!current) throw new Error('NODE_NOT_FOUND');
      if (current.status === 'revoked') throw new Error('NODE_REVOKED');
      const updated = { ...current, status, updatedAt: now };
      transaction.updateNode(updated);
      appendAudit(transaction, {
        action: `NODE_${status.toUpperCase()}`,
        actorType: 'operator',
        actorId: operator.id,
        subjectType: 'node',
        subjectId: nodeId,
        metadata: {},
        now,
      });
      return updated;
    });
  }

  async heartbeat(actor: AuthenticatedActor, inputValue: unknown): Promise<NodeDeviceRecord> {
    if (actor.type !== 'node') throw new Error('NODE_AUTH_REQUIRED');
    const nodeId = Hex32Schema.parse(actor.id);
    const input = HEARTBEAT_SCHEMA.parse(inputValue);
    const now = this.now();
    return this.storage.transaction((transaction) => {
      const current = transaction.getNode(nodeId);
      if (!current) throw new Error('NODE_NOT_FOUND');
      if (current.status === 'suspended' || current.status === 'revoked') throw new Error('NODE_INACTIVE');
      if (current.policyVersion !== input.policyVersion) throw new Error('POLICY_VERSION_MISMATCH');
      const updated: NodeDeviceRecord = {
        ...current,
        agentVersion: input.agentVersion,
        capacityBucket: input.capacityBucket,
        lastSeenAt: now,
        updatedAt: now,
      };
      transaction.updateNode(updated);
      appendAudit(transaction, {
        action: 'NODE_HEARTBEAT',
        actorType: 'node',
        actorId: nodeId,
        subjectType: 'node',
        subjectId: nodeId,
        metadata: { agentVersion: input.agentVersion, capacityBucket: input.capacityBucket },
        now,
      });
      return updated;
    });
  }

  async getNode(nodeIdInput: string): Promise<NodeDeviceRecord> {
    const nodeId = Hex32Schema.parse(nodeIdInput);
    return this.storage.transaction((transaction) => {
      const node = transaction.getNode(nodeId);
      if (!node) throw new Error('NODE_NOT_FOUND');
      return node;
    });
  }
}
