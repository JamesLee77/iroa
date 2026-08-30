import { useMemo, useState } from 'react';
import type { TaskCapsule } from '@iroa/protocol';
import { createAndApproveTask, SandboxApiError } from '../lib/api';
import { randomHex32, sha256Hex } from '../lib/crypto';
import { sandboxConfig } from '../lib/config';
import { taskFixtures, type FixtureId } from '../lib/fixtures';
import { translate, type Locale } from '../lib/i18n';
import { Icon, type IconName } from '../components/Icon';

const fixtureIcons: Record<FixtureId, IconName> = {
  'public-information': 'search',
  'mock-availability': 'calendar',
  'easy-language': 'document',
};

function friendlyError(locale: Locale, error: unknown): string {
  if (error instanceof SandboxApiError && error.code === 'SESSION_EXPIRED') return translate(locale, 'sessionExpired');
  return translate(locale, 'genericError');
}

export function NewTask({ locale }: { locale: Locale }) {
  const [selectedId, setSelectedId] = useState<FixtureId>('public-information');
  const [approved, setApproved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = useMemo(() => taskFixtures.find((fixture) => fixture.id === selectedId) ?? taskFixtures[0], [selectedId]);

  async function submit(): Promise<void> {
    if (!approved || !selected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const taskId = randomHex32();
      const approvalMaterial = JSON.stringify({
        taskId,
        fixture: selected.id,
        cost: '0',
        disclosureVersion: 'sandbox-1',
      });
      const capsule: TaskCapsule = {
        taskId,
        policyVersion: sandboxConfig.policyVersion,
        trustLevel: 'N0',
        capabilityScope: [...selected.capabilityScope],
        expiresAt: Math.floor(Date.now() / 1_000) + 30 * 60,
        inputCiphertextRef: selected.inputCiphertextRef,
        expectedResultSchema: selected.expectedResultSchema,
        userApprovalHash: await sha256Hex(approvalMaterial),
      };
      const task = await createAndApproveTask(capsule);
      window.sessionStorage.setItem(`iroa-sandbox-task:${task.taskId}`, selected.id);
      window.location.assign(`/tasks/${task.taskId}`);
    } catch (cause) {
      setError(friendlyError(locale, cause));
      setSubmitting(false);
    }
  }

  return (
    <main id="main" className="page-shell">
      <div className="container page-grid">
        <section className="page-intro">
          <p className="eyebrow">{translate(locale, 'homeEyebrow')}</p>
          <h1 tabIndex={-1}>{translate(locale, 'homeTitle')}</h1>
          <p className="lead">{translate(locale, 'homeDescription')}</p>
        </section>

        <section className="task-builder" aria-labelledby="choose-task-title">
          <div className="section-heading">
            <h2 id="choose-task-title">{translate(locale, 'chooseTask')}</h2>
            <p id="choose-task-help">{translate(locale, 'chooseTaskHelp')}</p>
          </div>
          <div className="fixture-grid" aria-describedby="choose-task-help">
            {taskFixtures.map((fixture) => {
              const selectedFixture = fixture.id === selectedId;
              return (
                <button
                  key={fixture.id}
                  type="button"
                  aria-pressed={selectedFixture}
                  className="fixture-card"
                  data-selected={selectedFixture || undefined}
                  onClick={() => { setSelectedId(fixture.id); setApproved(false); }}
                >
                  <span className="fixture-card__icon"><Icon name={fixtureIcons[fixture.id]} /></span>
                  <strong>{translate(locale, fixture.titleKey)}</strong>
                  <span>{translate(locale, fixture.descriptionKey)}</span>
                  {selectedFixture && <span className="fixture-card__selected"><Icon name="check" />{translate(locale, 'selected')}</span>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="approval-panel" aria-labelledby="approval-title">
          <div className="section-heading">
            <p className="eyebrow">{selected && translate(locale, selected.titleKey)}</p>
            <h2 id="approval-title">{translate(locale, 'reviewTitle')}</h2>
          </div>
          <dl className="disclosure-list">
            <div><dt>{translate(locale, 'costLabel')}</dt><dd>{translate(locale, 'costValue')}</dd></div>
            <div><dt>{translate(locale, 'sharedLabel')}</dt><dd>{translate(locale, 'sharedValue')}</dd></div>
            <div><dt>{translate(locale, 'cancelLabel')}</dt><dd>{translate(locale, 'cancelValue')}</dd></div>
            <div><dt>{translate(locale, 'humanReviewLabel')}</dt><dd>{translate(locale, 'humanReviewValue')}</dd></div>
          </dl>
          <p className="warning-callout"><Icon name="warning" />{translate(locale, 'privacyWarning')}</p>
          <label className="consent-control">
            <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.currentTarget.checked)} />
            <span>{translate(locale, 'approvalCheck')}</span>
          </label>
          {!approved && <p className="form-help">{translate(locale, 'approvalRequired')}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="button" disabled={!approved || submitting} onClick={() => void submit()}>
            {submitting ? translate(locale, 'submitting') : translate(locale, 'submit')}
          </button>
        </section>
      </div>
    </main>
  );
}
