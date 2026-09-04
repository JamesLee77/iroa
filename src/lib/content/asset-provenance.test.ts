// @vitest-environment node

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const siteAssets = 'src/assets/home';
const brandIllustrations = 'docs/brand/assets/illustrations';

const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

describe('site asset provenance', () => {
  /**
   * The homepage whitepaper card once carried a file named after a brand
   * illustration whose contents were something else entirely — an older cover
   * built around a stock photograph the document no longer contains. A reader
   * saw one cover on the page and downloaded another. A shared name has to mean
   * shared bytes.
   */
  it('never shadows a brand illustration with different bytes under the same name', () => {
    const mismatched = readdirSync(siteAssets)
      .filter((name) => name.endsWith('.png'))
      .filter((name) => {
        const original = path.join(brandIllustrations, name);
        try {
          return digest(original) !== digest(path.join(siteAssets, name));
        } catch {
          return false; // no brand original of that name; the asset is site-only
        }
      });
    expect(mismatched).toEqual([]);
  });

  it('builds the whitepaper card from the illustration the document itself prints', () => {
    const card = path.join(siteAssets, 'iroa-whitepaper-cover-card.png');
    expect(() => readFileSync(card)).not.toThrow();
    const generator = readFileSync('tools/website/render-whitepaper-cover.mjs', 'utf8');
    expect(generator).toContain('docs/brand/assets/illustrations/iroa-whitepaper-cover-v1.png');
    expect(generator).toContain('docs/whitepaper/IROA_WHITEPAPER_KO.md');
  });

  it('keeps the card wording tied to the whitepaper front matter', () => {
    const markdown = readFileSync('docs/whitepaper/IROA_WHITEPAPER_KO.md', 'utf8').split('\n');
    for (const prefix of ['# ', '## ', '### ', '> ']) {
      expect(markdown.some((line) => line.startsWith(prefix)), prefix).toBe(true);
    }
  });
});
