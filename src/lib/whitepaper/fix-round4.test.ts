import { describe, expect, it } from 'vitest';
import { parseWhitepaper } from './load';
import { LOCKED_WHITEPAPER_SLUGS, type WhitepaperMetadata } from './types';

const metadata: WhitepaperMetadata = {
  title: 'IROA.AI 백서', version: '1.0', date: '2026-08-21', language: 'ko-KR',
  controllingLanguage: 'Korean', status: 'published',
  pdfPath: 'docs/whitepaper/exports/IROA_WHITEPAPER_KO.pdf', slugs: [...LOCKED_WHITEPAPER_SLUGS],
};

function minimalWhitepaper(firstChapterBody = '') {
  return LOCKED_WHITEPAPER_SLUGS.map((_, index) => {
    const body = index === 0 ? firstChapterBody : index === 15
      ? '| 배분 | 비율 | 수량 |\n|---|---:|---:|\n| 검증 | 100% | 10,000,000,000 |' : '';
    return `## ${index + 1}. Chapter ${index + 1}${body ? `\n\n${body}` : ''}`;
  }).join('\n\n');
}

describe('Task 7 fix round 4 Marked heading inventory', () => {
  it('does not collect or render fenced ### text as a heading', () => {
    const publication = parseWhitepaper(minimalWhitepaper('```md\n### Not a heading {#fenced}\n```\n\n   ### Indented heading {#indented}\n\n[Jump](#indented)'), metadata);

    expect(publication.chapters[0].headings).toEqual([{ level: 3, id: 'indented', title: 'Indented heading' }]);
    expect(publication.chapters[0].html).not.toContain('id="fenced"');
    expect(publication.chapters[0].html).toContain('### Not a heading {#fenced}');
    expect(publication.chapters[0].html).toContain('<h3 id="indented">Indented heading</h3>');
  });

  it('collects and renders a blockquoted lower heading with its fragment target', () => {
    const publication = parseWhitepaper(minimalWhitepaper('> ### Quoted heading {#quoted}\n>\n> [Jump](#quoted)'), metadata);

    expect(publication.chapters[0].headings).toEqual([{ level: 3, id: 'quoted', title: 'Quoted heading' }]);
    expect(publication.chapters[0].html).toContain('<h3 id="quoted">Quoted heading</h3>');
    expect(publication.chapters[0].html).toContain('<a href="#quoted">Jump</a>');
  });
});
