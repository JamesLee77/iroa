import { describe, expect, it } from 'vitest';
import { parseWhitepaper } from './load';
import { LOCKED_WHITEPAPER_SLUGS, type WhitepaperMetadata } from './types';

const metadata: WhitepaperMetadata = {
  title: 'IROA.AI 백서', version: '1.0', date: '2026-08-21', language: 'ko-KR',
  controllingLanguage: 'Korean', status: 'published',
  pdfPath: 'docs/whitepaper/exports/IROA_WHITEPAPER_KO.pdf', slugs: [...LOCKED_WHITEPAPER_SLUGS],
};

function chapters() {
  return LOCKED_WHITEPAPER_SLUGS.map((_, index) => {
    const body = index === 15 ? '| 배분 | 비율 | 수량 |\n|---|---:|---:|\n| 검증 | 100% | 10,000,000,000 |' : '';
    return `## ${index + 1}. Chapter ${index + 1}${body ? `\n\n${body}` : ''}`;
  }).join('\n\n');
}

describe('Task 7 fix round 3 preamble anchors', () => {
  it('keeps H1 and H2 from consuming a lower-heading anchor', () => {
    const markdown = '# Document title\n\n## Document subtitle\n\n### Preamble detail {#preamble-detail}\n\n[Jump to detail](#preamble-detail)\n\n' + chapters();
    const publication = parseWhitepaper(markdown, metadata);

    expect(publication.preambleHtml).toContain('<h1>Document title</h1>');
    expect(publication.preambleHtml).toContain('<h2>Document subtitle</h2>');
    expect(publication.preambleHtml).not.toContain('<h1 id="preamble-detail"');
    expect(publication.preambleHtml).not.toContain('<h2 id="preamble-detail"');
    expect(publication.preambleHtml).toContain('<h3 id="preamble-detail">Preamble detail</h3>');
    expect(publication.preambleHtml).toContain('<a href="#preamble-detail">Jump to detail</a>');
  });
});
