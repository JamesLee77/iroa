import { useEffect, useState } from 'react';
import type { Hex } from 'viem';
import { usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { Icon } from '../components/Icon';
import { useOperator } from '../context/OperatorContext';
import { listRewards, type OperatorRewardRecord } from '../lib/api';
import { assertSuccessfulReceipt, formatIroa, requireContract, rewardDistributorAbi, rewardLeafHash } from '../lib/contracts';
import { t, type Locale } from '../lib/i18n';
import { operatorProfile } from '../lib/wagmi';

const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex;

function quality(value: number): string {
  return `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}%`;
}

function RewardCard({ locale, record }: { locale: Locale; record: OperatorRewardRecord }) {
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
      {record.leaf && <button className="primary-button" type="button" disabled={busy || !operator.writeEnabled || alreadyClaimed || claimedQuery.isLoading || Boolean(claimedQuery.error)} onClick={() => void claim()}>{busy ? t(locale, 'claiming') : alreadyClaimed ? t(locale, 'claimed') : t(locale, 'claim')}</button>}
      <details><summary>{t(locale, 'proofDetails')}</summary><dl className="technical-list"><div><dt>Leaf hash</dt><dd><code>{leafHash ?? '—'}</code></dd></div>{record.leaf && <><div><dt>Epoch</dt><dd>{record.leaf.epoch}</dd></div><div><dt>NODE ID</dt><dd><code>{record.leaf.nodeId}</code></dd></div><div><dt>{t(locale, 'score')}</dt><dd>{record.leaf.score}</dd></div></>}<div><dt>Merkle proof</dt><dd><code>{record.proof.length ? record.proof.join('\n') : '—'}</code></dd></div></dl></details>
      {transactionHash && <details open><summary>{t(locale, 'transaction')}</summary><code className="hash-value">{transactionHash}</code></details>}
    </article>
  );
}

export function Rewards({ locale }: { locale: Locale }) {
  const [records, setRecords] = useState<OperatorRewardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
      {loading ? <p className="loading-state" aria-live="polite">{t(locale, 'loading')}</p> : records.length === 0 ? <div className="empty-state">{t(locale, 'noRewards')}</div> : <div className="data-list">{records.map((record) => <RewardCard key={record.recordId} locale={locale} record={record} />)}</div>}
    </main>
  );
}
