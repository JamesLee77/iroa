import { describe, expect, it } from 'vitest';
import { assertSuccessfulReceipt, formatIroa } from './contracts';
import { sessionIsActive } from './api';
import { PolicyVersionSchema, TaskStateSchema } from '@iroa/protocol';
import { DEFAULT_POLICY_VERSION } from '../pages/Enrollment';
import { taskStateLabel } from '../pages/Tasks';

describe('operator chain safety helpers', () => {
  it('renders the full exact 18-decimal token amount without truncation', () => {
    expect(formatIroa(1_000_000_000_000_000_001n)).toBe('1.000000000000000001');
  });

  it('rejects a mined transaction whose receipt reports a revert', () => {
    expect(() => assertSuccessfulReceipt({ status: 'reverted' })).toThrow('TRANSACTION_REVERTED');
    expect(() => assertSuccessfulReceipt({ status: 'success' })).not.toThrow();
  });

  it('locks writes as soon as the locally bound SIWE session expires', () => {
    const session = {
      wallet: '0x1111111111111111111111111111111111111111',
      actorIdHash: `0x${'22'.repeat(32)}`,
      csrfToken: 'csrf-token-1234567890',
      expiresAt: 1_800_000_000,
    } as const;
    expect(sessionIsActive(session, 1_799_999_994)).toBe(true);
    expect(sessionIsActive(session, 1_799_999_995)).toBe(false);
  });

  it('uses a protocol-valid default policy version for NODE enrollment', () => {
    expect(PolicyVersionSchema.safeParse(DEFAULT_POLICY_VERSION).success).toBe(true);
  });

  it('labels every protocol task state in both portal languages', () => {
    for (const state of TaskStateSchema.options) {
      expect(taskStateLabel(state, 'ko')).not.toBe('');
      expect(taskStateLabel(state, 'en')).not.toBe('');
    }
  });
});
