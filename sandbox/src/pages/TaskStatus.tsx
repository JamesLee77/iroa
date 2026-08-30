import { useCallback, useEffect, useState } from 'react';
import type { Hex32 } from '@iroa/protocol';
import { cancelTask, getTask, isTerminalState, SandboxApiError, type TaskSnapshot } from '../lib/api';
import { findFixtureByCapability, taskFixtures } from '../lib/fixtures';
import { translate, type Locale } from '../lib/i18n';
import { Icon } from '../components/Icon';
import { StateBadge } from '../components/StateBadge';

function messageForError(locale: Locale, error: unknown): string {
  if (error instanceof SandboxApiError && error.code === 'SESSION_EXPIRED') return translate(locale, 'sessionExpired');
  if (error instanceof SandboxApiError && error.code === 'TASK_NOT_FOUND') return translate(locale, 'notFound');
  return translate(locale, 'genericError');
}

export function TaskStatus({ taskId, locale }: { taskId: string; locale: Locale }) {
  const typedTaskId = taskId as Hex32;
  const [snapshot, setSnapshot] = useState<TaskSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getTask(typedTaskId);
      setSnapshot(next);
      setLastUpdated(new Date());
    } catch (cause) {
      setError(messageForError(locale, cause));
    } finally {
      setLoading(false);
    }
  }, [locale, typedTaskId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!snapshot || isTerminalState(snapshot.task.state) || snapshot.task.state === 'awaiting_confirmation') return;
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => window.clearInterval(timer);
  }, [refresh, snapshot]);

  async function cancel(): Promise<void> {
    setCancelling(true);
    setError(null);
    try {
      await cancelTask(typedTaskId);
      await refresh();
    } catch (cause) {
      setError(messageForError(locale, cause));
    } finally {
      setCancelling(false);
    }
  }

  const fixture = snapshot ? findFixtureByCapability(snapshot.task.capsule.capabilityScope) : undefined;
  const storedFixture = window.sessionStorage.getItem(`iroa-sandbox-task:${taskId}`);
  const fallbackFixture = taskFixtures.find((item) => item.id === storedFixture);
  const taskFixture = fixture ?? fallbackFixture;
  const cancelable = snapshot && ['awaiting_approval', 'queued', 'assigned', 'running', 'awaiting_confirmation', 'failed'].includes(snapshot.task.state);

  return (
    <main id="main" className="page-shell">
      <div className="container narrow-page">
        <p className="eyebrow">{translate(locale, 'statusEyebrow')}</p>
        <h1 tabIndex={-1}>{translate(locale, 'statusTitle')}</h1>
        <p className="lead">{translate(locale, 'statusDescription')}</p>

        {error && <p className="form-error" role="alert">{error}</p>}
        {snapshot && (
          <section className="status-panel" aria-live="polite">
            <StateBadge state={snapshot.task.state} locale={locale} />
            <dl className="status-summary">
              <div><dt>{translate(locale, 'taskType')}</dt><dd>{taskFixture ? translate(locale, taskFixture.titleKey) : 'IROA Task'}</dd></div>
              <div><dt>{translate(locale, 'lastUpdated')}</dt><dd>{lastUpdated?.toLocaleTimeString(locale) ?? '—'}</dd></div>
            </dl>
            {snapshot.task.state === 'cancelled' && <p className="info-callout"><Icon name="x" />{translate(locale, 'cancelledMessage')}</p>}
            <details>
              <summary>{translate(locale, 'details')}</summary>
              <dl className="technical-list">
                <div><dt>{translate(locale, 'requestId')}</dt><dd><code>{snapshot.task.taskId}</code></dd></div>
                <div><dt>Policy</dt><dd><code>{snapshot.task.policyVersion}</code></dd></div>
              </dl>
            </details>
            <div className="button-row">
              <button className="secondary-button" type="button" disabled={loading} onClick={() => void refresh()}>
                <Icon name="refresh" />{loading ? translate(locale, 'refreshing') : translate(locale, 'refresh')}
              </button>
              {snapshot.task.state === 'awaiting_confirmation' && (
                <a className="primary-button" href={`/tasks/${taskId}/result`}>{translate(locale, 'goResult')}</a>
              )}
              {cancelable && (
                <button className="danger-button" type="button" disabled={cancelling} onClick={() => void cancel()}>
                  {cancelling ? translate(locale, 'cancelling') : translate(locale, 'cancel')}
                </button>
              )}
            </div>
          </section>
        )}
        {!snapshot && !error && <div className="loading-card" role="status">{translate(locale, 'refreshing')}</div>}
        {snapshot && isTerminalState(snapshot.task.state) && (
          <a className="text-link" href="/">{translate(locale, 'newRequestLink')}</a>
        )}
      </div>
    </main>
  );
}
