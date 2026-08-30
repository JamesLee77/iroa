import { useEffect, useState } from 'react';
import { listTasks, type OperatorTask } from '../lib/api';
import { t, type Locale } from '../lib/i18n';
import { Icon } from '../components/Icon';

const stateCopy: Record<OperatorTask['state'], { ko: string; en: string }> = {
  draft: { ko: '초안', en: 'Draft' },
  awaiting_approval: { ko: '승인 대기', en: 'Awaiting approval' },
  queued: { ko: '배정 대기', en: 'Queued' },
  assigned: { ko: '배정됨', en: 'Assigned' },
  running: { ko: '처리 중', en: 'Running' },
  awaiting_confirmation: { ko: '결과 확인 대기', en: 'Awaiting confirmation' },
  verified: { ko: '검증 완료', en: 'Verified' },
  disputed: { ko: '이의 검토', en: 'Disputed' },
  failed: { ko: '처리 실패', en: 'Failed' },
  cancelled: { ko: '취소됨', en: 'Cancelled' },
  reward_pending: { ko: '보상 정산 중', en: 'Reward pending' },
  rewarded: { ko: '보상 완료', en: 'Rewarded' },
};

export function taskStateLabel(state: OperatorTask['state'], locale: Locale): string {
  return stateCopy[state][locale];
}

export function Tasks({ locale }: { locale: Locale }) {
  const [tasks, setTasks] = useState<OperatorTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(false);
    try { setTasks(await listTasks()); } catch { setError(true); } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  return (
    <main id="main" className="portal-main">
      <div className="page-heading">
        <div><p className="eyebrow">{t(locale, 'navTasks')}</p><h1 tabIndex={-1}>{t(locale, 'tasksTitle')}</h1><p className="lead">{t(locale, 'tasksLead')}</p></div>
        <button className="secondary-button" type="button" disabled={loading} onClick={() => void refresh()}><Icon name="refresh" />{t(locale, 'refresh')}</button>
      </div>
      {error && <p className="form-error" role="alert">{t(locale, 'error')}</p>}
      {loading ? <p className="loading-state" aria-live="polite">{t(locale, 'loading')}</p> : tasks.length === 0 ? <div className="empty-state">{t(locale, 'noTasks')}</div> : (
        <div className="data-list">
          {tasks.map((task) => (
            <article className="data-card" key={task.taskId}>
              <div className="data-card__heading"><span className={`status-chip status-${task.state}`}><Icon name={task.state === 'verified' || task.state === 'rewarded' ? 'check' : task.state === 'disputed' || task.state === 'failed' || task.state === 'cancelled' ? 'warning' : 'task'} />{taskStateLabel(task.state, locale)}</span><time dateTime={new Date(task.updatedAt * 1_000).toISOString()}>{new Date(task.updatedAt * 1_000).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}</time></div>
              <dl className="metric-grid"><div><dt>{t(locale, 'taskId')}</dt><dd>{task.taskId.slice(0, 10)}…{task.taskId.slice(-6)}</dd></div><div><dt>{t(locale, 'status')}</dt><dd>{taskStateLabel(task.state, locale)}</dd></div><div><dt>{t(locale, 'policyVersion')}</dt><dd>{task.policyVersion}</dd></div></dl>
              <details><summary>{t(locale, 'details')}</summary><dl className="technical-list"><div><dt>{t(locale, 'taskId')}</dt><dd><code>{task.taskId}</code></dd></div><div><dt>NODE ID</dt><dd><code>{task.assignedNodeId ?? '—'}</code></dd></div></dl></details>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
