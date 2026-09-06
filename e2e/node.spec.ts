import { expect, test } from '@playwright/test';

test('publishes the NODE network page with the whitepaper trust levels and no live figures', async ({ page }) => {
  await page.goto('/node');

  await expect(page).toHaveTitle('IROA.AI | NODE 네트워크');
  await expect(page.getByRole('heading', { level: 1, name: 'NODE는 요청별로 검증되는 실행 공간입니다.' })).toBeVisible();

  const contents = page.getByRole('navigation', { name: 'NODE 페이지 목차' });
  await expect(contents.getByRole('link')).toHaveCount(9);

  const table = page.getByRole('table');
  await expect(table.getByRole('rowheader')).toHaveCount(5);
  await expect(table.getByRole('rowheader').first()).toContainText('N0 공개 연산');
  await expect(table.getByRole('rowheader').last()).toContainText('N4 개인 승인');

  // No deployment manifest is published, so the network state shows only its structure.
  const state = page.locator('#network-state');
  await expect(state.getByText('배포 전', { exact: true })).toBeVisible();
  await expect(state.locator('[data-value="pending"]')).toHaveCount(5);
  await expect(state.locator('a[href*="basescan.org"]')).toHaveCount(0);

  await expect(page.locator('#rewards .node-rewards__share')).toHaveText('25%');
  await expect(page.getByRole('img', { name: 'NODE 수 증가에 따른 평균 토큰 보상 희석 그래프' })).toBeVisible();

  await expect(page.getByRole('banner').getByRole('link', { name: 'English', exact: true })).toHaveAttribute('href', '/en/node');
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', 'https://iroa.ai/en/node');
});

test('serves the English NODE page with the same structure', async ({ page }) => {
  await page.goto('/en/node');

  await expect(page).toHaveTitle('IROA.AI | NODE Network');
  await expect(page.getByRole('heading', { level: 1, name: 'A NODE is an execution space verified per request.' })).toBeVisible();
  await expect(page.getByRole('table').getByRole('rowheader')).toHaveCount(5);
  await expect(page.locator('#network-state').getByText('Before deployment', { exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('link', { name: '한국어', exact: true })).toHaveAttribute('href', '/node');
});

test('links the homepage NODE section and the Q&A reward answer to the NODE page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#network').getByRole('link', { name: 'NODE 네트워크 자세히 보기' })).toHaveAttribute('href', '/node');

  await page.goto('/faq');
  await expect(page.locator('#rewards').getByRole('link', { name: 'NODE 운영자 보상 구조 보기' })).toHaveAttribute('href', '/node#rewards');
});
