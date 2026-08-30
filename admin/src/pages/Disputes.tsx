import { useEffect, useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import { ErrorState, LoadingState, PageHeading, ShortHash, StatusChip, WriteLock } from '../components/Page';
import { listDisputes, resolveDispute, type AdminDispute } from '../lib/api';

export function Disputes() {
  const admin = useAdmin();
  const [items, setItems] = useState<AdminDispute[]>([]);
  const [selected, setSelected] = useState<AdminDispute | null>(null);
  const [resolution, setResolution] = useState<'upheld' | 'rejected'>('upheld');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function reload() { setLoading(true); setError(null); try { setItems(await listDisputes()); } catch (cause) { setError(cause); } finally { setLoading(false); } }
  useEffect(() => { if (admin.session) void reload(); else setLoading(false); }, [admin.session]);
  async function submit() {
    if (!selected || !admin.canWrite('dispute:resolve', 'challenger') || note.trim().length < 10) return;
    setBusy(true); setError(null);
    try { await resolveDispute(selected.taskId, resolution, note.trim()); setSelected(null); setNote(''); await reload(); }
    catch (cause) { setError(cause); } finally { setBusy(false); }
  }
  return <main id="main" className="portal-main">
    <PageHeading eyebrow="HUMAN REVIEW" title="분쟁 증거 검토" description="미해결 분쟁은 정산에서 자동 보류됩니다. 증거 해시와 사유를 검토한 뒤 사람의 판단과 근거를 감사 원장에 남깁니다." />
    {!admin.session ? <WriteLock allowed={false} roleLabel="분쟁 처리" />
      : loading ? <LoadingState /> : error ? <ErrorState error={error} />
        : items.length === 0 ? <div className="empty-state">검토할 분쟁이 없습니다.</div>
          : <div className="data-list">{items.map((item) => <article className="data-card" key={item.taskId}>
            <div className="data-card__heading"><ShortHash value={item.taskId} /><StatusChip status={item.status} /></div>
            <dl className="technical-list"><div><dt>증거 해시</dt><dd><ShortHash value={item.evidenceHash} /></dd></div><div><dt>사유 코드</dt><dd>{item.reasonCode}</dd></div><div><dt>접수 시각</dt><dd>{new Date(item.openedAt * 1_000).toLocaleString('ko-KR')}</dd></div></dl>
            {item.status === 'open' && <button className="primary-button" type="button" disabled={!admin.canWrite('dispute:resolve', 'challenger')} onClick={() => setSelected(item)}>검토 결과 기록</button>}
          </article>)}</div>}
    {selected && <section className="confirmation-panel" aria-labelledby="dispute-title">
      <h2 id="dispute-title">분쟁 처리 결과</h2>
      <WriteLock allowed={admin.canWrite('dispute:resolve', 'challenger')} roleLabel="CHALLENGER_ROLE" />
      <fieldset><legend>결과를 선택하세요</legend><label className="check-row"><input type="radio" name="resolution" checked={resolution === 'upheld'} onChange={() => setResolution('upheld')} />이의 인정 — 해당 작업 보상 제외 유지</label><label className="check-row"><input type="radio" name="resolution" checked={resolution === 'rejected'} onChange={() => setResolution('rejected')} />이의 기각 — 다음 정산에 다시 포함 가능</label></fieldset>
      <label>판단 근거<textarea value={note} minLength={10} maxLength={500} rows={4} onChange={(event) => setNote(event.target.value)} placeholder="개인정보 없이 증거 해시와 정책 기준을 중심으로 기록하세요." /></label>
      <p className="field-help">최소 10자, 최대 500자. Receipt 원문이나 암호화 Capsule 참조를 입력하지 마세요.</p>
      <div className="button-row"><button className="primary-button" type="button" disabled={busy || note.trim().length < 10} onClick={() => void submit()}>{busy ? '기록 중…' : '결과 확정'}</button><button className="secondary-button" type="button" disabled={busy} onClick={() => setSelected(null)}>취소</button></div>
    </section>}
  </main>;
}
