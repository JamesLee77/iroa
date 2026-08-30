export interface NodeTransactionResult {
  hash: `0x${string}`;
  auditStatus: 'confirmed' | 'pending_reconciliation';
}

export async function executeNodeTransaction(input: {
  submit(): Promise<`0x${string}`>;
  wait(hash: `0x${string}`): Promise<'success' | 'reverted'>;
  record(result: 'pending' | 'confirmed' | 'failed', hash: `0x${string}` | null): Promise<void>;
}): Promise<NodeTransactionResult> {
  await input.record('pending', null);
  let hash: `0x${string}` | null = null;
  try {
    hash = await input.submit();
    if (await input.wait(hash) !== 'success') throw new Error('NODE_TRANSACTION_REVERTED');
  } catch (cause) {
    if (hash) await input.record('failed', hash).catch(() => undefined);
    throw cause;
  }
  try {
    await input.record('confirmed', hash);
    return { hash, auditStatus: 'confirmed' };
  } catch {
    return { hash, auditStatus: 'pending_reconciliation' };
  }
}
