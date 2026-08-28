import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { syncWhitepaperAssets } from '../../../tools/website/sync-whitepaper-assets.mjs';
import { loadWhitepaper, parseWhitepaper } from './load';
import { LOCKED_WHITEPAPER_SLUGS, type WhitepaperMetadata } from './types';

const temporaryRoots: string[] = [];

const metadata: WhitepaperMetadata = {
  title: 'IROA.AI 백서',
  version: '1.0',
  date: '2026-08-21',
  language: 'ko-KR',
  controllingLanguage: 'Korean',
  status: 'published',
  pdfPath: 'docs/whitepaper/exports/IROA_WHITEPAPER_KO.pdf',
  slugs: [...LOCKED_WHITEPAPER_SLUGS],
};

function minimalWhitepaper(firstChapterBody = '', secondChapterBody = '') {
  return LOCKED_WHITEPAPER_SLUGS.map((_, index) => {
    const body = index === 0 ? firstChapterBody : index === 1 ? secondChapterBody : index === 15
      ? '| 배분 | 비율 | 수량 |\n|---|---:|---:|\n| 검증 | 100% | 10,000,000,000 |'
      : '';
    return `## ${index + 1}. Chapter ${index + 1}${body ? `\n\n${body}` : ''}`;
  }).join('\n\n');
}

async function makeSyncFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'iroa-whitepaper-sync-'));
  temporaryRoots.push(root);
  await mkdir(path.join(root, 'docs/whitepaper'), { recursive: true });
  await mkdir(path.join(root, 'docs/brand'), { recursive: true });
  await writeFile(path.join(root, 'docs/whitepaper/IROA_WHITEPAPER_KO.md'), '![brand](../brand/logo.png)');
  await writeFile(path.join(root, 'docs/brand/logo.png'), 'fixture-image');
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Task 7 fix round 1 validation', () => {
  it('rejects an approved slug sequence changed at a known chapter', () => {
    const slugs = [...metadata.slugs];
    [slugs[0], slugs[1]] = [slugs[1], slugs[0]];

    expect(() => parseWhitepaper(minimalWhitepaper(), { ...metadata, slugs })).toThrow('locked slug mismatch at chapter 1');
  });

  it.each([
    ['date', ''],
    ['controllingLanguage', ''],
    ['status', ''],
    ['slugs', 'not-an-array'],
  ])('rejects malformed metadata field %s descriptively', (field, value) => {
    expect(() => parseWhitepaper(minimalWhitepaper(), { ...metadata, [field]: value } as unknown as WhitepaperMetadata)).toThrow(`metadata field ${field}`);
  });

  it('rejects an invalid publication date', () => {
    expect(() => parseWhitepaper(minimalWhitepaper(), { ...metadata, date: '2026-99-99' })).toThrow('metadata field date must be a valid YYYY-MM-DD date');
    expect(() => parseWhitepaper(minimalWhitepaper(), { ...metadata, date: '2026-02-31' })).toThrow('metadata field date must be a valid YYYY-MM-DD date');
  });

  it('rejects chapter 16 without a parseable allocation table', () => {
    const markdown = minimalWhitepaper().replace('| 배분 | 비율 | 수량 |\n|---|---:|---:|\n| 검증 | 100% | 10,000,000,000 |', '배분 표는 준비 중입니다.');

    expect(() => parseWhitepaper(markdown, metadata)).toThrow('chapter 16 token allocation table is missing or unparseable');
  });

  it('rejects an explicit/generated heading ID collision across chapters', () => {
    expect(() => parseWhitepaper(minimalWhitepaper('### Explicit {#shared}', '### shared'), metadata)).toThrow('chapter 2 has duplicate heading ID "shared"');
  });

  it('validates GFM reference, root-relative, fragment, and raw HTML links', () => {
    expect(() => parseWhitepaper(minimalWhitepaper('[missing][target]\n\n[target]: <docs/missing.md>'), metadata)).toThrow('broken repository-local link "docs/missing.md"');
    expect(() => parseWhitepaper(minimalWhitepaper('[missing](#not-a-heading)'), metadata)).toThrow('unknown document fragment "#not-a-heading"');
    expect(() => parseWhitepaper(minimalWhitepaper('### Known {#known}\n\n[missing](./IROA_WHITEPAPER_KO.md#not-a-heading)'), metadata)).toThrow('unknown document fragment "#not-a-heading"');
    expect(() => parseWhitepaper(minimalWhitepaper('[missing](/docs/missing.md)'), metadata)).toThrow('broken repository-local link "/docs/missing.md"');
    expect(() => parseWhitepaper(minimalWhitepaper('<a href="docs/missing.md">missing</a>'), metadata)).toThrow('broken repository-local link "docs/missing.md"');
  });

  it('uses parsed GFM and raw HTML image inventory for rewritten rendering', () => {
    const publication = parseWhitepaper(minimalWhitepaper('![mark][logo]\n\n[logo]: <../brand/iroa-symbol.svg>\n\n<img src="../brand/iroa-symbol.svg" alt="raw mark">'), metadata);

    expect(publication.chapters[0].html).toContain('/generated/docs/brand/iroa-symbol.svg');
    expect(publication.chapters[0].html).toContain('alt="raw mark"');
  });

  it('reports malformed percent encoding with the offending URL', () => {
    expect(() => parseWhitepaper(minimalWhitepaper('![bad](%E0%A4%A)'), metadata)).toThrow('invalid percent-encoding in URL/path "%E0%A4%A"');
  });

  it('rejects generated destination symlinks without touching the isolated external fixture', async () => {
    const root = await makeSyncFixture();
    const outside = path.join(root, 'outside');
    await mkdir(outside);
    await writeFile(path.join(outside, 'sentinel.txt'), 'do not modify');
    await mkdir(path.join(root, 'public'), { recursive: true });
    await symlink(outside, path.join(root, 'public/generated'));

    await expect(syncWhitepaperAssets({ projectRoot: root })).rejects.toThrow('generated destination ancestor is a symlink');
    await expect(readFile(path.join(outside, 'sentinel.txt'), 'utf8')).resolves.toBe('do not modify');
  });

  it('rejects symlinked intermediate destination parents without copying outside the fixture', async () => {
    const root = await makeSyncFixture();
    const outside = path.join(root, 'outside');
    await mkdir(outside);
    await writeFile(path.join(outside, 'sentinel.txt'), 'do not modify');
    await symlink(outside, path.join(root, 'public'));

    await expect(syncWhitepaperAssets({ projectRoot: root })).rejects.toThrow('generated destination ancestor is a symlink');
    await expect(readFile(path.join(outside, 'sentinel.txt'), 'utf8')).resolves.toBe('do not modify');
  });

  it('uses the same image inventory for the synchronizer output', async () => {
    const root = await makeSyncFixture();

    await expect(syncWhitepaperAssets({ projectRoot: root })).resolves.toMatchObject({ assetCount: 1 });
    await expect(readFile(path.join(root, 'public/generated/docs/brand/logo.png'), 'utf8')).resolves.toBe('fixture-image');
  });

  it('keeps the canonical metadata contract intact after the stricter validation', async () => {
    await expect(loadWhitepaper()).resolves.toMatchObject({ metadata: { slugs: [...LOCKED_WHITEPAPER_SLUGS] } });
  });
});
