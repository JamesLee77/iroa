import { expect, test } from '@playwright/test';

const stageLabels = [
  'Request',
  'Task Capsule',
  'Verified Node',
  'Proof Receipt',
  'Base Settlement',
] as const;

const sectionIds = [
  'top',
  'protocol',
  'network',
  'economy',
  'whitepaper-entry',
  'roadmap',
  'contact',
] as const;

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
}

test('composes the complete Network Atlas homepage with truthful actions and statuses', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: '현실 세계를 위한 검증 가능한 실행 네트워크.',
    }),
  ).toBeVisible();

  for (const plane of [
    'Interaction Plane',
    'Control Plane',
    'Execution Plane',
    'Settlement Plane',
  ]) {
    await expect(page.getByRole('heading', { level: 3, name: plane, exact: true })).toBeVisible();
  }

  const hero = page.locator('#top');
  await expect(hero.getByRole('link', { name: '네트워크 살펴보기', exact: true })).toHaveCount(1);
  await expect(hero.getByRole('link', { name: '웹 백서 읽기', exact: true })).toHaveCount(1);
  await expect(page.locator('#top').getByText('Base Primary Network', { exact: true })).toBeVisible();
  await expect(page.locator('#top').getByText('Native USDC Settlement', { exact: true })).toBeVisible();
  await expect(page.locator('#top').getByText('Personal Data Off-chain', { exact: true })).toBeVisible();
  await expect(page.locator('#top').getByText('IROA Rewards · 검증 중', { exact: true })).toBeVisible();

  for (const id of sectionIds) {
    await expect(page.locator(`#${id}`), `missing homepage section #${id}`).toHaveCount(1);
  }

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /\/og\/iroa-network-atlas\.png$/,
  );
});

test('keeps institutional contact honest until an approved channel exists', async ({ page }) => {
  await page.goto('/');

  const contact = page.locator('#contact');
  await expect(contact.getByText('공식 문의 채널 준비 중', { exact: true })).toBeVisible();
  await expect(contact.getByRole('link', { name: '웹 백서 읽기', exact: true })).toHaveAttribute(
    'href',
    '/whitepaper',
  );
  await expect(contact.locator('form')).toHaveCount(0);
  await expect(contact.locator('a[href^="mailto:"]')).toHaveCount(0);
  await expect(contact.getByRole('button')).toHaveCount(0);
});

test('exposes the ordered IROA protocol path and its truthful public boundaries', async ({
  page,
}) => {
  await page.goto('/');

  const protocol = page.getByRole('region', { name: 'IROA 프로토콜 경로' });
  await expect(protocol).toBeVisible();

  const stages = protocol.getByRole('list').first().getByRole('listitem');
  await expect(stages).toHaveCount(stageLabels.length);
  for (const [index, label] of stageLabels.entries()) {
    await expect(stages.nth(index).getByText(label, { exact: true })).toBeVisible();
  }

  await expect(protocol.getByText('N2 Node', { exact: true })).toBeVisible();
  await expect(protocol.getByText('Proof Receipt', { exact: true }).last()).toBeVisible();
  await expect(protocol.getByText('Base', { exact: true })).toBeVisible();
  await expect(protocol.getByText('Circle Native USDC', { exact: true })).toBeVisible();
  await expect(page.getByText('개인정보 원문은 오프체인에 머뭅니다.', { exact: true })).toBeVisible();
});

test('keeps every desktop protocol detail inside the Network Atlas surface', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  const geometry = await page.locator('.protocol-path').evaluate((protocol) => {
    const surface = protocol.getBoundingClientRect();
    const details = Array.from(protocol.querySelectorAll('.protocol-pattern')).map((detail) => {
      const bounds = detail.getBoundingClientRect();
      return {
        label: detail.getAttribute('aria-label'),
        bottom: Math.round(bounds.bottom),
        surfaceBottom: Math.round(surface.bottom),
      };
    });

    return details;
  });

  expect(
    geometry.every(({ bottom, surfaceBottom }) => bottom <= surfaceBottom + 1),
    JSON.stringify(geometry),
  ).toBe(true);
});

test('desktop protocol navigation clears the sticky header without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  await page
    .getByRole('navigation', { name: '주요 메뉴' })
    .getByRole('link', { name: '프로토콜', exact: true })
    .click();

  const protocol = page.getByRole('region', { name: 'IROA 프로토콜 경로' });
  await expect(protocol).toBeInViewport();
  await expect.poll(async () =>
    page.evaluate(() => {
      const header = document.querySelector('.site-header')!.getBoundingClientRect();
      const heading = document.querySelector('#protocol h2')!.getBoundingClientRect();
      return heading.top >= header.bottom;
    }),
  ).toBe(true);
  await expectNoHorizontalOverflow(page);
});

for (const width of [375, 768, 1024]) {
  test(`protocol sample reflows without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expectNoHorizontalOverflow(page);
  });
}
