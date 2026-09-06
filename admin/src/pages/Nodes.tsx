import { useEffect, useState } from 'react';
import { usePublicClient, useWriteContract } from 'wagmi';
import { ErrorState, LoadingState, PageHeading, ShortHash, StatusChip, WriteLock } from '../components/Page';
import { appendTransactionAudit, listAdminNodes, type AdminNode } from '../lib/api';
import { nodeRegistryAbi, requireContract } from '../lib/contracts';
import { executeNodeTransaction } from '../lib/node-transaction';
import { useAdmin } from '../context/AdminContext';

type NodeAction = 'approve' | 'suspend' | 'reject' | 'trust-level';
type PendingAction = { node: AdminNode; action: NodeAction; level?: 0 | 1 | 2 | 3 };

/* Everything that differs per action lives here so the execute path and the
   confirmation panel never disagree about role, audit label, or copy. */
const ACTIONS: Record<NodeAction, {
  role: 'compliance' | 'suspender';
  adminAction: 'node:approve' | 'node:suspend' | 'node:reject' | 'node:trust-level';
  audit: 'NODE_APPROVED' | 'NODE_SUSPENDED' | 'NODE_REJECTED' | 'NODE_TRUST_LEVEL_CHANGED';
  roleLabel: string;
  title: string;
  description: string;
  danger: boolean;
}> = {
  approve: { role: 'compliance', adminAction: 'node:approve', audit: 'NODE_APPROVED', roleLabel: 'COMPLIANCE_ROLE', title: 'NODE 승인을 확인하세요', description: '이 NODE가 보상 검증 흐름에 참여할 수 있습니다.', danger: false },
  suspend: { role: 'suspender', adminAction: 'node:suspend', audit: 'NODE_SUSPENDED', roleLabel: 'SUSPENDER_ROLE', title: 'NODE 일시 중지를 확인하세요', description: '진행 중 작업과 이후 보상 검증에서 이 NODE가 제외될 수 있습니다.', danger: true },
  reject: { role: 'compliance', adminAction: 'node:reject', audit: 'NODE_REJECTED', roleLabel: 'COMPLIANCE_ROLE', title: '등록 거부를 확인하세요', description: '승인된 적 없는 등록을 닫고 기기 키 해시를 해제합니다. 같은 기기 키로 다시 등록할 수 있습니다.', danger: true },
  'trust-level': { role: 'compliance', adminAction: 'node:trust-level', audit: 'NODE_TRUST_LEVEL_CHANGED', roleLabel: 'COMPLIANCE_ROLE', title: '신뢰 수준 변경을 확인하세요', description: '이 NODE가 맡을 수 있는 요청의 상한이 바뀝니다. 더 많은 개인정보를 볼 수 있게 되는 것은 아닙니다.', danger: false },
};

const TRUST_LEVELS = [0, 1, 2, 3] as const;
const trustLevelCode = (level: string): 0 | 1 | 2 | 3 => Number(level.replace(/^N/, '')) as 0 | 1 | 2 | 3;

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
  const [levelChoice, setLevelChoice] = useState<Record<string, 0 | 1 | 2 | 3>>({});

  async function reload() {
    setLoading(true); setError(null);
    try { setNodes(await listAdminNodes()); } catch (cause) { setError(cause); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (admin.session) void reload(); else setLoading(false); }, [admin.session]);

  async function execute() {
    if (!pending || !client) return;
    const spec = ACTIONS[pending.action];
    if (!admin.canWrite(spec.adminAction, spec.role)) return;
    const nodeId = pending.node.nodeId as `0x${string}`;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await executeNodeTransaction({
        submit: () => {
          if (pending.action === 'trust-level') {
            return writeContractAsync({ address: requireContract('nodeRegistry'), abi: nodeRegistryAbi, functionName: 'changeTrustLevel', args: [nodeId, pending.level ?? 0] });
          }
          const functionName = pending.action === 'approve' ? 'approveNode' : pending.action === 'suspend' ? 'suspendNode' : 'rejectNode';
          return writeContractAsync({ address: requireContract('nodeRegistry'), abi: nodeRegistryAbi, functionName, args: [nodeId] });
        },
        async wait(hash) { return (await client.waitForTransactionReceipt({ hash })).status; },
        record: (result, transactionHash) => appendTransactionAudit({
          action: spec.audit,
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
              {node.status === 'pending' && <button className="danger-button" type="button" disabled={!admin.canWrite('node:reject', 'compliance')} onClick={() => setPending({ node, action: 'reject' })}>등록 거부</button>}
              {node.status !== 'revoked' && <label className="inline-field">신뢰 수준
                <select value={levelChoice[node.nodeId] ?? trustLevelCode(node.trustLevel)} onChange={(event) => setLevelChoice({ ...levelChoice, [node.nodeId]: Number(event.target.value) as 0 | 1 | 2 | 3 })}>
                  {TRUST_LEVELS.map((level) => <option key={level} value={level}>N{level}</option>)}
                </select>
                <button className="secondary-button" type="button" disabled={!admin.canWrite('node:trust-level', 'compliance') || (levelChoice[node.nodeId] ?? trustLevelCode(node.trustLevel)) === trustLevelCode(node.trustLevel)} onClick={() => setPending({ node, action: 'trust-level', level: levelChoice[node.nodeId] ?? trustLevelCode(node.trustLevel) })}>신뢰 수준 변경</button>
              </label>}
            </div>
          </article>)}</div>}
    {pending && <section className="confirmation-panel" aria-labelledby="node-confirm-title">
      <h2 id="node-confirm-title">{ACTIONS[pending.action].title}</h2>
      <p>{ACTIONS[pending.action].description}{pending.action === 'trust-level' && ` ${pending.node.trustLevel} → N${pending.level}`}</p>
      <WriteLock allowed={admin.canWrite(ACTIONS[pending.action].adminAction, ACTIONS[pending.action].role)} roleLabel={ACTIONS[pending.action].roleLabel} />
      <div className="button-row"><button className={ACTIONS[pending.action].danger ? 'danger-button' : 'primary-button'} type="button" disabled={busy} onClick={() => void execute()}>{busy ? '처리 중…' : '두 번째 확인 후 실행'}</button><button className="secondary-button" type="button" disabled={busy} onClick={() => setPending(null)}>취소</button></div>
    </section>}
  </main>;
}
