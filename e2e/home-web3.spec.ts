import { expect, test } from '@playwright/test';

const stageLabels = [
  'Request',
  'Task Capsule',
  'Verified Node',
  'Proof Receipt',
  'Base Settlement',
] as const;

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
