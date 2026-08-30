import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { ErrorState, LoadingState, PageHeading, ShortHash, StatusChip } from '../components/Page';
import { useAdmin } from '../context/AdminContext';
import { listAudit, type AuditItem } from '../lib/api';
import { canPerform } from '../lib/personas';

const CSV_COLUMNS = ['actor', 'action', 'target', 'policyVersion', 'timestamp', 'transactionHash', 'result'] as const;

function safeCsvCell(value: string): string {
  const normalized = value.replace(/[\r\n]+/g, ' ').trim();
  const protectedValue = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function auditCsv(items: readonly AuditItem[]): string {
  const rows = items.map((item) => [
    item.actor,
    item.action,
    item.target,
    item.policyVersion,
    new Date(item.timestamp * 1_000).toISOString(),
    item.transactionHash ?? '',
    item.result,
  ].map(safeCsvCell).join(','));
  return `\uFEFF${CSV_COLUMNS.join(',')}\r\n${rows.join('\r\n')}\r\n`;
}

function downloadCsv(items: readonly AuditItem[]) {
  const url = URL.createObjectURL(new Blob([auditCsv(items)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `iroa-admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function Audit() {
  const admin = useAdmin();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (!admin.session) { setLoading(false); return; }
    setLoading(true); setError(null);
    listAudit().then(setItems).catch(setError).finally(() => setLoading(false));
  }, [admin.session]);
  return <main id="main" className="portal-main">
    <PageHeading eyebrow="APPEND-ONLY LEDGER" title="관리자 감사 기록" description="행위자, 작업, 대상, 정책 버전, 시각, 트랜잭션 해시와 결과만 조회·내보냅니다. Receipt 원문과 암호화 Capsule 참조는 포함하지 않습니다." action={<button className="secondary-button" type="button" disabled={!admin.identity.accessVerified || !admin.session || !canPerform(admin.identity.persona, 'audit:export') || items.length === 0} onClick={() => downloadCsv(items)}><Icon name="download" />CSV 내려받기</button>} />
    {loading ? <LoadingState /> : error ? <ErrorState error={error} /> : items.length === 0 ? <div className="empty-state">감사 기록이 없습니다.</div> : <div className="table-wrap"><table><thead><tr><th>시각</th><th>행위자</th><th>작업</th><th>대상</th><th>정책</th><th>트랜잭션</th><th>결과</th></tr></thead><tbody>{items.map((item) => <tr key={item.auditId}><td>{new Date(item.timestamp * 1_000).toLocaleString('ko-KR')}</td><td>{item.actor}</td><td>{item.action}</td><td><ShortHash value={item.target} /></td><td>{item.policyVersion}</td><td>{item.transactionHash ? <ShortHash value={item.transactionHash} /> : '해당 없음'}</td><td><StatusChip status={item.result} /></td></tr>)}</tbody></table></div>}
  </main>;
}
