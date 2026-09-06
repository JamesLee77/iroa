// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeEn } from './node.en';
import { nodeKo } from './node.ko';
import type { NodePageContent } from '../types/node';

const locales: ReadonlyArray<readonly [string, NodePageContent, string]> = [
  ['ko', nodeKo, 'docs/whitepaper/IROA_WHITEPAPER_KO.md'],
  ['en', nodeEn, 'docs/whitepaper/IROA_WHITEPAPER_EN.md'],
];

/** The five trust-level rows of the whitepaper's §8.3 table, cell by cell. */
const whitepaperTrustRows = (markdown: string) =>
  markdown
    .split('\n')
    .filter((line) => /^\| N[0-4] /.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));

/** The lines of the first formula block under the §16.4 heading. */
const whitepaperRewardFormula = (markdown: string) => {
  const section = markdown.slice(markdown.indexOf('### 16.4'));
  const block = section.match(/~~~text\n([\s\S]*?)~~~/);
  if (!block) throw new Error('whitepaper §16.4 carries no formula block');
  return block[1]
    .split('\n')
    .filter((line) => /^[=+-] /.test(line))
    .map((line) => ({ sign: line[0], label: line.slice(2).trim() }));
};

describe('published NODE page content', () => {
  for (const [locale, content, whitepaperPath] of locales) {
    const whitepaper = readFileSync(whitepaperPath, 'utf8');

    describe(locale, () => {
      it('prints the trust-level table exactly as the whitepaper does', () => {
        const rows = content.trustLevels.levels.map((row) => [
          `${row.level} ${row.name}`,
          row.examples,
          row.allowed,
        ]);
        expect(rows).toEqual(whitepaperTrustRows(whitepaper));
      });

      it('prints the reward formula exactly as the whitepaper does', () => {
        expect(content.rewards.formula).toEqual(whitepaperRewardFormula(whitepaper));
      });

      it('quotes the NODE allocation the whitepaper allocates', () => {
        const { share, amount } = content.rewards.allocation;
        expect(whitepaper).toContain(`| ${share} | ${amount} |`);
      });

      it('weights the task score to a whole', () => {
        const total = content.rewards.scoreWeights.reduce((sum, weight) => sum + weight.weightPercent, 0);
        expect(total).toBe(100);
      });

      it('lists the trust levels in order and the pilot stages in order', () => {
        expect(content.trustLevels.levels.map((row) => row.level)).toEqual(['N0', 'N1', 'N2', 'N3', 'N4']);
        expect(content.pilot.stages.map((stage) => stage.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
      });

      it('never marks a network figure or the operator path as operating', () => {
        expect(content.networkState.status).not.toBe('current');
        expect(content.operator.status).not.toBe('current');
        expect(content.participation.status).not.toBe('current');
      });

      it('states the operating boundary before any section', () => {
        expect(content.notice.trim()).not.toBe('');
      });

      it('makes no speculative public claim', () => {
        const serialized = JSON.stringify(content);
        for (const forbidden of ['수익 보장', '상장 예정', '토큰 구매', 'guaranteed return', 'listing soon', 'buy tokens', 'APY']) {
          expect(serialized).not.toContain(forbidden);
        }
      });
    });
  }

  it('keeps both locales in step so the language switch never drops a block', () => {
    const shape = (content: NodePageContent) => ({
      metrics: content.networkState.metrics.map((metric) => metric.id),
      stages: content.pilot.stages.map((stage) => [stage.id, stage.status]),
      statuses: [
        content.definition.status,
        content.trustLevels.status,
        content.operator.status,
        content.rewards.status,
        content.dilution.status,
        content.networkState.status,
        content.participation.status,
      ],
      counts: [
        content.definition.capsule.length,
        content.operator.steps.length,
        content.rewards.rules.length,
        content.participation.requirements.length,
        content.boundaries.items.length,
      ],
    });
    expect(shape(nodeEn)).toEqual(shape(nodeKo));
  });
});
