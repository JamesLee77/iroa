import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { imageSize } from 'image-size';

const representativeRoutes = ['/', '/whitepaper', '/whitepaper/token-economy', '/node', '/design-system'] as const;

for (const route of representativeRoutes) {
  test(`${route} has no serious or critical WCAG 2.2 AA violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(
      results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical'),
    ).toEqual([]);
  });
}

test('renders the internal design-system inventory from production components', async ({ page }) => {
  const response = await page.goto('/design-system');
  expect(response?.status()).toBe(200);

  for (const heading of ['Foundations', 'Primitives', 'Status', 'Protocol Patterns', 'Whitepaper Reader']) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }

  const actions = page.locator('.design-system-actions');
  for (const variant of ['primary', 'secondary', 'quiet']) {
    await expect(actions.locator(`[data-variant="${variant}"]`)).toHaveCount(1);
  }

  const statuses = page.locator('.design-system-statuses .status-badge');
  await expect(statuses).toHaveCount(5);
  for (const label of ['현재', '다음', '계획', '검증 중', '장기 연구']) {
    await expect(statuses.getByText(label, { exact: true })).toBeVisible();
  }

  await expect(page.getByRole('region', { name: 'IROA 프로토콜 경로' })).toBeVisible();
  await expect(page.getByRole('region', { name: '백서 문서 정보' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
});

test('publishes unique metadata and absolute share discovery on representative routes', async ({ page }) => {
  const routes = ['/', '/whitepaper', '/whitepaper/token-economy', '/node', '/en/node', '/design-system', '/404.html'];
  const titles = new Set<string>();

  for (const route of routes) {
    await page.goto(route);
    const title = await page.title();
    expect(title.trim()).not.toBe('');
    expect(titles.has(title), `duplicate title at ${route}: ${title}`).toBe(false);
    titles.add(title);

    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/iroa\.ai\//);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://iroa.ai/og/iroa-network-atlas.png',
    );
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
  }
});

test('emits robots, sitemap, recovery, favicon, and the approved 1200 by 630 share image', async ({ request }) => {
  const repositoryRoot = process.cwd();
  const requiredBuildFiles = [
    'dist/robots.txt',
    'dist/sitemap-index.xml',
    'dist/sitemap-0.xml',
    'dist/404.html',
    'dist/favicon.ico',
    'dist/favicon.svg',
    'dist/apple-touch-icon.png',
  ];

  for (const relativePath of requiredBuildFiles) {
    const metadata = await stat(path.join(repositoryRoot, relativePath));
    expect(metadata.isFile(), `${relativePath} must be a file`).toBe(true);
    expect(metadata.size, `${relativePath} must be nonempty`).toBeGreaterThan(0);
  }

  const robots = await readFile(path.join(repositoryRoot, 'dist/robots.txt'), 'utf8');
  expect(robots).toContain('Sitemap: https://iroa.ai/sitemap-index.xml');

  const sitemap = await readFile(path.join(repositoryRoot, 'dist/sitemap-0.xml'), 'utf8');
  expect(sitemap).not.toContain('/design-system');
  for (const match of sitemap.matchAll(/<loc>https:\/\/iroa\.ai(\/[^<]*)<\/loc>/g)) {
    const route = match[1] === '/' ? '/' : match[1];
    const response = await request.get(route);
    expect(response.status(), `missing sitemap route ${route}`).toBe(200);
  }

  const ogBytes = await readFile(path.join(repositoryRoot, 'dist/og/iroa-network-atlas.png'));
  expect(imageSize(ogBytes)).toMatchObject({ width: 1200, height: 630, type: 'png' });
});

test('removes nonessential motion for reduced-motion users', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/design-system');

  const motion = await page.evaluate(() => {
    const toMilliseconds = (duration: string) => {
      const value = Number.parseFloat(duration);
      return duration.endsWith('ms') ? value : value * 1000;
    };
    const durations = Array.from(document.querySelectorAll('*')).flatMap((element) => {
      const style = getComputedStyle(element);
      return [...style.animationDuration.split(','), ...style.transitionDuration.split(',')]
        .map((duration) => toMilliseconds(duration.trim()))
        .filter(Number.isFinite);
    });
    return {
      maxDuration: Math.max(0, ...durations),
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    };
  });

  expect(motion.scrollBehavior).toBe('auto');
  expect(motion.maxDuration).toBeLessThanOrEqual(0.01);
});
