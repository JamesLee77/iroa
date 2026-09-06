import type { ActivityLine } from './activity';
import type { NetworkMetrics } from './events';

export interface StateCopy {
  locale: 'ko' | 'en';
  placeholder: string;
  updated: { label: string; failed: string; loading: string };
  activity: { empty: string };
  scope: { full: string; window: string };
}

export interface StateReading {
  metrics: NetworkMetrics;
  lines: ActivityLine[];
  scope: 'full' | 'window';
}

const query = <T extends Element>(root: ParentNode, selector: string): T | null => root.querySelector<T>(selector);

const dateTime = (locale: StateCopy['locale'], seconds: number) =>
  new Date(seconds * 1000).toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

const clock = (locale: StateCopy['locale'], date: Date) =>
  date.toLocaleTimeString(locale === 'en' ? 'en-US' : 'ko-KR', { hour: '2-digit', minute: '2-digit' });

const number = (locale: StateCopy['locale'], value: number) => value.toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR');

function setMetric(root: ParentNode, id: string, text: string): void {
  const value = query<HTMLElement>(root, `[data-metric="${id}"] .network-state__value`);
  if (!value) return;
  value.textContent = text;
  value.dataset.value = 'live';
}

export function renderMetrics(root: ParentNode, metrics: NetworkMetrics, copy: StateCopy): void {
  setMetric(root, 'active-nodes', number(copy.locale, metrics.activeNodes));
  setMetric(root, 'trust-mix', ([0, 1, 2, 3] as const).map((level) => `N${level} ${metrics.trustMix[level]}`).join(' · '));
  setMetric(root, 'finalized-epochs', number(copy.locale, metrics.finalizedEpochs));
  setMetric(root, 'last-root', metrics.lastRootAt === null ? copy.placeholder : dateTime(copy.locale, metrics.lastRootAt));
  setMetric(root, 'claims', number(copy.locale, metrics.claims));

  const hub = query<SVGTextElement>(root, '[data-viz="hub"]');
  if (hub) hub.textContent = String(metrics.finalizedEpochs);
  for (const level of [0, 1, 2, 3] as const) {
    const count = metrics.trustMix[level];
    const marker = query<SVGCircleElement>(root, `[data-viz="N${level}"] circle`);
    const label = query<SVGTextElement>(root, `[data-viz="N${level}"] text[data-count]`);
    if (marker) marker.setAttribute('r', String(6 + Math.min(count, 10)));
    if (label) label.textContent = String(count);
  }
}

export function renderActivity(root: ParentNode, lines: ActivityLine[], copy: StateCopy): void {
  const list = query<HTMLOListElement>(root, '[data-activity]');
  if (!list) return;
  list.replaceChildren();
  if (!lines.length) {
    const item = list.ownerDocument.createElement('li');
    item.className = 'network-activity__empty';
    item.textContent = copy.activity.empty;
    list.append(item);
    return;
  }
  for (const line of lines) {
    const item = list.ownerDocument.createElement('li');
    item.dataset.key = line.key;
    const anchor = list.ownerDocument.createElement('a');
    anchor.href = line.href;
    anchor.rel = 'noreferrer';
    anchor.target = '_blank';
    anchor.textContent = line.text;
    const time = list.ownerDocument.createElement('time');
    time.dateTime = new Date(line.timestamp * 1000).toISOString();
    time.textContent = line.timestamp ? dateTime(copy.locale, line.timestamp) : copy.placeholder;
    item.append(anchor, time);
    list.append(item);
  }
}

export function renderStatus(root: ParentNode, status: { kind: 'loading' | 'ok' | 'failed'; at: Date; scope?: 'full' | 'window' }, copy: StateCopy): void {
  const line = query<HTMLElement>(root, '[data-updated]');
  if (!line) return;
  line.dataset.updated = status.kind;
  const time = clock(copy.locale, status.at);
  line.textContent =
    status.kind === 'loading' ? copy.updated.loading
    : status.kind === 'ok' ? copy.updated.label.replace('{time}', time)
    : copy.updated.failed.replace('{time}', time);
  const scope = query<HTMLElement>(root, '[data-scope]');
  if (scope && status.scope) scope.textContent = copy.scope[status.scope];
}

/**
 * Polls the reader and paints the block. A failed read keeps the last
 * figures on screen and marks the timestamp line instead of blanking them;
 * polling pauses while the tab is hidden.
 */
export function startNetworkState(input: {
  root: HTMLElement;
  read: () => Promise<StateReading>;
  copy: StateCopy;
  document: Document;
  intervalMs?: number;
  now?: () => Date;
}): { tick: () => Promise<void>; stop: () => void } {
  const { root, read, copy, document, intervalMs = 30_000, now = () => new Date() } = input;
  let inFlight = false;

  const tick = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const reading = await read();
      renderMetrics(root, reading.metrics, copy);
      renderActivity(root, reading.lines, copy);
      renderStatus(root, { kind: 'ok', at: now(), scope: reading.scope }, copy);
    } catch {
      renderStatus(root, { kind: 'failed', at: now() }, copy);
    } finally {
      inFlight = false;
    }
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  const resume = () => {
    if (timer !== null) return;
    void tick();
    timer = setInterval(() => void tick(), intervalMs);
  };
  const pause = () => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  };
  const onVisibility = () => (document.hidden ? pause() : resume());

  renderStatus(root, { kind: 'loading', at: now() }, copy);
  document.addEventListener('visibilitychange', onVisibility);
  if (!document.hidden) resume();

  return {
    tick,
    stop: () => {
      pause();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
