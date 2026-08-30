import { useEffect, useState } from 'react';
import { useSignMessage } from 'wagmi';
import { ErrorState, LoadingState, PageHeading, ShortHash, WriteLock } from '../components/Page';
import { useAdmin } from '../context/AdminContext';
import { loadSettlement, prepareSettlementProposal, type AdminSettlement } from '../lib/api';
import { buildRootSafeProposal, downloadJson, requireContract, rootApprovalMessage, verifySettlementArtifact, type SafeProposalArtifact } from '../lib/contracts';
import { adminProfile } from '../lib/wagmi';

export function Settlement() {
  const admin = useAdmin();
  const { signMessageAsync } = useSignMessage();
  const [settlement, setSettlement] = useState<AdminSettlement | null>(null);
  const [proposal, setProposal] = useState<SafeProposalArtifact | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (!admin.session) { setLoading(false); return; }
    setLoading(true); setError(null);
    loadSettlement().then(setSettlement).catch(setError).finally(() => setLoading(false));
  }, [admin.session]);
  async function prepare() {
    if (!settlement || !admin.address || !admin.canWrite('settlement:propose', 'rootProposer') || !confirmed) return;
    setBusy(true); setError(null); setProposal(null);
    try {
      await verifySettlementArtifact(settlement);
      const approvedAt = Math.floor(Date.now() / 1_000);
      const signature = await signMessageAsync({ message: rootApprovalMessage({
        chainId: adminProfile.chainId,
        registry: requireContract('rootRegistry'),
        epoch: settlement.epoch,
        artifactSha256: settlement.artifactSha256,
        approvedAt,
      }) });
      const transaction = await prepareSettlementProposal({ approvedBy: admin.address, approvedAt, artifactSha256: settlement.artifactSha256, signature });
      setProposal(buildRootSafeProposal(settlement, transaction));
    }
    catch (cause) { setError(cause); } finally { setBusy(false); }
  }
  return <main id="main" className="portal-main">
    <PageHeading eyebrow="REWARD SETTLEMENT" title="보상 정산 검증" description="포함·제외 결과와 원본 정산 파일의 해시를 대조합니다. 이 화면은 트랜잭션을 전송하지 않고 Safe 검토용 제안 파일만 만듭니다." />
    {!admin.session ? <WriteLock allowed={false} roleLabel="ROOT_PROPOSER_ROLE" />
      : loading ? <LoadingState /> : error && !settlement ? <ErrorState error={error} />
        : settlement ? <>
          <section className="summary-grid" aria-label="정산 요약">
            <article><span>Epoch</span><strong>{settlement.epoch}</strong></article>
            <article><span>포함 작업</span><strong>{settlement.includedTaskCount}</strong></article>
            <article><span>제외 작업</span><strong>{settlement.excludedTasks.length}</strong></article>
            <article><span>보상 청구 항목</span><strong>{settlement.claims.length}</strong></article>
          </section>
          <section className="data-card">
            <h2>정산 무결성</h2>
            <dl className="technical-list"><div><dt>정책 버전</dt><dd>{settlement.policyVersion}</dd></div><div><dt>보상 root</dt><dd>{settlement.rewardRoot ? <ShortHash value={settlement.rewardRoot} /> : '없음'}</dd></div><div><dt>Receipt 묶음 root</dt><dd>{settlement.receiptBatchRoot ? <ShortHash value={settlement.receiptBatchRoot} /> : '없음'}</dd></div><div><dt>정산 파일 SHA-256</dt><dd><ShortHash value={settlement.artifactSha256} /></dd></div></dl>
          </section>
          <section className="data-card">
            <h2>제외 항목</h2>
            {settlement.excludedTasks.length === 0 ? <p>제외된 작업이 없습니다.</p> : <div className="compact-list">{settlement.excludedTasks.map((item) => <div key={item.taskId}><ShortHash value={item.taskId} /><span>{item.reasons.join(', ')}</span></div>)}</div>}
          </section>
          <section className="confirmation-panel" aria-labelledby="proposal-title">
            <h2 id="proposal-title">Safe 제안 파일 만들기</h2>
            <WriteLock allowed={admin.canWrite('settlement:propose', 'rootProposer')} roleLabel="ROOT_PROPOSER_ROLE" />
            <label className="check-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />표시된 epoch, 정책 버전, 두 root와 정산 파일 해시를 검토했습니다.</label>
            <button className="primary-button" type="button" disabled={!confirmed || busy || !admin.canWrite('settlement:propose', 'rootProposer')} onClick={() => void prepare()}>{busy ? '무결성 확인 중…' : '검증 후 Safe 제안 생성'}</button>
            {error && <ErrorState error={error} />}
            {proposal && <div className="proposal-preview" role="status"><p className="inline-success">검증 완료. 아직 어떤 트랜잭션도 전송되지 않았습니다.</p><dl className="technical-list"><div><dt>Safe</dt><dd><ShortHash value={proposal.safe} /></dd></div><div><dt>대상 계약</dt><dd><ShortHash value={proposal.transactions[0].to} /></dd></div><div><dt>값</dt><dd>0</dd></div><div><dt>제안 해시</dt><dd><ShortHash value={proposal.payloadHash} /></dd></div><div><dt>calldata</dt><dd><ShortHash value={proposal.transactions[0].data} /></dd></div></dl><button className="secondary-button" type="button" onClick={() => downloadJson(`iroa-root-proposal-epoch-${proposal.epoch}.json`, proposal)}>Safe 제안 파일 내려받기</button></div>}
          </section>
        </> : <div className="empty-state">정산 파일이 없습니다.</div>}
  </main>;
}
