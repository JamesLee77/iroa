import { useEffect, useState, type FormEvent } from 'react';
import type { Hex } from 'viem';
import { usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { Icon } from '../components/Icon';
import { useOperator } from '../context/OperatorContext';
import { listRewards, listSettlementDisputes, openSettlementDispute, SETTLEMENT_DISPUTE_REASONS, type OperatorRewardRecord, type SettlementDispute, type SettlementDisputeReason } from '../lib/api';
import { assertSuccessfulReceipt, formatIroa, requireContract, rewardDistributorAbi, rewardLeafHash } from '../lib/contracts';
import { t, type Locale } from '../lib/i18n';
import { operatorProfile } from '../lib/wagmi';

const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex;

function quality(value: number): string {
  return `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}%`;
}

const REASON_LABEL: Record<SettlementDisputeReason, 'reasonTaskExcluded' | 'reasonScoreUnderstated' | 'reasonReceiptNotCounted' | 'reasonPolicyMismatch' | 'reasonOther'> = {
  TASK_EXCLUDED: 'reasonTaskExcluded',
  SCORE_UNDERSTATED: 'reasonScoreUnderstated',
  RECEIPT_NOT_COUNTED: 'reasonReceiptNotCounted',
  POLICY_VERSION_MISMATCH: 'reasonPolicyMismatch',
  OTHER: 'reasonOther',
};

/**
 * The operator's route into the dispute procedure. The form never carries a
 * receipt or a capsule reference: compliance reviews the note and the hash of it
 * is what a challenge would put on-chain.
 */
function SettlementDisputes({ locale, epochHint, onEpochHintUsed }: { locale: Locale; epochHint: number | null; onEpochHintUsed: () => void }) {
  const [disputes, setDisputes] = useState<SettlementDispute[]>([]);
  const [epoch, setEpoch] = useState('');
  const [reason, setReason] = useState<SettlementDisputeReason>('TASK_EXCLUDED');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function refresh() {
    try { setDisputes(await listSettlementDisputes()); } catch { setDisputes([]); }
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (epochHint === null) return;
    setEpoch(String(epochHint));
    setSent(false);
    onEpochHintUsed();
  }, [epochHint, onEpochHintUsed]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await openSettlementDispute({ epoch: Number(epoch), reasonCode: reason, note: note.trim() });
      setNote('');
      setSent(true);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'SETTLEMENT_DISPUTE_ALREADY_OPEN'
        ? (locale === 'ko' ? '이 에폭에는 이미 검토 중인 이의가 있습니다.' : 'A dispute for this epoch is already under review.')
        : t(locale, 'error'));
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = (status: SettlementDispute['status']) =>
    status === 'open' ? t(locale, 'disputeOpen') : status === 'upheld' ? t(locale, 'disputeUpheld') : t(locale, 'disputeRejected');

  return (
    <section className="form-card" aria-labelledby="settlement-dispute-title">
      <h2 id="settlement-dispute-title">{t(locale, 'disputeTitle')}</h2>
      <p className="lead">{t(locale, 'disputeLead')}</p>
      <form onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <label>{t(locale, 'disputeEpoch')}<input required inputMode="numeric" pattern="[0-9]+" value={epoch} onChange={(event) => setEpoch(event.target.value)} /></label>
          <label>{t(locale, 'disputeReason')}<select value={reason} onChange={(event) => setReason(event.target.value as SettlementDisputeReason)}>{SETTLEMENT_DISPUTE_REASONS.map((code) => <option key={code} value={code}>{t(locale, REASON_LABEL[code])}</option>)}</select></label>
        </div>
        <label>{t(locale, 'disputeNote')}<textarea required minLength={10} maxLength={500} rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {sent && <p className="inline-success" role="status"><Icon name="check" />{t(locale, 'disputeSent')}</p>}
        <button className="secondary-button" type="submit" disabled={busy || note.trim().length < 10 || !epoch}>{busy ? t(locale, 'disputeSubmitting') : t(locale, 'disputeSubmit')}</button>
      </form>
      <h3>{t(locale, 'myDisputes')}</h3>
      {disputes.length === 0 ? <p className="field-help">{t(locale, 'noDisputes')}</p> : <ul className="data-list">{disputes.map((dispute) => <li className="data-card" key={dispute.disputeId}>
        <div className="data-card__heading"><span className={`status-chip status-${dispute.status === 'open' ? 'pending' : dispute.status === 'upheld' ? 'claimable' : 'excluded'}`}>{statusLabel(dispute.status)}</span><span>{t(locale, 'disputeEpoch')} {dispute.epoch}</span></div>
        <dl className="technical-list"><div><dt>{t(locale, 'disputeReason')}</dt><dd>{t(locale, REASON_LABEL[dispute.reasonCode])}</dd></div><div><dt>Evidence hash</dt><dd><code>{dispute.evidenceHash}</code></dd></div>{dispute.resolutionNote && <div><dt>{t(locale, 'disputeReview')}</dt><dd>{dispute.resolutionNote}</dd></div>}</dl>
      </li>)}</ul>}
    </section>
  );
}

function RewardCard({ locale, record, onDispute }: { locale: Locale; record: OperatorRewardRecord; onDispute: (epoch: number) => void }) {
  const operator = useOperator();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const leafHash = record.leaf ? rewardLeafHash(record.leaf) : null;
  const claimedQuery = useReadContract({
    address: operatorProfile.contracts.rewardDistributor!,
    abi: rewardDistributorAbi,
    functionName: 'claimed',
    args: [leafHash ?? ZERO_BYTES32],
    query: { enabled: Boolean(operatorProfile.contracts.rewardDistributor && leafHash) },
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null);
  const alreadyClaimed = claimedQuery.data === true;
  const checking = Boolean(record.leaf && !claimedQuery.error && (claimedQuery.isLoading || claimedQuery.data === undefined));
  const status = !record.leaf ? 'excluded' : alreadyClaimed ? 'claimed' : checking ? 'pending' : claimedQuery.error ? 'revoked' : 'claimable';
  const statusLabel = !record.leaf ? t(locale, 'excluded')
    : alreadyClaimed ? t(locale, 'claimed')
      : checking ? (locale === 'ko' ? '온체인 청구 상태 확인 중' : 'Checking onchain claim state')
        : claimedQuery.error ? (locale === 'ko' ? '청구 상태 확인 불가' : 'Claim state unavailable')
          : t(locale, 'claimable');

  async function claim() {
    if (!record.leaf || !operator.address || !publicClient) return;
    setBusy(true);
    setError(false);
    try {
      const leaf = record.leaf;
      const { request } = await publicClient.simulateContract({
        account: operator.address,
        address: requireContract('rewardDistributor'),
        abi: rewardDistributorAbi,
        functionName: 'claim',
        args: [
          BigInt(leaf.epoch), leaf.operatorIdHash, leaf.nodeId, BigInt(leaf.score), BigInt(leaf.rewardAmount),
          leaf.receiptBatchRoot, leaf.policyVersion, leaf.claimNonce, record.proof,
        ],
      });
      const hash = await writeContractAsync(request);
      assertSuccessfulReceipt(await publicClient.waitForTransactionReceipt({ hash }));
      setTransactionHash(hash);
      await claimedQuery.refetch();
    } catch { setError(true); } finally { setBusy(false); }
  }

  return (
    <article className="data-card reward-card">
      <div className="data-card__heading"><span className={`status-chip status-${status}`}><Icon name={status === 'claimable' ? 'reward' : status === 'claimed' ? 'check' : status === 'pending' ? 'warning' : 'x'} />{statusLabel}</span><span>{record.recordId.slice(0, 10)}…{record.recordId.slice(-6)}</span></div>
      {record.leaf && <div className="reward-amount"><span>{t(locale, 'amount')}</span><strong>{formatIroa(record.leaf.rewardAmount)} IROA</strong></div>}
      <dl className="metric-grid"><div><dt>{t(locale, 'validatedTasks')}</dt><dd>{record.scoreBreakdown.validatedTasks.toLocaleString()}</dd></div><div><dt>{t(locale, 'resultQuality')}</dt><dd>{quality(record.scoreBreakdown.resultQualityBps)}</dd></div><div><dt>{t(locale, 'accessibility')}</dt><dd>{quality(record.scoreBreakdown.accessibilityQualityBps)}</dd></div><div><dt>{t(locale, 'securityGate')}</dt><dd>{record.scoreBreakdown.securityGate ? (locale === 'ko' ? '통과' : 'Passed') : (locale === 'ko' ? '미통과' : 'Not passed')}</dd></div></dl>
      {record.excludedReasons.length > 0 && <div className="reason-panel"><strong>{t(locale, 'reasons')}</strong><ul>{record.excludedReasons.map((reason) => <li key={reason}>{reason.replaceAll('_', ' ')}</li>)}</ul></div>}
      {error && <p className="form-error" role="alert">{t(locale, 'error')}</p>}
      {claimedQuery.error && <p className="form-error" role="alert">{locale === 'ko' ? '온체인 청구 상태를 확인할 수 없습니다.' : 'The onchain claim state could not be checked.'}</p>}
      <div className="button-row">
        {record.leaf && <button className="primary-button" type="button" disabled={busy || !operator.writeEnabled || alreadyClaimed || claimedQuery.isLoading || Boolean(claimedQuery.error)} onClick={() => void claim()}>{busy ? t(locale, 'claiming') : alreadyClaimed ? t(locale, 'claimed') : t(locale, 'claim')}</button>}
        {record.leaf && <button className="secondary-button" type="button" onClick={() => onDispute(record.leaf!.epoch)}>{t(locale, 'disputeSettlement')}</button>}
      </div>
      <details><summary>{t(locale, 'proofDetails')}</summary><dl className="technical-list"><div><dt>Leaf hash</dt><dd><code>{leafHash ?? '—'}</code></dd></div>{record.leaf && <><div><dt>Epoch</dt><dd>{record.leaf.epoch}</dd></div><div><dt>NODE ID</dt><dd><code>{record.leaf.nodeId}</code></dd></div><div><dt>{t(locale, 'score')}</dt><dd>{record.leaf.score}</dd></div></>}<div><dt>Merkle proof</dt><dd><code>{record.proof.length ? record.proof.join('\n') : '—'}</code></dd></div></dl></details>
      {transactionHash && <details open><summary>{t(locale, 'transaction')}</summary><code className="hash-value">{transactionHash}</code></details>}
    </article>
  );
}

export function Rewards({ locale }: { locale: Locale }) {
  const [records, setRecords] = useState<OperatorRewardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [epochHint, setEpochHint] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    setError(false);
    try { setRecords(await listRewards()); } catch { setError(true); } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  return (
    <main id="main" className="portal-main">
      <div className="page-heading"><div><p className="eyebrow">{t(locale, 'navRewards')}</p><h1 tabIndex={-1}>{t(locale, 'rewardsTitle')}</h1><p className="lead">{t(locale, 'rewardsLead')}</p></div><button className="secondary-button" type="button" disabled={loading} onClick={() => void refresh()}><Icon name="refresh" />{t(locale, 'refresh')}</button></div>
      {error && <p className="form-error" role="alert">{t(locale, 'error')}</p>}
      {loading ? <p className="loading-state" aria-live="polite">{t(locale, 'loading')}</p> : records.length === 0 ? <div className="empty-state">{t(locale, 'noRewards')}</div> : <div className="data-list">{records.map((record) => <RewardCard key={record.recordId} locale={locale} record={record} onDispute={setEpochHint} />)}</div>}
      <SettlementDisputes locale={locale} epochHint={epochHint} onEpochHintUsed={() => setEpochHint(null)} />
    </main>
  );
}
