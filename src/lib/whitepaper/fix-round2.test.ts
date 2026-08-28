import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { syncWhitepaperAssets } from '../../../tools/website/sync-whitepaper-assets.mjs';
import { parseWhitepaper } from './load';
import { LOCKED_WHITEPAPER_SLUGS, type WhitepaperMetadata } from './types';

const temporaryRoots: string[] = [];
const metadata: WhitepaperMetadata = {
  title: 'IROA.AI 백서', version: '1.0', date: '2026-08-21', language: 'ko-KR',
  controllingLanguage: 'Korean', status: 'published',
  pdfPath: 'docs/whitepaper/exports/IROA_WHITEPAPER_KO.pdf', slugs: [...LOCKED_WHITEPAPER_SLUGS],
};

function minimalWhitepaper(firstChapterBody = '', secondChapterBody = '') {
  return LOCKED_WHITEPAPER_SLUGS.map((_, index) => {
    const body = index === 0 ? firstChapterBody : index === 1 ? secondChapterBody : index === 15
      ? '| 배분 | 비율 | 수량 |\n|---|---:|---:|\n| 검증 | 100% | 10,000,000,000 |' : '';
    return `## ${index + 1}. Chapter ${index + 1}${body ? `\n\n${body}` : ''}`;
  }).join('\n\n');
}

async function tableFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'iroa-whitepaper-table-'));
  temporaryRoots.push(root);
  await mkdir(path.join(root, 'docs/whitepaper'), { recursive: true });
  await mkdir(path.join(root, 'docs/brand'), { recursive: true });
  await writeFile(path.join(root, 'docs/brand/logo.png'), 'fixture-image');
  await writeFile(path.join(root, 'docs/whitepaper/IROA_WHITEPAPER_KO.md'), '| media |\n| --- |\n| ![brand](../brand/logo.png) |');
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Task 7 fix round 2 validation', () => {
  it('rejects a hash that exists only in another chapter', () => {
    const markdown = minimalWhitepaper('### First {#chapter-one}\n\n[wrong](#chapter-two)', '### Second {#chapter-two}');

    expect(() => parseWhitepaper(markdown, metadata)).toThrow('unknown document fragment "#chapter-two" in chapter 1');
  });

  it('validates whitepaper route hashes against their destination chapter only', () => {
    const valid = minimalWhitepaper('### First {#chapter-one}', '### Second {#chapter-two}\n\n[valid](/whitepaper/daily-journeys#chapter-two)');
    const invalid = minimalWhitepaper('### First {#chapter-one}', '### Second {#chapter-two}\n\n[wrong](/whitepaper/daily-journeys#chapter-one)');

    expect(() => parseWhitepaper(valid, metadata)).not.toThrow();
    expect(() => parseWhitepaper(invalid, metadata)).toThrow('unknown document fragment "#chapter-one" for chapter "daily-journeys"');
  });

  it('includes table-contained images and links in loader inventory and rendering', () => {
    const publication = parseWhitepaper(minimalWhitepaper('| media | source |\n| --- | --- |\n| ![brand](../brand/iroa-symbol.svg) | [source](../brand/iroa-symbol.svg) |'), metadata);

    expect(publication.chapters[0].html).toContain('/generated/docs/brand/iroa-symbol.svg');
    expect(publication.chapters[0].html).toContain('alt="brand"');
  });

  it('synchronizes table-contained image assets', async () => {
    const root = await tableFixture();

    await expect(syncWhitepaperAssets({ projectRoot: root })).resolves.toMatchObject({ assetCount: 1 });
    await expect(readFile(path.join(root, 'public/generated/docs/brand/logo.png'), 'utf8')).resolves.toBe('fixture-image');
  });

  it('handles raw HTML attributes containing > and reordered source attributes', () => {
    const publication = parseWhitepaper(minimalWhitepaper('<img alt="1 > 0" class="figure" src="../brand/iroa-symbol.svg">'), metadata);

    expect(publication.chapters[0].html).toContain('/generated/docs/brand/iroa-symbol.svg');
    expect(publication.chapters[0].html).toContain('alt="1 &gt; 0"');
    expect(() => parseWhitepaper(minimalWhitepaper('<a title="1 > 0" href="docs/missing.md">missing</a>'), metadata)).toThrow('broken repository-local link "docs/missing.md"');
  });
});
