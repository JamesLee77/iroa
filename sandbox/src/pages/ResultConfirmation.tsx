import { useCallback, useEffect, useState } from 'react';
import type { Hex32 } from '@iroa/protocol';
import { confirmTask, getTask, SandboxApiError, type TaskSnapshot } from '../lib/api';
import { translate, type Locale } from '../lib/i18n';
import { ReceiptStatus } from '../components/ReceiptStatus';
import { StateBadge } from '../components/StateBadge';

function errorMessage(locale: Locale, cause: unknown): string {
  if (cause instanceof SandboxApiError && cause.code === 'SESSION_EXPIRED') return translate(locale, 'sessionExpired');
  return translate(locale, 'genericError');
}

export function ResultConfirmation({ taskId, locale }: { taskId: string; locale: Locale }) {
  const typedTaskId = taskId as Hex32;
  const [snapshot, setSnapshot] = useState<TaskSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setSnapshot(await getTask(typedTaskId));
      setError(null);
    } catch (cause) {
      setError(errorMessage(locale, cause));
    } finally {
      setRefreshing(false);
    }
  }, [locale, typedTaskId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!snapshot || snapshot.task.state !== 'awaiting_confirmation') return;
    if (snapshot.receipts.result.status === 'verified' && snapshot.receipts.deletion.status === 'verified') return;
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => window.clearInterval(timer);
  }, [refresh, snapshot]);

  async function confirm(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const task = await confirmTask(typedTaskId);
      setSnapshot((current) => current ? { ...current, task } : current);
    } catch (cause) {
      setError(errorMessage(locale, cause));
    } finally {
      setBusy(false);
    }
  }

  const ready = snapshot?.task.state === 'awaiting_confirmation'
    && snapshot.receipts.result.status === 'verified'
    && snapshot.receipts.deletion.status === 'verified';

  return (
    <main id="main" className="page-shell">
      <div className="container narrow-page">
        <p className="eyebrow">{translate(locale, 'resultEyebrow')}</p>
        <h1 tabIndex={-1}>{translate(locale, 'resultTitle')}</h1>
        <p className="lead">{translate(locale, 'resultDescription')}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {snapshot && (
          <>
            <StateBadge state={snapshot.task.state} locale={locale} />
            <div className="receipt-grid">
              <ReceiptStatus label={translate(locale, 'resultReceipt')} receipt={snapshot.receipts.result} locale={locale} reviewing={snapshot.task.state === 'disputed'} />
              <ReceiptStatus label={translate(locale, 'deletionReceipt')} receipt={snapshot.receipts.deletion} locale={locale} reviewing={snapshot.task.state === 'disputed'} />
            </div>
            <p className="form-help">{translate(locale, 'confirmHelp')}</p>
            <div className="button-row">
              <button className="secondary-button" type="button" disabled={refreshing} onClick={() => void refresh()}>
                {refreshing ? translate(locale, 'refreshing') : translate(locale, 'refresh')}
              </button>
              <button className="primary-button" type="button" disabled={!ready || busy} onClick={() => void confirm()}>
                {busy ? translate(locale, 'confirming') : translate(locale, 'confirm')}
              </button>
              {snapshot.task.state === 'awaiting_confirmation' && (
                <a className="secondary-button" href={`/tasks/${taskId}/dispute`}>{translate(locale, 'disputeLink')}</a>
              )}
              <a className="text-link" href={`/tasks/${taskId}`}>{translate(locale, 'backToStatus')}</a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
