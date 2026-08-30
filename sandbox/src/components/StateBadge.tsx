import type { TaskState } from '@iroa/protocol';
import { Icon, type IconName } from './Icon';
import type { Locale, TranslationKey } from '../lib/i18n';
import { translate } from '../lib/i18n';

const stateTone: Record<TaskState, { tone: string; icon: IconName }> = {
  draft: { tone: 'neutral', icon: 'clock' },
  awaiting_approval: { tone: 'pending', icon: 'clock' },
  queued: { tone: 'pending', icon: 'clock' },
  assigned: { tone: 'active', icon: 'shield' },
  running: { tone: 'active', icon: 'refresh' },
  awaiting_confirmation: { tone: 'attention', icon: 'warning' },
  verified: { tone: 'success', icon: 'check' },
  disputed: { tone: 'attention', icon: 'warning' },
  failed: { tone: 'danger', icon: 'x' },
  cancelled: { tone: 'neutral', icon: 'x' },
  reward_pending: { tone: 'active', icon: 'clock' },
  rewarded: { tone: 'success', icon: 'check' },
};

export function StateBadge({ state, locale }: { state: TaskState; locale: Locale }) {
  const visual = stateTone[state];
  return (
    <span className="state-badge" data-tone={visual.tone}>
      <Icon name={visual.icon} />
      {translate(locale, `state_${state}` as TranslationKey)}
    </span>
  );
}
