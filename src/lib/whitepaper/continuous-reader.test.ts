import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_ROOT } from './assets';
import { prepareChapterHtml } from './render';
import type { WhitepaperChapter } from './types';

describe('continuous whitepaper reader document structure', () => {
  it('keeps the chapter navigation script inside SiteLayout', async () => {
    const source = await readFile(path.join(REPOSITORY_ROOT, 'src/layouts/WhitepaperLayout.astro'), 'utf8');
    const scriptStart = source.indexOf('<script is:inline>');
    const layoutClose = source.lastIndexOf('</SiteLayout>');

    expect(scriptStart).toBeGreaterThan(-1);
    expect(scriptStart).toBeLessThan(layoutClose);
  });

  it('realigns a direct chapter hash after web fonts settle', async () => {
    const source = await readFile(path.join(REPOSITORY_ROOT, 'src/layouts/WhitepaperLayout.astro'), 'utf8');

    expect(source).toContain('document.fonts.ready');
    expect(source).toContain("document.documentElement.style.scrollBehavior = 'auto'");
    expect(source).toContain("target.scrollIntoView({ block: 'start' })");
  });

  it('eagerly loads chapter images in the continuous document so anchors remain stable', () => {
    const chapter: WhitepaperChapter = {
      number: 1,
      slug: 'core-declaration',
      title: 'Core declaration',
      html: '<figure><img src="/diagram.png" alt="" width="1200" height="800" loading="lazy"></figure>',
      headings: [],
    };

    expect(prepareChapterHtml(chapter, { eagerImages: true })).not.toContain('loading="lazy"');
  });

  it('keeps the active chapter visible inside each chapter index', async () => {
    const source = await readFile(path.join(REPOSITORY_ROOT, 'src/layouts/WhitepaperLayout.astro'), 'utf8');

    expect(source).toContain('index.scrollTop = Math.max(0, link.offsetTop');
  });

  it('localizes the desktop chapter-index label with the publication', async () => {
    const source = await readFile(path.join(REPOSITORY_ROOT, 'src/layouts/WhitepaperLayout.astro'), 'utf8');

    expect(source).toContain('label={copy.index}');
  });
});
