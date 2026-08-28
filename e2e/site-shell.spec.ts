import { expect, test } from '@playwright/test';

test('serves the new static IROA shell', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/IROA\.AI/);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: '현실 세계를 위한 검증 가능한 실행 네트워크.',
    }),
  ).toBeVisible();
});
