import { describe, expect, it } from 'vitest';
import { faqEn } from './faq.en';
import { faqKo } from './faq.ko';
import type { FaqPageContent } from '../types/faq';

const locales: ReadonlyArray<readonly [string, FaqPageContent]> = [
  ['ko', faqKo],
  ['en', faqEn],
];

const entriesOf = (content: FaqPageContent) => content.groups.flatMap((group) => group.entries);

describe('published Q&A content', () => {
  for (const [locale, content] of locales) {
    describe(locale, () => {
      it('gives every entry a unique anchor so the contents list never lands on the wrong answer', () => {
        const ids = entriesOf(content).map((entry) => entry.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('gives every group a unique anchor target for its heading', () => {
        const ids = content.groups.map((group) => group.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('leaves no answer empty', () => {
        for (const entry of entriesOf(content)) {
          expect(entry.answer.length, entry.id).toBeGreaterThan(0);
          for (const paragraph of entry.answer) expect(paragraph.trim(), entry.id).not.toBe('');
        }
      });

      it('marks every capability answer that is not operating yet', () => {
        const unmarked = entriesOf(content)
          .filter((entry) => !entry.status)
          .map((entry) => entry.id);
        // Answers that describe the project rather than a capability stay unmarked.
        expect(unmarked).toEqual([
          'what-is-iroa',
          'name-meaning',
          'problem',
          'principle',
          'who-uses',
          'difference',
          'technology-stack',
          'privacy',
          'social-value',
          'human-care',
          'competitiveness',
          'future',
        ]);
      });

      it('states the operating boundary before any answer', () => {
        expect(content.notice.trim()).not.toBe('');
      });
    });
  }

  it('keeps both locales in step so the language switch never drops a question', () => {
    expect(entriesOf(faqEn).map((entry) => entry.id)).toEqual(
      entriesOf(faqKo).map((entry) => entry.id),
    );
    expect(faqEn.groups.map((group) => group.id)).toEqual(faqKo.groups.map((group) => group.id));
  });

  it('carries the same status marker for the same question in both locales', () => {
    const statusById = (content: FaqPageContent) =>
      Object.fromEntries(entriesOf(content).map((entry) => [entry.id, entry.status ?? null]));
    expect(statusById(faqEn)).toEqual(statusById(faqKo));
  });

  it('publishes the twenty-two questions the project approved', () => {
    expect(entriesOf(faqKo)).toHaveLength(22);
  });
});
