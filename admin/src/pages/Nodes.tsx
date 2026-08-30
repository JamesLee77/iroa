import { useEffect, useState } from 'react';
import { usePublicClient, useWriteContract } from 'wagmi';
import { ErrorState, LoadingState, PageHeading, ShortHash, StatusChip, WriteLock } from '../components/Page';
import { appendTransactionAudit, listAdminNodes, type AdminNode } from '../lib/api';
import { nodeRegistryAbi, requireContract } from '../lib/contracts';
import { executeNodeTransaction } from '../lib/node-transaction';
import { useAdmin } from '../context/AdminContext';

type PendingAction = { node: AdminNode; action: 'approve' | 'suspend' };

export function Nodes() {
  const admin = useAdmin();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [nodes, setNodes] = useState<AdminNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function reload() {
    setLoading(true); setError(null);
    try { setNodes(await listAdminNodes()); } catch (cause) { setError(cause); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (admin.session) void reload(); else setLoading(false); }, [admin.session]);

  async function execute() {
    if (!pending || !client) return;
    const requiredRole = pending.action === 'approve' ? 'compliance' : 'suspender';
    const action = pending.action === 'approve' ? 'node:approve' : 'node:suspend';
    if (!admin.canWrite(action, requiredRole)) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await executeNodeTransaction({
        submit: () => writeContractAsync({
          address: requireContract('nodeRegistry'),
          abi: nodeRegistryAbi,
          functionName: pending.action === 'approve' ? 'approveNode' : 'suspendNode',
          args: [pending.node.nodeId as `0x${string}`],
        }),
        async wait(hash) { return (await client.waitForTransactionReceipt({ hash })).status; },
        record: (result, transactionHash) => appendTransactionAudit({
          action: pending.action === 'approve' ? 'NODE_APPROVED' : 'NODE_SUSPENDED',
          target: pending.node.nodeId,
          policyVersion: pending.node.policyVersion,
          transactionHash,
          result,
        }),
      });
      if (result.auditStatus === 'pending_reconciliation') setNotice(`온체인 작업은 완료되었지만 감사 결과 동기화가 필요합니다: ${result.hash}`);
      setPending(null);
      await reload();
    } catch (cause) {
      setError(cause);
    } finally { setBusy(false); }
  }

  return <main id="main" className="portal-main">
    <PageHeading eyebrow="NODE CONTROL" title="NODE 검증과 운영 상태" description="기기 키 해시와 정책 버전을 확인하고 승인 또는 일시 중지합니다. 원본 기기 정보와 비밀값은 표시하지 않습니다." />
    {notice && <p className="inline-alert" role="status">{notice}</p>}
    {!admin.session ? <WriteLock allowed={false} roleLabel="NODE 운영" />
      : loading ? <LoadingState /> : error ? <ErrorState error={error} />
        : nodes.length === 0 ? <div className="empty-state">검토할 NODE가 없습니다.</div>
          : <div className="data-list">{nodes.map((node) => <article className="data-card" key={node.nodeId}>
            <div className="data-card__heading"><ShortHash value={node.nodeId} /><StatusChip status={node.status} /></div>
            <dl className="metric-grid">
              <div><dt>신뢰 수준</dt><dd>{node.trustLevel}</dd></div>
              <div><dt>정책 버전</dt><dd>{node.policyVersion}</dd></div>
              <div><dt>처리 여유</dt><dd>{node.capacityBucket ?? '미확인'}</dd></div>
              <div><dt>최근 확인</dt><dd>{node.lastSeenAt ? new Date(node.lastSeenAt * 1_000).toLocaleString('ko-KR') : '기록 없음'}</dd></div>
            </dl>
            <p className="hash-line"><span>기기 키 해시</span><ShortHash value={node.deviceKeyHash} /></p>
            <div className="button-row">
              {(node.status === 'pending' || node.status === 'suspended') && <button className="primary-button" type="button" disabled={!admin.canWrite('node:approve', 'compliance')} onClick={() => setPending({ node, action: 'approve' })}>NODE 승인</button>}
              {node.status === 'active' && <button className="danger-button" type="button" disabled={!admin.canWrite('node:suspend', 'suspender')} onClick={() => setPending({ node, action: 'suspend' })}>NODE 일시 중지</button>}
            </div>
          </article>)}</div>}
    {pending && <section className="confirmation-panel" aria-labelledby="node-confirm-title">
      <h2 id="node-confirm-title">{pending.action === 'approve' ? 'NODE 승인을 확인하세요' : 'NODE 일시 중지를 확인하세요'}</h2>
      <p>{pending.action === 'approve' ? '이 NODE가 보상 검증 흐름에 참여할 수 있습니다.' : '진행 중 작업과 이후 보상 검증에서 이 NODE가 제외될 수 있습니다.'}</p>
      <WriteLock allowed={admin.canWrite(pending.action === 'approve' ? 'node:approve' : 'node:suspend', pending.action === 'approve' ? 'compliance' : 'suspender')} roleLabel={pending.action === 'approve' ? 'COMPLIANCE_ROLE' : 'SUSPENDER_ROLE'} />
      <div className="button-row"><button className={pending.action === 'approve' ? 'primary-button' : 'danger-button'} type="button" disabled={busy} onClick={() => void execute()}>{busy ? '처리 중…' : '두 번째 확인 후 실행'}</button><button className="secondary-button" type="button" disabled={busy} onClick={() => setPending(null)}>취소</button></div>
    </section>}
  </main>;
}
