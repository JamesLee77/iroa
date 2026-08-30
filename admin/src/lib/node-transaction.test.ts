import { describe, expect, it, vi } from 'vitest';
import { executeNodeTransaction } from './node-transaction';

const HASH = `0x${'11'.repeat(32)}` as const;

describe('NODE transaction audit reconciliation', () => {
  it('does not relabel a confirmed chain transaction as failed when outcome audit recording is unavailable', async () => {
    const record = vi.fn(async (result: 'pending' | 'confirmed' | 'failed') => {
      if (result === 'confirmed') throw new Error('AUDIT_API_UNAVAILABLE');
    });
    await expect(executeNodeTransaction({
      submit: async () => HASH,
      wait: async () => 'success',
      record,
    })).resolves.toEqual({ hash: HASH, auditStatus: 'pending_reconciliation' });
    expect(record).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenNthCalledWith(1, 'pending', null);
    expect(record).toHaveBeenNthCalledWith(2, 'confirmed', HASH);
    expect(record).not.toHaveBeenCalledWith('failed', HASH);
  });
});
