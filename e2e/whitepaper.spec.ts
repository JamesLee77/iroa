import { readFile, stat } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';

const chapterSlugs = [
  'core-declaration', 'daily-journeys', 'problem-and-market', 'product-system',
  'safe-execution', 'mobile', 'watch', 'secure-execution-space', 'ai-kiosk',
  'service-architecture', 'ai-technology', 'privacy-and-safety',
  'health-and-wearables', 'data-contribution', 'reward-economy', 'token-economy',
  'business-model', 'roadmap', 'operations-and-accountability', 'risks',
  'prelaunch-validation', 'conclusion',
] as const;

function sitemapUrlsForWhitepaper(sitemap: string) {
  const whitepaperBase = 'https://iroa.ai/whitepaper';
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1])
    .filter((url) => url === whitepaperBase || url.startsWith(`${whitepaperBase}/`));
}

async function tabUntilFocused(page: Page, target: Locator, maximumTabs: number) {
  const traversedHrefs: Array<string | null> = [];
  for (let index = 0; index < maximumTabs; index += 1) {
    await page.keyboard.press('Tab');
    traversedHrefs.push(await page.evaluate(() => (
      document.activeElement instanceof HTMLAnchorElement
        ? document.activeElement.getAttribute('href')
        : null
    )));
    if (await target.evaluate((element) => element === document.activeElement)) {
      return traversedHrefs;
    }
  }
  throw new Error(`target did not receive keyboard focus after ${maximumTabs} Tab presses`);
}

async function expectVisibleKeyboardFocus(target: Locator) {
  await expect(target).toBeFocused();
  const focusStyle = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return {
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      visible: bounds.width > 0 && bounds.height > 0,
    };
  });
  expect(focusStyle.visible).toBe(true);
  expect(focusStyle.outlineStyle).not.toBe('none');
  expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(3);
  expect(focusStyle.outlineColor).not.toBe('rgba(0, 0, 0, 0)');
}

test('publishes the Korean master index with document control, 22 chapters, and a real PDF', async ({
  page,
  request,
}) => {
  await page.goto('/whitepaper');

  await expect(page.getByRole('heading', { level: 1, name: 'IROA.AI 백서' })).toHaveCount(1);
  const control = page.getByRole('region', { name: '백서 문서 정보' });
  await expect(control.getByText('v1.0', { exact: true })).toBeVisible();
  await expect(control.getByText('2026-08-21', { exact: true })).toBeVisible();
  await expect(control.getByText('한국어 원문', { exact: true })).toBeVisible();
  await expect(control.getByText('발행됨', { exact: true })).toBeVisible();
  await expect(
    control.getByText('한국어판이 이 문서의 기준본입니다.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('발행 상태는 이 문서 판본에만 적용됩니다.', { exact: true }),
  ).toBeVisible();

  const chapterNavigation = page.getByRole('navigation', { name: '전체 목차', exact: true });
  const chapterLinks = chapterNavigation.getByRole('link');
  await expect(chapterLinks).toHaveCount(22);
  await expect(chapterLinks.first()).toHaveAttribute('href', '#chapter-core-declaration');
  await expect(chapterLinks.last()).toHaveAttribute('href', '#chapter-conclusion');

  const download = control.getByRole('link', { name: /PDF 다운로드/ });
  await expect(download).toHaveAttribute('download', 'IROA_WHITEPAPER_KO.pdf');
  await expect(download).toContainText(/^PDF · \d+(?:\.\d)? MB$/);
  const pdfHref = await download.getAttribute('href');
  expect(pdfHref).toBeTruthy();
  const pdf = await request.get(pdfHref!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  const pdfBytes = await pdf.body();
  expect(pdfBytes.byteLength).toBeGreaterThan(1_000_000);
  expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-');

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://iroa.ai/whitepaper',
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');
});

test('renders chapter 1 with exact heading hierarchy and next navigation', async ({ page }) => {
  await page.goto('/whitepaper/core-declaration');

  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h2')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: 'IROA.AI 백서' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '1. 핵심 선언' })).toBeVisible();
  await expect(page.getByRole('article', { name: '핵심 선언', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /다음 장:.*사용자의 하루로 보는 IROA/ })).toHaveAttribute(
    'href',
    '/whitepaper/daily-journeys',
  );
});

test('renders the token supply and accessible allocation table from the canonical publication', async ({
  page,
}) => {
  await page.goto('/whitepaper/token-economy');

  const article = page.getByRole('article', { name: 'IROA 토큰 이코노미' });
  await expect(article.getByText('10,000,000,000 IROA', { exact: true })).toBeVisible();
  const allocationTable = article.getByRole('table').filter({ hasText: 'NODE 구축·운영 보상' });
  await expect(allocationTable).toBeVisible();
  await expect(allocationTable.getByRole('columnheader', { name: '배분' })).toBeVisible();
  await expect(allocationTable.getByRole('cell', { name: '2,500,000,000' })).toBeVisible();
});

test('ends the publication with previous navigation and no next link', async ({ page }) => {
  await page.goto('/whitepaper/conclusion');

  await expect(page.getByRole('link', { name: /이전 장:.*공개 전 검증과 다음 결정/ })).toHaveAttribute(
    'href',
    '/whitepaper/prelaunch-validation',
  );
  await expect(page.getByRole('link', { name: /다음 장:/ })).toHaveCount(0);
});

test('preserves a direct chapter refresh, title, and stable heading self-link target', async ({ page }) => {
  const response = await page.goto('/whitepaper/core-declaration');
  expect(response?.status()).toBe(200);
  const title = await page.title();
  expect(title).toContain('핵심 선언');

  const firstHeading = page.getByRole('article', { name: '핵심 선언' }).locator('h3[id]').first();
  const headingId = await firstHeading.getAttribute('id');
  expect(headingId).toBeTruthy();
  await expect(
    page.getByRole('article', { name: '핵심 선언' }).getByRole('link', { name: /1\.1 미션 제목 링크/ }),
  ).toHaveAttribute(
    'href',
    `#${headingId}`,
  );

  await page.goto(`/whitepaper/core-declaration#${headingId}`);
  const refreshed = await page.reload();
  expect(refreshed?.status()).toBe(200);
  await expect(page).toHaveTitle(title);
  await expect(page.locator(`h3[id="${headingId}"]`)).toBeVisible();
});

test('serves the branded 404 for an unknown whitepaper chapter', async ({ page }) => {
  const response = await page.goto('/whitepaper/unknown-chapter');

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { level: 1, name: '페이지를 찾을 수 없습니다.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: '홈으로', exact: true })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: '웹 백서 목차', exact: true })).toHaveAttribute(
    'href',
    '/whitepaper',
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex,nofollow',
  );

  const recoveryIndex = page.getByRole('navigation', { name: '백서 전체 목차' });
  const recoveryLinks = recoveryIndex.getByRole('link');
  await expect(recoveryLinks).toHaveCount(22);
  const recoveryHrefs = await recoveryLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')),
  );
  expect(recoveryHrefs).toEqual(chapterSlugs.map((slug) => `/whitepaper/${slug}`));
});

test('serializes every public whitepaper canonical as the same slashless sitemap URL', async ({
  request,
}) => {
  const routes = ['/whitepaper', ...chapterSlugs.map((slug) => `/whitepaper/${slug}`)];
  const canonicalUrls: string[] = [];

  for (const route of routes) {
    const response = await request.get(route);
    expect(response.status()).toBe(200);
    const html = await response.text();
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    expect(canonical).toBe(`https://iroa.ai${route}`);
    canonicalUrls.push(canonical!);
  }

  const sitemapResponse = await request.get('/sitemap-0.xml');
  expect(sitemapResponse.status()).toBe(200);
  const sitemap = await sitemapResponse.text();
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const whitepaperSitemapUrls = sitemapUrlsForWhitepaper(sitemap);
  expect(sitemapUrls).toContain('https://iroa.ai/');
  expect(whitepaperSitemapUrls.toSorted()).toEqual(canonicalUrls.toSorted());
  expect(whitepaperSitemapUrls.every((url) => !url.endsWith('/')))
    .toBe(true);
});

test('sitemap parity permits unrelated approved public routes without hiding whitepaper defects', () => {
  const expectedWhitepaperUrls = [
    'https://iroa.ai/whitepaper',
    'https://iroa.ai/whitepaper/core-declaration',
  ];
  const sitemapWithApprovedProtocolRoute = `
    <urlset>
      <url><loc>https://iroa.ai/</loc></url>
      <url><loc>https://iroa.ai/protocol</loc></url>
      <url><loc>https://iroa.ai/whitepaper</loc></url>
      <url><loc>https://iroa.ai/whitepaper/core-declaration</loc></url>
    </urlset>
  `;

  expect(sitemapUrlsForWhitepaper(sitemapWithApprovedProtocolRoute).toSorted())
    .toEqual(expectedWhitepaperUrls);
  expect(sitemapUrlsForWhitepaper(
    sitemapWithApprovedProtocolRoute.replace(
      '</urlset>',
      '<url><loc>https://iroa.ai/whitepaper/rogue</loc></url></urlset>',
    ),
  ).toSorted()).not.toEqual(expectedWhitepaperUrls);
  expect(sitemapUrlsForWhitepaper(
    sitemapWithApprovedProtocolRoute.replace(
      '<url><loc>https://iroa.ai/whitepaper/core-declaration</loc></url>',
      '',
    ),
  ).toSorted()).not.toEqual(expectedWhitepaperUrls);
  expect(sitemapUrlsForWhitepaper(
    sitemapWithApprovedProtocolRoute.replace(
      'https://iroa.ai/whitepaper/core-declaration',
      'https://iroa.ai/whitepaper/core-declaration/',
    ),
  ).toSorted()).not.toEqual(expectedWhitepaperUrls);
});

test('gives every table and scroll region a unique section-derived accessible name', async ({ page }) => {
  for (const slug of chapterSlugs) {
    await page.goto(`/whitepaper/${slug}`);
    const tables = page.locator('.whitepaper-prose table');
    const regions = page.locator('.whitepaper-table-scroll');
    const tableNames = await tables.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('aria-label')),
    );
    const regionNames = await regions.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('aria-label')),
    );

    expect(regionNames).toHaveLength(tableNames.length);
    const allNames = [...tableNames, ...regionNames];
    expect(allNames.every((name) => name && !name.includes('백서 데이터 표'))).toBe(true);
    expect(new Set(allNames).size).toBe(allNames.length);
  }

  await page.goto('/whitepaper/token-economy');
  await expect(page.getByRole('table', { name: '16.2 토큰 배분 표' })).toBeVisible();
  await expect(page.getByRole('table', { name: '16.3 초기 유통과 잠금 해제 표' })).toBeVisible();
  await expect(page.getByRole('table', { name: '16.7 시뮬레이션 검증 결과 표' })).toBeVisible();
  await expect(page.getByRole('region', { name: '16.2 토큰 배분 표 스크롤 영역' })).toBeVisible();
});

test('ships portable visual QA evidence with repository-relative image links', async () => {
  const evidenceRoot = new URL('../docs/website/evidence/task-8-whitepaper/', import.meta.url);
  const qa = await readFile(new URL('QA.md', evidenceRoot), 'utf8');
  const imageNames = [
    'reference-whitepaper-crop.png',
    'comparison-whitepaper-desktop.png',
    'comparison-whitepaper-mobile.png',
  ];

  expect(qa).toContain('final result: passed');
  expect(qa).not.toContain('/Users/');
  expect(qa).not.toContain('.superpowers/');
  for (const imageName of imageNames) {
    expect(qa).toContain(`./images/${imageName}`);
    const imageUrl = new URL(`images/${imageName}`, evidenceRoot);
    const [metadata, bytes] = await Promise.all([stat(imageUrl), readFile(imageUrl)]);
    expect(metadata.size).toBeGreaterThan(10_000);
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  }
});

test('loads every canonical local whitepaper image with nonzero natural width', async ({ page }) => {
  test.setTimeout(60_000);
  const imageSources = new Set<string>();
  let imageCount = 0;

  for (const route of ['/whitepaper', ...chapterSlugs.map((slug) => `/whitepaper/${slug}`)]) {
    await page.goto(route);
    const images = page.locator('.whitepaper-prose img');
    imageCount += await images.count();
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      const source = await image.getAttribute('src');
      expect(source).toBeTruthy();
      imageSources.add(source!);
      await expect.poll(
        () => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
        { message: `broken whitepaper image at ${route}` },
      ).toBe(true);
    }
  }

  expect(imageSources.size).toBe(11);
  expect(imageCount).toBe(21);
});

test.describe('mobile reader without client JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });

  test('keeps the native chapter disclosure and anchor navigation usable', async ({ page }) => {
    await page.goto('/whitepaper/core-declaration');

    const disclosure = page.locator('details.whitepaper-mobile-index');
    await expect(disclosure.locator('summary')).toBeVisible();
    await disclosure.locator('summary').click();
    await expect(disclosure).toHaveAttribute('open', '');
    await expect(
      disclosure.getByRole('link', { name: /02.*사용자의 하루로 보는 IROA/ }),
    ).toHaveAttribute('href', '/whitepaper/daily-journeys');

    const localNavigation = page.getByRole('navigation', { name: '이 장의 목차' });
    const firstAnchor = localNavigation.getByRole('link').first();
    await expect(firstAnchor).toHaveAttribute('href', /^#/);
    const target = await firstAnchor.getAttribute('href');
    expect(target).toBeTruthy();
    await firstAnchor.click();
    await expect(page.locator(`[id="${target!.slice(1)}"]`)).toBeVisible();
  });
});

test('keeps Korean chapter-title words intact at the mobile breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.goto('/whitepaper/token-economy');

  const tokenWordLineCount = await page.locator('#whitepaper-chapter-title').evaluate((heading) => {
    const node = heading.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) throw new Error('chapter title text node is missing');
    const text = node.textContent ?? '';
    const start = text.indexOf('토큰');
    if (start === -1) throw new Error('token title word is missing');
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + '토큰'.length);
    return range.getClientRects().length;
  });

  expect(tokenWordLineCount).toBe(1);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`keeps the reader, images, and tables inside the ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/whitepaper/token-economy');

    const geometry = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      wideContent: Array.from(document.querySelectorAll('.whitepaper-prose img, .whitepaper-table-scroll'))
        .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
        .length,
    }));
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.wideContent).toBe(0);
  });
}

test('keeps article and chapter controls visible at a 200 percent zoom-equivalent width', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto('/whitepaper/token-economy');

  await expect(page.getByRole('article', { name: 'IROA 토큰 이코노미' })).toBeVisible();
  await expect(page.getByRole('link', { name: /이전 장:/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /다음 장:/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(720);
});

test.describe('no-JavaScript whitepaper discovery', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });

  test('keeps chapter links, canonical text, and PDF download usable', async ({ page }) => {
    await page.goto('/whitepaper');
    await expect(page.getByRole('heading', { level: 1, name: 'IROA.AI 백서' })).toBeVisible();
    const disclosure = page.locator('details.whitepaper-mobile-index');
    await disclosure.locator('summary').click();
    await expect(
      page.getByRole('navigation', { name: '모바일 백서 전체 목차' }).getByRole('link'),
    ).toHaveCount(22);
    await expect(
      page.getByRole('region', { name: '백서 문서 정보' }).getByRole('link', { name: /^PDF 다운로드/ }),
    ).toHaveAttribute('download', 'IROA_WHITEPAPER_KO.pdf');

    await page.goto('/whitepaper/core-declaration');
    await expect(page.getByRole('article', { name: '핵심 선언' })).toBeVisible();
    await expect(page.getByRole('link', { name: /다음 장:/ })).toHaveAttribute('href', '/whitepaper/daily-journeys');
  });
});

test.describe('keyboard-only whitepaper navigation without client JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });

  test('traverses the no-JavaScript chapter index and pager by keyboard', async ({ page }) => {
    await page.goto('/whitepaper/token-economy');

    const chapterIndex = page.getByRole('navigation', { name: '전체 목차', exact: true });
    const chapterLinks = chapterIndex.getByRole('link');
    const firstChapter = chapterLinks.first();
    const secondChapter = chapterLinks.nth(1);

    await tabUntilFocused(page, firstChapter, 20);
    await expectVisibleKeyboardFocus(firstChapter);
    await page.keyboard.press('Tab');
    await expectVisibleKeyboardFocus(secondChapter);

    const previousChapter = page.getByRole('link', { name: '이전 장: 보상 경제', exact: true });
    const nextChapter = page.getByRole('link', { name: '다음 장: 사업모델', exact: true });
    const traversedToPager = await tabUntilFocused(page, previousChapter, 80);
    expect(traversedToPager).toContain('/whitepaper/conclusion');
    expect(traversedToPager.at(-1)).toBe('/whitepaper/reward-economy');
    await expectVisibleKeyboardFocus(previousChapter);

    await page.keyboard.press('Tab');
    await expectVisibleKeyboardFocus(nextChapter);
  });
});
