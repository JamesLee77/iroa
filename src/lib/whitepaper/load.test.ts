import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  loadWhitepaper,
  parseWhitepaper,
  validateNavigation,
} from './load';
import type { WhitepaperMetadata } from './types';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, '../../..');
const sourcePath = path.join(projectRoot, 'docs/whitepaper/IROA_WHITEPAPER_KO.md');
const metadataPath = path.join(projectRoot, 'docs/whitepaper/IROA_WHITEPAPER_KO.meta.json');

const lockedSlugs = [
  'core-declaration', 'daily-journeys', 'problem-and-market', 'product-system',
  'safe-execution', 'mobile', 'watch', 'secure-execution-space', 'ai-kiosk',
  'service-architecture', 'ai-technology', 'privacy-and-safety',
  'health-and-wearables', 'data-contribution', 'reward-economy', 'token-economy',
  'business-model', 'roadmap', 'operations-and-accountability', 'risks',
  'prelaunch-validation', 'conclusion',
] as const;

const metadata: WhitepaperMetadata = {
  title: 'IROA.AI 백서',
  version: '1.0',
  date: '2026-08-21',
  language: 'ko-KR',
  controllingLanguage: 'Korean',
  status: 'published',
  pdfPath: 'docs/whitepaper/exports/IROA_WHITEPAPER_KO.pdf',
  slugs: [...lockedSlugs],
};

async function canonicalMarkdown() {
  return readFile(sourcePath, 'utf8');
}

function minimalWhitepaper(firstChapterBody = '') {
  return lockedSlugs.map((_, index) => (
    `## ${index + 1}. Chapter ${index + 1}${index === 0 && firstChapterBody ? `\n\n${firstChapterBody}` : index === 15 ? '\n\n| 배분 | 비율 | 수량 |\n|---|---:|---:|\n| 검증 | 100% | 10,000,000,000 |' : ''}`
  )).join('\n\n');
}

describe('canonical whitepaper loader', () => {
  it('loads the canonical Korean publication with the locked chapter model', async () => {
    const publication = await loadWhitepaper();

    expect(publication.metadata).toMatchObject({
      title: 'IROA.AI 백서',
      version: '1.0',
      language: 'ko-KR',
      status: 'published',
    });
    expect(publication.chapters).toHaveLength(22);
    expect(publication.chapters[0]).toMatchObject({ number: 1, slug: 'core-declaration' });
    expect(publication.chapters[21]).toMatchObject({ number: 22, slug: 'conclusion' });
    expect(publication.chapters[15].html).toContain('10,000,000,000');
    expect(new Set(publication.chapters.map(({ slug }) => slug)).size).toBe(22);
    expect(publication.preambleHtml).toContain('일상을 이롭게');
  });

  it('rewrites canonical image URLs with dimensions and safe loading behavior', async () => {
    const publication = await loadWhitepaper();
    const firstFigure = publication.chapters[3].html;
    const laterFigure = publication.chapters[15].html;

    expect(firstFigure).toMatch(/src="\/generated\/docs\/brand\/assets\/photos\/tablet-support-6646818\.jpg"/);
    expect(firstFigure).toMatch(/width="\d+" height="\d+"/);
    expect(laterFigure).toContain('loading="lazy"');
    expect(laterFigure).toContain('alt="IROA 토큰 배분"');
  });

  it('rejects duplicate chapter numbers with the chapter number in the error', async () => {
    const markdown = (await canonicalMarkdown()).replace('## 2. 사용자의 하루로 보는 IROA', '## 1. 사용자의 하루로 보는 IROA');

    expect(() => parseWhitepaper(markdown, metadata)).toThrow('duplicate chapter number 1');
  });

  it('rejects a missing chapter 22', async () => {
    const markdown = (await canonicalMarkdown()).replace(/\n## 22\. 결론[\s\S]*$/, '');

    expect(() => parseWhitepaper(markdown, metadata)).toThrow('expected 22 chapters');
  });

  it('rejects reordered chapter numbers with the unexpected value', async () => {
    const markdown = (await canonicalMarkdown()).replace('## 2. 사용자의 하루로 보는 IROA', '## 3. 사용자의 하루로 보는 IROA');

    expect(() => parseWhitepaper(markdown, metadata)).toThrow('expected 2, received 3');
  });

  it('rejects an unknown publication status by name', () => {
    expect(() => parseWhitepaper(minimalWhitepaper(), { ...metadata, status: 'live' as WhitepaperMetadata['status'] })).toThrow('unknown whitepaper publication status "live"');
  });

  it('rejects duplicate locked slugs', async () => {
    const duplicateSlugs = [...metadata.slugs];
    duplicateSlugs[1] = duplicateSlugs[0];

    expect(() => parseWhitepaper(minimalWhitepaper(), { ...metadata, slugs: duplicateSlugs })).toThrow('duplicate locked slug');
  });

  it('rejects duplicate explicit lower-heading anchors with the duplicate ID', () => {
    const markdown = minimalWhitepaper('### First {#same-anchor}\n\n### Second {#same-anchor}');

    expect(() => parseWhitepaper(markdown, metadata)).toThrow('duplicate heading ID "same-anchor"');
  });

  it('rejects broken repository-local Markdown links with their path', () => {
    const markdown = minimalWhitepaper('[broken](docs/missing.md)');

    expect(() => parseWhitepaper(markdown, metadata)).toThrow('broken repository-local link "docs/missing.md"');
  });

  it('rejects a missing navigation entry with its chapter number', () => {
    expect(() => validateNavigation([
      { number: 1, slug: 'one', title: 'One', html: '', headings: [], previous: undefined, next: undefined },
      { number: 2, slug: 'two', title: 'Two', html: '', headings: [], previous: undefined, next: undefined },
    ])).toThrow('chapter 1 is missing next navigation');
  });

  it('rejects token allocations that do not sum to 100%', async () => {
    const markdown = (await canonicalMarkdown()).replace('| NODE 구축·운영 보상 | 25% | 2,500,000,000 |', '| NODE 구축·운영 보상 | 24% | 2,500,000,000 |');

    expect(() => parseWhitepaper(markdown, metadata)).toThrow('token allocation total must equal 100%');
  });

  it('rejects token allocations that do not sum to 10,000,000,000 IROA', async () => {
    const markdown = (await canonicalMarkdown()).replace('| NODE 구축·운영 보상 | 25% | 2,500,000,000 |', '| NODE 구축·운영 보상 | 25% | 2,499,999,999 |');

    expect(() => parseWhitepaper(markdown, metadata)).toThrow('token allocation amount must equal 10,000,000,000 IROA');
  });

  it('rejects local image traversal outside the repository with the image path', () => {
    const markdown = minimalWhitepaper('![outside](../../../outside.png)');

    expect(() => parseWhitepaper(markdown, metadata)).toThrow('local asset path escapes repository "../../../outside.png"');
  });

  it('rejects a missing local image with the image path', () => {
    const markdown = minimalWhitepaper('![missing](analysis/missing.png)');

    expect(() => parseWhitepaper(markdown, metadata)).toThrow('missing local image "analysis/missing.png"');
  });

  it('reads the checked-in metadata contract', async () => {
    await expect(readFile(metadataPath, 'utf8')).resolves.toContain('"core-declaration"');
  });

  it('keeps every canonical lower heading anchor unique across the publication', async () => {
    const publication = await loadWhitepaper();
    const ids = publication.chapters.flatMap((chapter) => chapter.headings.map(({ id }) => id));

    expect(new Set(ids).size).toBe(ids.length);
  });
});
