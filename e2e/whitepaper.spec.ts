import { expect, test } from '@playwright/test';

const chapterSlugs = [
  'core-declaration', 'daily-journeys', 'problem-and-market', 'product-system',
  'safe-execution', 'mobile', 'watch', 'secure-execution-space', 'ai-kiosk',
  'service-architecture', 'ai-technology', 'privacy-and-safety',
  'health-and-wearables', 'data-contribution', 'reward-economy', 'token-economy',
  'business-model', 'roadmap', 'operations-and-accountability', 'risks',
  'prelaunch-validation', 'conclusion',
] as const;

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

  const chapterNavigation = page.getByRole('navigation', { name: '백서 전체 목차' });
  const chapterLinks = chapterNavigation.getByRole('link');
  await expect(chapterLinks).toHaveCount(22);
  await expect(chapterLinks.first()).toHaveAttribute('href', '/whitepaper/core-declaration');
  await expect(chapterLinks.last()).toHaveAttribute('href', '/whitepaper/conclusion');

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
});

test('loads every canonical local whitepaper image with nonzero natural width', async ({ page }) => {
  test.setTimeout(60_000);
  let imageCount = 0;

  for (const route of ['/whitepaper', ...chapterSlugs.map((slug) => `/whitepaper/${slug}`)]) {
    await page.goto(route);
    const images = page.locator('.whitepaper-prose img');
    imageCount += await images.count();
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(
        () => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
        { message: `broken whitepaper image at ${route}` },
      ).toBe(true);
    }
  }

  expect(imageCount).toBe(11);
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
