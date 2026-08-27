import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const screenshotDirectory = resolve('.superpowers/tmp/iroa-homepage-v1');

function prepareScreenshots() {
  mkdirSync(screenshotDirectory, { recursive: true });
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const hasNoOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(hasNoOverflow).toBe(true);
}

async function waitForScrollToSettle(page: import('@playwright/test').Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let previousY = window.scrollY;
        let stableFrames = 0;

        const check = () => {
          const currentY = window.scrollY;
          stableFrames = Math.abs(currentY - previousY) < 0.5 ? stableFrames + 1 : 0;
          previousY = currentY;

          if (stableFrames >= 5) {
            resolve();
            return;
          }

          requestAnimationFrame(check);
        };

        requestAnimationFrame(check);
      }),
  );
}

async function expectHorizontalConnectorsTouch(
  page: import('@playwright/test').Page,
  itemSelector: string,
  connectorSelector: string,
) {
  const connections = await page.evaluate(
    ({ itemSelector, connectorSelector }) => {
      const items = Array.from(document.querySelectorAll(itemSelector));
      return items.slice(0, -1).map((item, index) => {
        const current = item.getBoundingClientRect();
        const connector = item.querySelector(connectorSelector)!.getBoundingClientRect();
        const next = items[index + 1].getBoundingClientRect();
        return {
          startGap: connector.left - current.right,
          endGap: next.left - connector.right,
        };
      });
    },
    { itemSelector, connectorSelector },
  );

  expect(
    connections.every(
      ({ startGap, endGap }) =>
        startGap >= -1.1 && startGap <= 0.1 && endGap >= -1.1 && endGap <= 0.1,
    ),
    JSON.stringify(connections),
  ).toBe(true);
}

async function expectSectionHeadingBelowHeader(
  page: import('@playwright/test').Page,
  sectionSelector: string,
) {
  await expect(page.locator(`${sectionSelector} h2`)).toBeInViewport();
  const geometry = await page.evaluate((selector) => {
    const header = document.querySelector('.site-header')!.getBoundingClientRect();
    const heading = document.querySelector(`${selector} h2`)!.getBoundingClientRect();
    return { headerBottom: header.bottom, headingTop: heading.top };
  }, sectionSelector);

  expect(geometry.headingTop).toBeGreaterThanOrEqual(geometry.headerBottom);
}

test('desktop navigation reaches connected sections and assets load', async ({ page }) => {
  prepareScreenshots();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(screenshotDirectory, 'viewport-top-1440.png') });
  await page.getByRole('link', { name: '작동 방식', exact: true }).click();
  await waitForScrollToSettle(page);

  await expect(page.locator('#how-it-works')).toBeInViewport();
  await expectSectionHeadingBelowHeader(page, '#how-it-works');
  await expectNoHorizontalOverflow(page);

  const brokenImages = await page.locator('img').evaluateAll((images) =>
    images.filter((image) => !(image as HTMLImageElement).complete || (image as HTMLImageElement).naturalWidth === 0).length,
  );
  expect(brokenImages).toBe(0);

  const heroGeometry = await page.evaluate(() => {
    const image = document.querySelector('.hero__image-frame')!.getBoundingClientRect();
    const card = document.querySelector('.hero__completion-card')!.getBoundingClientRect();
    return { imageBottom: image.bottom, cardTop: card.top };
  });
  expect(heroGeometry.cardTop).toBeGreaterThanOrEqual(heroGeometry.imageBottom);
  await expectHorizontalConnectorsTouch(page, '.flow > .flow__step', '.flow__connector');
  await expectHorizontalConnectorsTouch(page, '.institution-flow > li', '.institution-flow__connector');
  await expectHorizontalConnectorsTouch(page, '.settlement-flow > li', '.settlement-flow__connector');
  await page.screenshot({ path: resolve(screenshotDirectory, 'viewport-flow-1440.png') });

  await page.getByRole('link', { name: '생태계', exact: true }).click();
  await waitForScrollToSettle(page);
  await expectSectionHeadingBelowHeader(page, '#ecosystem');
  await page.screenshot({ path: resolve(screenshotDirectory, 'viewport-ecosystem-1440.png') });

  await page.getByRole('link', { name: '네트워크', exact: true }).click();
  await waitForScrollToSettle(page);
  await expectSectionHeadingBelowHeader(page, '#network');
  await page.screenshot({ path: resolve(screenshotDirectory, 'viewport-network-1440.png') });

  await page.screenshot({
    path: resolve(screenshotDirectory, 'home-1440.png'),
    fullPage: true,
  });
});

test('mobile menu reaches safety without horizontal overflow', async ({ page }) => {
  prepareScreenshots();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(screenshotDirectory, 'viewport-top-375.png') });
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await expect(page.getByRole('button', { name: '메뉴 닫기' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('navigation', { name: '모바일 메뉴' }).getByRole('link', { name: '안전과 신뢰' }).click();
  await waitForScrollToSettle(page);

  await expect(page.locator('#safety')).toBeInViewport();
  await expectSectionHeadingBelowHeader(page, '#safety');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: resolve(screenshotDirectory, 'viewport-safety-375.png') });
  await page.screenshot({
    path: resolve(screenshotDirectory, 'home-375.png'),
    fullPage: true,
  });
});

for (const width of [768, 1024]) {
  test(`homepage reflows without overflow at ${width}px`, async ({ page }) => {
    prepareScreenshots();
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: resolve(screenshotDirectory, `home-${width}.png`),
      fullPage: true,
    });
  });
}

test('reduced-motion preference is respected by the document', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(
    await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
  ).toBe(true);
});
