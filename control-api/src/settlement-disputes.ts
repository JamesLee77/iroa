import { AddressSchema, Hex32Schema, type Address, type Hex32 } from '@iroa/protocol';
import { z } from 'zod';
import { appendAudit, hashIdentifier } from './audit.js';
import type { AuthenticatedActor } from './auth.js';
import type { SettlementDisputeRecord, Storage } from './storage.js';

/**
 * Why an operator objects to an epoch's settlement. Each code names the input the
 * verifier re-checks when the dispute is upheld and the root is rebuilt.
 */
export const SETTLEMENT_DISPUTE_REASONS = [
  'TASK_EXCLUDED',
  'SCORE_UNDERSTATED',
  'RECEIPT_NOT_COUNTED',
  'POLICY_VERSION_MISMATCH',
  'OTHER',
] as const;

const NOTE = z.string().trim().min(10).max(500).refine((note) => !note.includes('iroa-blob://'), 'NOTE_CONTAINS_BLOB_REFERENCE');

const OPEN_SCHEMA = z.object({
  epoch: z.number().int().nonnegative(),
  nodeId: Hex32Schema.nullable().optional(),
  reasonCode: z.enum(SETTLEMENT_DISPUTE_REASONS),
  evidenceHash: Hex32Schema.optional(),
  note: NOTE,
}).strict();

const RESOLVE_SCHEMA = z.object({
  resolution: z.enum(['upheld', 'rejected']),
  note: NOTE,
}).strict();

export type SettlementDisputeView = Omit<SettlementDisputeRecord, 'operatorAddress'>;

function assertOperator(actor: AuthenticatedActor): Address {
  if (actor.type !== 'operator') throw new Error('OPERATOR_AUTH_REQUIRED');
  return AddressSchema.parse(actor.id);
}

function publicView(record: SettlementDisputeRecord): SettlementDisputeView {
  const { operatorAddress: _operatorAddress, ...view } = record;
  return view;
}

/**
 * The operator's side of the dispute procedure (whitepaper §15.5). An operator
 * objects to one epoch through the portal; compliance reviews it here and, when
 * it is upheld, executes `challengeRoot` on-chain with the dispute's evidence hash
 * inside the challenge window. Nothing here touches the chain.
 */
export class SettlementDisputeService {
  private readonly complianceOperators: ReadonlySet<string>;

  constructor(
    private readonly storage: Storage,
    complianceOperators: readonly string[],
    private readonly now: () => number = () => Math.floor(Date.now() / 1_000),
  ) {
    this.complianceOperators = new Set(complianceOperators.map((address) => AddressSchema.parse(address).toLowerCase()));
  }

  async open(actor: AuthenticatedActor, inputValue: unknown): Promise<SettlementDisputeView> {
    const operatorAddress = assertOperator(actor);
    const input = OPEN_SCHEMA.parse(inputValue);
    const now = this.now();
    return this.storage.transaction((transaction) => {
      const duplicate = transaction.listSettlementDisputes().find((record) =>
        record.status === 'open'
        && record.epoch === input.epoch
        && record.operatorAddress.toLowerCase() === operatorAddress.toLowerCase());
      if (duplicate) throw new Error('SETTLEMENT_DISPUTE_ALREADY_OPEN');

      const record = transaction.insertSettlementDispute({
        epoch: input.epoch,
        operatorAddress,
        operatorIdHash: Hex32Schema.parse(actor.idHash),
        nodeId: input.nodeId ?? null,
        reasonCode: input.reasonCode,
        // Without separate evidence the note itself is the evidence; its hash is what
        // goes on-chain, so the note can be verified later without being published.
        evidenceHash: input.evidenceHash ?? hashIdentifier(input.note),
        note: input.note,
        status: 'open',
        resolutionNote: null,
        openedAt: now,
        resolvedAt: null,
      });
      appendAudit(transaction, {
        action: 'SETTLEMENT_DISPUTE_OPENED',
        actorType: 'operator',
        actorId: operatorAddress,
        subjectType: 'settlement',
        subjectId: record.disputeId,
        metadata: { epoch: record.epoch, reasonCode: record.reasonCode, evidenceHash: record.evidenceHash },
        now,
      });
      return publicView(record);
    });
  }

  async listForOperator(actor: AuthenticatedActor): Promise<readonly SettlementDisputeView[]> {
    const operatorAddress = assertOperator(actor).toLowerCase();
    return this.storage.transaction((transaction) => [...transaction.listSettlementDisputes()]
      .filter((record) => record.operatorAddress.toLowerCase() === operatorAddress)
      .sort((left, right) => right.openedAt - left.openedAt)
      .map(publicView));
  }

  async listForCompliance(actor: AuthenticatedActor): Promise<readonly SettlementDisputeView[]> {
    this.assertCompliance(actor);
    return this.storage.transaction((transaction) => [...transaction.listSettlementDisputes()]
      .sort((left, right) => right.openedAt - left.openedAt)
      .map(publicView));
  }

  async resolve(actor: AuthenticatedActor, disputeId: string, inputValue: unknown): Promise<SettlementDisputeView> {
    const reviewer = this.assertCompliance(actor);
    const input = RESOLVE_SCHEMA.parse(inputValue);
    const now = this.now();
    return this.storage.transaction((transaction) => {
      const record = transaction.getSettlementDispute(disputeId);
      if (!record) throw new Error('SETTLEMENT_DISPUTE_NOT_FOUND');
      if (record.status !== 'open') throw new Error('SETTLEMENT_DISPUTE_ALREADY_RESOLVED');
      const resolved: SettlementDisputeRecord = {
        ...record,
        status: input.resolution,
        resolutionNote: input.note,
        resolvedAt: now,
      };
      transaction.updateSettlementDispute(resolved);
      appendAudit(transaction, {
        action: input.resolution === 'upheld' ? 'SETTLEMENT_DISPUTE_UPHELD' : 'SETTLEMENT_DISPUTE_REJECTED',
        actorType: 'operator',
        actorId: reviewer,
        subjectType: 'settlement',
        subjectId: record.disputeId,
        metadata: { epoch: record.epoch, reasonCode: record.reasonCode, evidenceHash: record.evidenceHash },
        now,
      });
      return publicView(resolved);
    });
  }

  private assertCompliance(actor: AuthenticatedActor): Address {
    const address = assertOperator(actor);
    if (!this.complianceOperators.has(address.toLowerCase())) throw new Error('COMPLIANCE_AUTH_REQUIRED');
    return address;
  }
}
