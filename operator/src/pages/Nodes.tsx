import { useEffect, useState } from 'react';
import type { Hex } from 'viem';
import { usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { Icon } from '../components/Icon';
import { useOperator } from '../context/OperatorContext';
import { listNodes, updateNodeStatus, type OperatorNode } from '../lib/api';
import { assertSuccessfulReceipt, nodeRegistryAbi, requireContract } from '../lib/contracts';
import { t, type Locale } from '../lib/i18n';
import { operatorProfile } from '../lib/wagmi';

type NodeAction = 'suspended' | 'revoked';

const statusCopy: Record<OperatorNode['status'], { ko: string; en: string }> = {
  pending: { ko: '승인 대기', en: 'Pending approval' },
  active: { ko: '운영 중', en: 'Active' },
  suspended: { ko: '일시 중지', en: 'Suspended' },
  revoked: { ko: '키 폐기', en: 'Key revoked' },
};

const chainStatusCopy = [statusCopy.pending, statusCopy.active, statusCopy.suspended, statusCopy.revoked] as const;

function NodeCard({ locale, node, openAction }: { locale: Locale; node: OperatorNode; openAction(node: OperatorNode, action: NodeAction): void }) {
  const chainStatusQuery = useReadContract({
    address: operatorProfile.contracts.nodeRegistry!,
    abi: nodeRegistryAbi,
    functionName: 'nodeStatus',
    args: [node.nodeId],
    query: { enabled: Boolean(operatorProfile.contracts.nodeRegistry) },
  });
  const chainStatus = chainStatusQuery.data === undefined ? null : Number(chainStatusQuery.data);
  const chainStatusLabel = chainStatus === null
    ? (locale === 'ko' ? '확인 중' : 'Checking')
    : (chainStatusCopy[chainStatus]?.[locale] ?? (locale === 'ko' ? '알 수 없음' : 'Unknown'));
  const chainActive = chainStatus === 1;
  const chainRevoked = chainStatus === 3;

  return (
    <article className="data-card">
      <div className="data-card__heading"><span className={`status-chip status-${node.status}`}><Icon name={node.status === 'active' ? 'check' : node.status === 'revoked' ? 'x' : 'warning'} />{locale === 'ko' ? '포털 상태' : 'Portal state'} · {statusCopy[node.status][locale]}</span><span>NODE {node.nodeId.slice(2, 10)}</span></div>
      <p className={`chain-state status-${chainStatus === 1 ? 'active' : chainStatus === 2 ? 'suspended' : chainStatus === 3 ? 'revoked' : 'pending'}`}><Icon name={chainActive ? 'check' : chainRevoked ? 'x' : 'warning'} />{locale === 'ko' ? '온체인 상태' : 'Onchain state'} · {chainStatusLabel}</p>
      {chainStatusQuery.error && <p className="form-error" role="alert">{locale === 'ko' ? '온체인 NODE 상태를 확인할 수 없습니다.' : 'The onchain NODE state could not be checked.'}</p>}
      <dl className="metric-grid"><div><dt>{t(locale, 'lastSeen')}</dt><dd>{node.lastSeenAt ? new Date(node.lastSeenAt * 1_000).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US') : '—'}</dd></div><div><dt>{t(locale, 'agentVersion')}</dt><dd>{node.agentVersion ?? '—'}</dd></div><div><dt>{t(locale, 'capacity')}</dt><dd>{node.capacityBucket ?? '—'}</dd></div><div><dt>{t(locale, 'trustLevel')}</dt><dd>{node.trustLevel}</dd></div></dl>
      {node.status !== 'revoked' && !chainRevoked && <div className="button-row"><button className="secondary-button" type="button" disabled={!chainActive} onClick={() => openAction(node, 'suspended')}>{t(locale, 'suspend')}</button><button className="danger-button" type="button" disabled={chainStatus === null || Boolean(chainStatusQuery.error)} onClick={() => openAction(node, 'revoked')}>{t(locale, 'revoke')}</button></div>}
      <details><summary>{t(locale, 'details')}</summary><dl className="technical-list"><div><dt>NODE ID</dt><dd><code>{node.nodeId}</code></dd></div><div><dt>{t(locale, 'deviceKeyHash')}</dt><dd><code>{node.deviceKeyHash}</code></dd></div><div><dt>{t(locale, 'policyVersion')}</dt><dd>{node.policyVersion}</dd></div></dl></details>
    </article>
  );
}

export function Nodes({ locale }: { locale: Locale }) {
  const operator = useOperator();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [nodes, setNodes] = useState<OperatorNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ node: OperatorNode; action: NodeAction } | null>(null);
  const [confirmImpact, setConfirmImpact] = useState(false);
  const [confirmAgain, setConfirmAgain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [pendingChain, setPendingChain] = useState<{ nodeId: OperatorNode['nodeId']; action: NodeAction } | null>(null);
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try { setNodes(await listNodes()); } catch { setError(t(locale, 'error')); } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  function openAction(node: OperatorNode, action: NodeAction) {
    setSelected({ node, action });
    setConfirmImpact(false);
    setConfirmAgain(false);
    setError(null);
    setDone(null);
    setTransactionHash(null);
  }

  async function applyAction() {
    if (!selected || !publicClient) return;
    const isChainRetry = pendingChain?.nodeId === selected.node.nodeId && pendingChain.action === selected.action;
    let portalApplied = isChainRetry;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      if (!isChainRetry) {
        await updateNodeStatus(selected.node.nodeId, selected.action);
        portalApplied = true;
        setPendingChain({ nodeId: selected.node.nodeId, action: selected.action });
      }
      const hash = await writeContractAsync({
        address: requireContract('nodeRegistry'),
        abi: nodeRegistryAbi,
        functionName: selected.action === 'suspended' ? 'suspendNode' : 'revokeDeviceKey',
        args: [selected.node.nodeId],
      });
      assertSuccessfulReceipt(await publicClient.waitForTransactionReceipt({ hash }));
      setTransactionHash(hash);
      setPendingChain(null);
      setDone(t(locale, 'actionDone'));
      await refresh();
    } catch {
      setError(portalApplied
        ? (locale === 'ko' ? '포털 중지는 반영됐지만 온체인 동기화가 필요할 수 있습니다. 같은 작업을 다시 시도해 주세요.' : 'The portal stop was applied, but onchain synchronization may still be required. Retry the same action.')
        : t(locale, 'error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="portal-main">
      <div className="page-heading">
        <div><p className="eyebrow">{t(locale, 'navNodes')}</p><h1 tabIndex={-1}>{t(locale, 'nodesTitle')}</h1><p className="lead">{t(locale, 'nodesLead')}</p></div>
        <button className="secondary-button" type="button" disabled={loading} onClick={() => void refresh()}><Icon name="refresh" />{t(locale, 'refresh')}</button>
      </div>
      {error && !selected && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p className="loading-state" aria-live="polite">{t(locale, 'loading')}</p> : nodes.length === 0 ? <div className="empty-state">{t(locale, 'noNodes')}</div> : (
        <div className="data-list">
          {nodes.map((node) => <NodeCard key={node.nodeId} locale={locale} node={node} openAction={openAction} />)}
        </div>
      )}

      {selected && (
        <section className="confirmation-panel" aria-labelledby="confirmation-title">
          <div className="confirmation-panel__heading"><div><p className="eyebrow">NODE {selected.node.nodeId.slice(2, 10)}</p><h2 id="confirmation-title">{selected.action === 'suspended' ? t(locale, 'suspend') : t(locale, 'revoke')}</h2></div><button className="icon-button" type="button" aria-label={t(locale, 'cancel')} onClick={() => setSelected(null)}><Icon name="x" /></button></div>
          <p className={selected.action === 'revoked' ? 'danger-copy' : ''}>{selected.action === 'suspended' ? t(locale, 'suspendImpact') : t(locale, 'revokeImpact')}</p>
          <fieldset><legend>{locale === 'ko' ? '두 항목을 모두 확인해야 합니다.' : 'Confirm both items to continue.'}</legend><label className="check-row"><input type="checkbox" checked={confirmImpact} onChange={(event) => setConfirmImpact(event.target.checked)} />{t(locale, 'confirmImpact')}</label><label className="check-row"><input type="checkbox" checked={confirmAgain} onChange={(event) => setConfirmAgain(event.target.checked)} />{t(locale, 'confirmAgain')}</label></fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          {done && <p className="inline-success" role="status"><Icon name="check" />{done}</p>}
          <div className="button-row"><button className="secondary-button" type="button" disabled={busy} onClick={() => setSelected(null)}>{t(locale, 'cancel')}</button><button className={selected.action === 'revoked' ? 'danger-button' : 'primary-button'} type="button" disabled={busy || !operator.writeEnabled || !confirmImpact || !confirmAgain} onClick={() => void applyAction()}>{busy ? t(locale, 'loading') : t(locale, 'apply')}</button></div>
          {transactionHash && <details><summary>{t(locale, 'transaction')}</summary><code className="hash-value">{transactionHash}</code></details>}
        </section>
      )}
    </main>
  );
}
