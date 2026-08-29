import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hero = readFileSync('src/components/sections/HomeHero.astro', 'utf8');
const css = readFileSync('src/styles/pages.css', 'utf8');

describe('IROA homepage visual contracts', () => {
  it('keeps the semantic Network Atlas path alongside the hero artwork', () => {
    expect(hero).toContain("'Network Atlas execution path' : 'Network Atlas 실행 경로'");
    expect(hero).toContain("'Execution path stages' : '실행 경로 단계'");
    expect(hero).toContain("'Protocol planes' : '프로토콜 영역'");
  });

  it('lets generated section images derive their height from the rendered width', () => {
    const responsiveImages = css.match(
      /\.network-proof__visual img,\s*\.settlement-overview__visual img\s*\{([^}]+)\}/,
    );

    expect(responsiveImages?.[1]).toMatch(/block-size:\s*auto/);
  });
});
