import type { NetworkEvent } from './events';
import { byNewest, NODE_STATUS } from './events';

/** Sentence templates carried by the page content; `{id}` and `{epoch}` are substituted. */
export interface ActivityTemplates {
  registered: string;
  approved: string;
  suspended: string;
  revoked: string;
  reinstated: string;
  rootProposed: string;
  rootFinalized: string;
  rewardClaimed: string;
}

export interface ActivityLine {
  key: string;
  text: string;
  href: string;
  timestamp: number;
}

export const ACTIVITY_LIMIT = 10;

const short = (hex: string) => hex.slice(2, 10);

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * One event, one plain sentence. Wallets and amounts never appear; a NODE is
 * named by the first eight hex characters of its id, an epoch by its number.
 */
export function describeEvent(event: NetworkEvent, templates: ActivityTemplates): string | null {
  switch (event.kind) {
    case 'NodeRegistered':
      return fill(templates.registered, { level: `N${event.trustLevel}`, id: short(event.nodeId) });
    case 'NodeStatusChanged': {
      const values = { id: short(event.nodeId) };
      if (event.newStatus === NODE_STATUS.Active && event.previousStatus === NODE_STATUS.Pending) return fill(templates.approved, values);
      if (event.newStatus === NODE_STATUS.Active) return fill(templates.reinstated, values);
      if (event.newStatus === NODE_STATUS.Suspended) return fill(templates.suspended, values);
      if (event.newStatus === NODE_STATUS.Revoked) return fill(templates.revoked, values);
      return null;
    }
    case 'RootProposed':
      return fill(templates.rootProposed, { epoch: event.epoch.toString() });
    case 'RootFinalized':
      return fill(templates.rootFinalized, { epoch: event.epoch.toString() });
    case 'RewardClaimed':
      return fill(templates.rewardClaimed, { epoch: event.epoch.toString() });
    default:
      return null;
  }
}

export function activityLines(
  events: readonly NetworkEvent[],
  templates: ActivityTemplates,
  explorer: string,
  limit = ACTIVITY_LIMIT,
): ActivityLine[] {
  const lines: ActivityLine[] = [];
  for (const event of [...events].sort(byNewest)) {
    const text = describeEvent(event, templates);
    if (!text) continue;
    lines.push({
      key: `${event.transactionHash}:${event.logIndex}`,
      text,
      href: `${explorer}/tx/${event.transactionHash}`,
      timestamp: event.timestamp,
    });
    if (lines.length === limit) break;
  }
  return lines;
}
