import { expect, test } from '@playwright/test';

const navigationItems = [
  { label: '프로토콜', href: '/#protocol' },
  { label: '네트워크', href: '/#network' },
  { label: '이코노미', href: '/#economy' },
  { label: '백서', href: '/whitepaper' },
  { label: '로드맵', href: '/#roadmap' },
] as const;

test('serves the shared IROA site shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/IROA\.AI/);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'IROA.AI 홈', exact: true })).toBeVisible();

  const imageState = await page.locator('img').evaluateAll((images) => ({
    total: images.length,
    broken: images.filter(
      (image) =>
        !(image as HTMLImageElement).complete || (image as HTMLImageElement).naturalWidth === 0,
    ).length,
  }));
  expect(imageState.total).toBeGreaterThan(0);
  expect(imageState.broken).toBe(0);

  const primaryNavigation = page.getByRole('navigation', { name: '주요 메뉴' });
  await expect(primaryNavigation).toBeVisible();
  for (const item of navigationItems) {
    await expect(primaryNavigation.getByRole('link', { name: item.label, exact: true })).toHaveAttribute(
      'href',
      item.href,
    );
  }

  await expect(
    page.getByRole('banner').getByRole('link', { name: '웹 백서 읽기', exact: true }),
  ).toHaveAttribute('href', '/whitepaper');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: '현실 세계를 위한 검증 가능한 실행 네트워크.',
    }),
  ).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '본문으로 바로가기' })).toBeFocused();

  await expect(page.getByRole('contentinfo')).toBeVisible();
});

test.describe('mobile shell without client JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });

  test('keeps the disclosure navigation keyboard reachable', async ({ page }) => {
    await page.goto('/');

    const disclosure = page.locator('details.site-header__mobile-menu');
    const summary = disclosure.locator('summary');
    await expect(summary).toBeVisible();
    await summary.click();
    await expect(disclosure).toHaveAttribute('open', '');

    const mobileNavigation = page.getByRole('navigation', { name: '모바일 메뉴' });
    const firstLink = mobileNavigation.getByRole('link', { name: '프로토콜', exact: true });
    await expect(firstLink).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(firstLink).toBeFocused();

    for (const item of navigationItems) {
      await expect(
        mobileNavigation.getByRole('link', { name: item.label, exact: true }),
      ).toHaveAttribute('href', item.href);
    }
  });
});

test('applies the reduced-motion document treatment', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const motion = await page.evaluate(() => {
    const toMilliseconds = (duration: string) => {
      const value = Number.parseFloat(duration);
      return duration.endsWith('ms') ? value : value * 1000;
    };
    const documentStyle = getComputedStyle(document.documentElement);
    const transitionStyle = getComputedStyle(
      document.querySelector('.site-header__summary-chevron')!,
    );

    return {
      scrollBehavior: documentStyle.scrollBehavior,
      transitionMilliseconds: Math.max(
        ...transitionStyle.transitionDuration.split(',').map(toMilliseconds),
      ),
    };
  });

  expect(motion.scrollBehavior).toBe('auto');
  expect(motion.transitionMilliseconds).toBeLessThanOrEqual(0.01);
});

test('moves visible focus from the skip link to the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: '본문으로 바로가기' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('serves approved brand discovery icons with slot-correct link metadata', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="icon"][href="/favicon.ico"]')).toHaveAttribute(
    'sizes',
    '16x16 32x32 48x48',
  );
  await expect(page.locator('link[rel="icon"][href="/favicon.svg"]')).toHaveAttribute(
    'sizes',
    'any',
  );

  for (const asset of ['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png']) {
    const response = await request.get(asset);
    expect(response.status(), asset).toBe(200);
    expect((await response.body()).byteLength, asset).toBeGreaterThan(0);
  }
});
