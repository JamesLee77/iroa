// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Stylesheets that paint the published pages. */
const liveStylesheets = ['src/styles/foundations.css', 'src/styles/components.css', 'src/styles/pages.css'];

/** Print rules set physical measures and sit outside the screen scales. */
const withoutPrintRules = (css: string) => css.replace(/@media print\s*\{[\s\S]*?\n\}/g, '');

const declarationsOf = (property: RegExp) =>
  liveStylesheets.flatMap((path) =>
    [...withoutPrintRules(readFileSync(path, 'utf8')).matchAll(property)]
      .map((match) => `${path}: ${match[0].trim()}`));

describe('design-system scale usage', () => {
  it('sets every line height from the leading scale', () => {
    const offScale = declarationsOf(/line-height:\s*[^;}]+/g)
      .filter((entry) => !entry.includes('var(--leading') && !entry.includes('var(--line-height'));
    expect(offScale).toEqual([]);
  });

  it('sets section-scale spacing from tokens rather than inline lengths', () => {
    // Values at or above 4rem are section rhythm; below that the --space-1..12
    // steps apply, and a handful of sub-step optical nudges are allowed.
    const sectionSized = declarationsOf(/(?:padding|margin)[a-z-]*:\s*[^;}]+/g)
      .filter((entry) => /(?<![\d.])([4-9]|[1-9][0-9])(\.[0-9]+)?rem\b/.test(entry))
      .filter((entry) => !entry.includes('var(--'));
    expect(sectionSized).toEqual([]);
  });

  it('keeps optical nudges to the two that earn an exception', () => {
    const nudges = declarationsOf(/(?:padding|margin)[a-z-]*:\s*[^;}]+/g)
      .filter((entry) => /:\s*-?0\.[0-9]+rem\s*$/.test(entry) && !entry.includes('var(--'));
    expect(nudges.sort()).toEqual([
      // Aligns the atlas marker with the cap height of the stage name.
      'src/styles/pages.css: margin-block-start: 0.28rem',
      // Keeps the settlement chip from touching its own border.
      'src/styles/pages.css: padding-inline: 0.2rem',
    ].sort());
  });
});
