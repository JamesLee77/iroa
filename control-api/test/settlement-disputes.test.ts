import { describe, expect, it } from 'vitest';
import type { Address, Hex32 } from '@iroa/protocol';
import { hashIdentifier } from '../src/audit.js';
import type { AuthenticatedActor } from '../src/auth.js';
import { SettlementDisputeService } from '../src/settlement-disputes.js';
import { MemoryStorage } from '../src/storage.js';

const operatorWallet = '0x1111111111111111111111111111111111111111' as Address;
const otherWallet = '0x2222222222222222222222222222222222222222' as Address;
const complianceWallet = '0x3333333333333333333333333333333333333333' as Address;

const actorFor = (wallet: Address): AuthenticatedActor => ({
  type: 'operator', id: wallet, idHash: hashIdentifier(wallet), sessionId: `session-${wallet.slice(2, 6)}`,
});
const operator = actorFor(operatorWallet);
const other = actorFor(otherWallet);
const compliance = actorFor(complianceWallet);
const user: AuthenticatedActor = { type: 'user', id: 'user-1', idHash: hashIdentifier('user-1'), sessionId: 'user-session' };

const note = '에폭 3의 작업 두 건이 결과 확인서까지 제출됐는데 정산에서 제외됐습니다.';
let clock = 1_800_000_000;
const service = () => {
  const storage = new MemoryStorage();
  return { storage, service: new SettlementDisputeService(storage, [complianceWallet], () => clock) };
};

describe('operator settlement disputes', () => {
  it('records an objection under the operator identity with the note hashed as evidence', async () => {
    const { service: disputes, storage } = service();
    const opened = await disputes.open(operator, { epoch: 3, reasonCode: 'TASK_EXCLUDED', note });
    expect(opened.status).toBe('open');
    expect(opened.operatorIdHash).toBe(operator.idHash);
    expect(opened.evidenceHash).toBe(hashIdentifier(note));
    expect(opened).not.toHaveProperty('operatorAddress');

    const audit = await storage.transaction((transaction) => transaction.listAudit());
    expect(audit.map((row) => row.action)).toEqual(['SETTLEMENT_DISPUTE_OPENED']);
    expect(JSON.stringify(audit[0]?.metadata)).not.toContain(note.slice(0, 8));
    expect(audit[0]?.metadata.evidenceHash).toBe(opened.evidenceHash);
  });

  it('keeps a supplied evidence hash and an optional NODE id', async () => {
    const { service: disputes } = service();
    const evidenceHash = `0x${'ab'.repeat(32)}` as Hex32;
    const nodeId = `0x${'cd'.repeat(32)}` as Hex32;
    const opened = await disputes.open(operator, { epoch: 1, nodeId, reasonCode: 'SCORE_UNDERSTATED', evidenceHash, note });
    expect(opened.evidenceHash).toBe(evidenceHash);
    expect(opened.nodeId).toBe(nodeId);
  });

  it('allows one open dispute per operator and epoch, and another after resolution', async () => {
    const { service: disputes } = service();
    const first = await disputes.open(operator, { epoch: 2, reasonCode: 'OTHER', note });
    await expect(disputes.open(operator, { epoch: 2, reasonCode: 'OTHER', note })).rejects.toThrow('SETTLEMENT_DISPUTE_ALREADY_OPEN');
    await expect(disputes.open(other, { epoch: 2, reasonCode: 'OTHER', note })).resolves.toMatchObject({ epoch: 2 });
    await disputes.resolve(compliance, first.disputeId, { resolution: 'rejected', note: '증거 해시가 결산 입력과 일치하며 제외 사유가 유효합니다.' });
    await expect(disputes.open(operator, { epoch: 2, reasonCode: 'RECEIPT_NOT_COUNTED', note })).resolves.toMatchObject({ status: 'open' });
  });

  it('rejects notes that are too short, too long, or carry a blob reference, and unknown reason codes', async () => {
    const { service: disputes } = service();
    await expect(disputes.open(operator, { epoch: 1, reasonCode: 'OTHER', note: '짧음' })).rejects.toThrow();
    await expect(disputes.open(operator, { epoch: 1, reasonCode: 'OTHER', note: 'x'.repeat(501) })).rejects.toThrow();
    await expect(disputes.open(operator, { epoch: 1, reasonCode: 'OTHER', note: `${note} iroa-blob://x` })).rejects.toThrow();
    await expect(disputes.open(operator, { epoch: 1, reasonCode: 'BRIBE', note })).rejects.toThrow();
    await expect(disputes.open(user, { epoch: 1, reasonCode: 'OTHER', note })).rejects.toThrow('OPERATOR_AUTH_REQUIRED');
  });

  it('shows an operator only their own disputes', async () => {
    const { service: disputes } = service();
    await disputes.open(operator, { epoch: 1, reasonCode: 'OTHER', note });
    await disputes.open(other, { epoch: 1, reasonCode: 'OTHER', note });
    expect(await disputes.listForOperator(operator)).toHaveLength(1);
    expect(await disputes.listForCompliance(compliance)).toHaveLength(2);
    await expect(disputes.listForCompliance(operator)).rejects.toThrow('COMPLIANCE_AUTH_REQUIRED');
  });

  it('lets only compliance resolve, exactly once, and records the outcome without the note', async () => {
    const { service: disputes, storage } = service();
    const opened = await disputes.open(operator, { epoch: 4, reasonCode: 'TASK_EXCLUDED', note });
    const reviewNote = '결과 확인서 두 건이 정책 버전 1.0.0으로 검증되어 이의를 인정합니다.';
    await expect(disputes.resolve(operator, opened.disputeId, { resolution: 'upheld', note: reviewNote })).rejects.toThrow('COMPLIANCE_AUTH_REQUIRED');
    await expect(disputes.resolve(compliance, 'missing', { resolution: 'upheld', note: reviewNote })).rejects.toThrow('SETTLEMENT_DISPUTE_NOT_FOUND');

    clock += 60;
    const upheld = await disputes.resolve(compliance, opened.disputeId, { resolution: 'upheld', note: reviewNote });
    expect(upheld.status).toBe('upheld');
    expect(upheld.resolvedAt).toBe(opened.openedAt + 60);
    expect(upheld.resolutionNote).toBe(reviewNote);
    await expect(disputes.resolve(compliance, opened.disputeId, { resolution: 'rejected', note: reviewNote })).rejects.toThrow('SETTLEMENT_DISPUTE_ALREADY_RESOLVED');

    const audit = await storage.transaction((transaction) => transaction.listAudit());
    expect(audit.map((row) => row.action)).toEqual(['SETTLEMENT_DISPUTE_OPENED', 'SETTLEMENT_DISPUTE_UPHELD']);
    expect(JSON.stringify(audit)).not.toContain(reviewNote.slice(0, 8));
  });
});
