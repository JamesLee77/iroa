import { useState } from 'react';
import type { Hex32 } from '@iroa/protocol';
import { disputeTask, SandboxApiError, type DisputeReason } from '../lib/api';
import { sha256Hex } from '../lib/crypto';
import { translate, type Locale, type TranslationKey } from '../lib/i18n';

const reasons: readonly { code: DisputeReason; label: TranslationKey }[] = [
  { code: 'RESULT_INCORRECT', label: 'reasonIncorrect' },
  { code: 'RESULT_INCOMPLETE', label: 'reasonIncomplete' },
  { code: 'ACCESSIBILITY_ISSUE', label: 'reasonAccessibility' },
  { code: 'OTHER', label: 'reasonOther' },
];

export function Dispute({ taskId, locale }: { taskId: string; locale: Locale }) {
  const [reason, setReason] = useState<DisputeReason>('RESULT_INCORRECT');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const evidenceHash = note.trim() ? await sha256Hex(note.trim()) : undefined;
      await disputeTask(taskId as Hex32, reason, evidenceHash);
      setNote('');
      setSent(true);
    } catch (cause) {
      setError(cause instanceof SandboxApiError && cause.code === 'SESSION_EXPIRED'
        ? translate(locale, 'sessionExpired')
        : translate(locale, 'genericError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="page-shell">
      <div className="container narrow-page">
        <p className="eyebrow">{translate(locale, 'disputeEyebrow')}</p>
        <h1 tabIndex={-1}>{translate(locale, 'disputeTitle')}</h1>
        <p className="lead">{translate(locale, 'disputeDescription')}</p>
        {sent ? (
          <section className="success-panel" role="status">
            <p>{translate(locale, 'disputeSent')}</p>
            <a className="primary-button" href={`/tasks/${taskId}`}>{translate(locale, 'backToStatus')}</a>
          </section>
        ) : (
          <form className="dispute-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <fieldset>
              <legend>{translate(locale, 'disputeTitle')}</legend>
              {reasons.map((item) => (
                <label className="radio-control" key={item.code}>
                  <input type="radio" name="reason" value={item.code} checked={reason === item.code} onChange={() => setReason(item.code)} />
                  <span>{translate(locale, item.label)}</span>
                </label>
              ))}
            </fieldset>
            <label className="field-label" htmlFor="private-note">{translate(locale, 'privateNote')}</label>
            <textarea id="private-note" value={note} maxLength={1_000} rows={5} onChange={(event) => setNote(event.currentTarget.value)} aria-describedby="private-note-help" />
            <p id="private-note-help" className="form-help">{translate(locale, 'privateNoteHelp')}</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? translate(locale, 'sendingDispute') : translate(locale, 'sendDispute')}
              </button>
              <a className="secondary-button" href={`/tasks/${taskId}/result`}>{translate(locale, 'backToStatus')}</a>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
