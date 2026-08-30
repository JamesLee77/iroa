import { useEffect, useState } from 'react';
import { ErrorState, LoadingState, PageHeading, ShortHash, StatusChip, WriteLock } from '../components/Page';
import { useAdmin } from '../context/AdminContext';
import { listGovernanceQueue, type GovernanceItem } from '../lib/api';
import { adminProfile } from '../lib/wagmi';

export function Governance() {
  const admin = useAdmin();
  const [items, setItems] = useState<GovernanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (!admin.session) { setLoading(false); return; }
    setLoading(true); setError(null);
    listGovernanceQueue().then(setItems).catch(setError).finally(() => setLoading(false));
  }, [admin.session]);
  return <main id="main" className="portal-main">
    <PageHeading eyebrow="SAFE + TIMELOCK" title="Governance 대기열" description="다중 서명과 48시간 Timelock 상태를 함께 확인합니다. 서명·실행은 Safe 앱과 온체인 계약에서만 수행합니다." />
    <WriteLock allowed={Boolean(admin.identity.accessVerified && admin.session && !admin.wrongChain)} roleLabel="Governance 조회" />
    <section className="data-card"><h2>운영 계약</h2><dl className="technical-list"><div><dt>Safe</dt><dd>{adminProfile.contracts.safe ? <ShortHash value={adminProfile.contracts.safe} /> : '설정 필요'}</dd></div><div><dt>Timelock</dt><dd>{adminProfile.contracts.timelock ? <ShortHash value={adminProfile.contracts.timelock} /> : '설정 필요'}</dd></div><div><dt>배포 manifest</dt><dd>{adminProfile.manifestHash ? <ShortHash value={adminProfile.manifestHash} /> : '설정 필요'}</dd></div></dl></section>
    {loading ? <LoadingState /> : error ? <ErrorState error={error} /> : items.length === 0 ? <div className="empty-state">대기 중인 제안이 없습니다.</div> : <div className="data-list">{items.map((item) => <article className="data-card" key={item.queueId}><div className="data-card__heading"><strong>{item.kind === 'safe' ? 'Safe 다중 서명' : 'Timelock 예약'}</strong><StatusChip status={item.status} /></div><dl className="technical-list"><div><dt>대상</dt><dd><ShortHash value={item.target} /></dd></div><div><dt>작업 해시</dt><dd><ShortHash value={item.operationHash} /></dd></div><div><dt>승인</dt><dd>{item.approvals} / {item.approvalsRequired}</dd></div><div><dt>실행 가능 시각</dt><dd>{item.executableAt ? new Date(item.executableAt * 1_000).toLocaleString('ko-KR') : '아직 정해지지 않음'}</dd></div></dl></article>)}</div>}
  </main>;
}
