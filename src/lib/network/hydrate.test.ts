import { describe, expect, it, vi } from 'vitest';
import { renderActivity, renderMetrics, startNetworkState, type StateCopy, type StateReading } from './hydrate';

const copy: StateCopy = {
  locale: 'ko',
  placeholder: '—',
  updated: { label: '{time} 갱신', failed: '갱신 실패 · {time}', loading: '읽는 중' },
  activity: { empty: '아직 기록이 없습니다.' },
  scope: { full: '배포 블록부터 전체', window: '최근 블록 창' },
};

function mount(): HTMLElement {
  document.body.innerHTML = `
    <section id="network-state">
      <p data-updated></p><p data-scope></p>
      <ul>
        ${['active-nodes', 'trust-mix', 'finalized-epochs', 'last-root', 'claims']
          .map((id) => `<li data-metric="${id}"><strong class="network-state__value" data-value="pending">—</strong></li>`)
          .join('')}
      </ul>
      <svg><text data-viz="hub">0</text><g data-viz="N1"><circle r="6"></circle><text data-count>0</text></g></svg>
      <ol data-activity></ol>
    </section>`;
  return document.querySelector('#network-state') as HTMLElement;
}

const reading: StateReading = {
  metrics: { activeNodes: 3, trustMix: { 0: 0, 1: 2, 2: 1, 3: 0 }, finalizedEpochs: 4, lastRootAt: 1_700_000_000, claims: 7 },
  lines: [{ key: 'a', text: '4 에폭 결산 확정', href: 'https://sepolia.basescan.org/tx/0xabc', timestamp: 1_700_000_000 }],
  scope: 'full',
};

describe('network state hydration', () => {
  it('replaces the placeholders with live figures and marks them live', () => {
    const root = mount();
    renderMetrics(root, reading.metrics, copy);
    const value = (id: string) => root.querySelector(`[data-metric="${id}"] .network-state__value`) as HTMLElement;
    expect(value('active-nodes').textContent).toBe('3');
    expect(value('active-nodes').dataset.value).toBe('live');
    expect(value('trust-mix').textContent).toBe('N0 0 · N1 2 · N2 1 · N3 0');
    expect(value('claims').textContent).toBe('7');
    expect(root.querySelector('[data-viz="hub"]')?.textContent).toBe('4');
    expect(root.querySelector('[data-viz="N1"] circle')?.getAttribute('r')).toBe('8');
  });

  it('keeps the placeholder for the last root before any epoch is finalized', () => {
    const root = mount();
    renderMetrics(root, { ...reading.metrics, lastRootAt: null }, copy);
    expect(root.querySelector('[data-metric="last-root"] .network-state__value')?.textContent).toBe('—');
  });

  it('lists activity lines as transaction links, or says there is none', () => {
    const root = mount();
    renderActivity(root, reading.lines, copy);
    const anchor = root.querySelector('[data-activity] a') as HTMLAnchorElement;
    expect(anchor.textContent).toBe('4 에폭 결산 확정');
    expect(anchor.getAttribute('href')).toBe('https://sepolia.basescan.org/tx/0xabc');
    renderActivity(root, [], copy);
    expect(root.querySelector('[data-activity]')?.textContent).toBe('아직 기록이 없습니다.');
  });

  it('keeps the last figures and marks the timestamp when a read fails', async () => {
    const root = mount();
    const read = vi.fn<() => Promise<StateReading>>().mockResolvedValueOnce(reading).mockRejectedValueOnce(new Error('rpc down'));
    const controller = startNetworkState({ root, read, copy, document, intervalMs: 60_000, now: () => new Date(2026, 8, 6, 14, 5) });
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    await controller.tick();
    expect(root.querySelector('[data-metric="claims"] .network-state__value')?.textContent).toBe('7');
    expect((root.querySelector('[data-updated]') as HTMLElement).dataset.updated).toBe('failed');
    expect(root.querySelector('[data-updated]')?.textContent).toContain('갱신 실패');
    controller.stop();
  });

  it('pauses polling while the tab is hidden and resumes when it is shown', async () => {
    vi.useFakeTimers();
    try {
      const root = mount();
      const read = vi.fn<() => Promise<StateReading>>().mockResolvedValue(reading);
      const controller = startNetworkState({ root, read, copy, document, intervalMs: 1_000 });
      await vi.advanceTimersByTimeAsync(2_500);
      const before = read.mock.calls.length;
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(3_000);
      expect(read.mock.calls.length).toBe(before);
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(10);
      expect(read.mock.calls.length).toBe(before + 1);
      controller.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
