import { createHash } from 'node:crypto';
import type { Hex32 } from '@iroa/protocol';
import type { ActorType, AuditRecord, StorageTransaction } from './storage.js';

const SENSITIVE_KEY = /(ciphertext|plaintext|payload|capsule|secret|signature|cookie|authorization|input|output)/i;
const ACTION = /^[A-Z][A-Z0-9_]{0,63}$/;
const SAFE_KEY = /^[a-z][a-zA-Z0-9]{0,63}$/;

export function hashIdentifier(value: string): Hex32 {
  return `0x${createHash('sha256').update(value).digest('hex')}` as Hex32;
}

export function sanitizeAuditMetadata(
  metadata: Readonly<Record<string, string | number | boolean | null>>,
): Readonly<Record<string, string | number | boolean | null>> {
  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_KEY.test(key) || SENSITIVE_KEY.test(key)) throw new Error('AUDIT_METADATA_KEY_REJECTED');
    if (typeof value === 'string') {
      if (value.length > 256 || value.includes('iroa-blob://')) throw new Error('AUDIT_METADATA_VALUE_REJECTED');
      sanitized[key] = value.replace(/[\r\n\u2028\u2029]/g, ' ');
    } else {
      sanitized[key] = value;
    }
  }
  return Object.freeze(sanitized);
}

export function appendAudit(
  transaction: StorageTransaction,
  input: {
    action: string;
    actorType: ActorType;
    actorId: string;
    subjectType: AuditRecord['subjectType'];
    subjectId: string;
    metadata?: Readonly<Record<string, string | number | boolean | null>>;
    now: number;
  },
): AuditRecord {
  if (!ACTION.test(input.action)) throw new Error('INVALID_AUDIT_ACTION');
  return transaction.appendAudit({
    action: input.action,
    actorType: input.actorType,
    actorIdHash: hashIdentifier(input.actorId),
    subjectType: input.subjectType,
    subjectIdHash: hashIdentifier(input.subjectId),
    metadata: sanitizeAuditMetadata(input.metadata ?? {}),
    createdAt: input.now,
  });
}
