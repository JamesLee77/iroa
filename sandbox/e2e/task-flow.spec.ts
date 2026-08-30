import { expect, test, type Page, type Route } from '@playwright/test';

const TASK_ID = `0x${'1'.repeat(64)}`;
const HASH = `0x${'2'.repeat(64)}`;

function task(state: string) {
  return {
    taskId: TASK_ID,
    state,
    policyVersion: '1.0.0',
    capsule: {
      taskId: TASK_ID,
      policyVersion: '1.0.0',
      trustLevel: 'N0',
      capabilityScope: ['synthetic:public-information'],
      expiresAt: 2_000_000_000,
      inputCiphertextRef: 'iroa-blob://synthetic/public-information-v1',
      expectedResultSchema: 'iroa-schema://synthetic/public-information-v1',
      userApprovalHash: HASH,
    },
    rowVersion: 2,
    createdAt: 1_900_000_000,
    updatedAt: 1_900_000_001,
  };
}

async function json(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function seedSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    sessionStorage.setItem('iroa-sandbox-session-v1', JSON.stringify({ csrfToken: 'test-csrf-token-value', expiresAt: 2_000_000_000 }));
  });
}

test('keyboard user can choose a sample, approve disclosures, and send a request', async ({ page }) => {
  await page.route('**/api/v1/auth/sandbox', (route) => json(route, 201, { csrfToken: 'test-csrf-token-value', expiresAt: 2_000_000_000 }));
  await page.route('**/api/v1/tasks', (route) => json(route, 201, task('awaiting_approval')));
  await page.route(`**/api/v1/tasks/${TASK_ID}/approve`, (route) => json(route, 200, task('queued')));
  await page.goto('/');

  await page.getByRole('button', { name: /상담 가능 시간 확인/ }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('checkbox').focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: '동의하고 요청 보내기' }).focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(new RegExp(`/tasks/${TASK_ID}$`));
});

test('request submission remains blocked before approval', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '동의하고 요청 보내기' })).toBeDisabled();
  await expect(page.getByText('위 내용을 확인해야 요청을 보낼 수 있습니다.')).toBeVisible();
});

test('user can cancel a queued request', async ({ page }) => {
  await seedSession(page);
  let state = 'queued';
  await page.route(`**/api/v1/tasks/${TASK_ID}`, (route) => json(route, 200, {
    task: task(state),
    receipts: {
      result: { status: 'missing', receiptHash: null, createdAt: null },
      deletion: { status: 'missing', receiptHash: null, createdAt: null },
    },
  }));
  await page.route(`**/api/v1/tasks/${TASK_ID}/cancel`, async (route) => {
    state = 'cancelled';
    await json(route, 200, task(state));
  });

  await page.goto(`/tasks/${TASK_ID}`);
  await page.getByRole('button', { name: '요청 취소' }).click();
  await expect(page.getByText('취소됨')).toBeVisible();
  await expect(page.getByText(/노드 보상은 발생하지 않습니다/)).toBeVisible();
});

test('user confirms only when result and deletion receipts are verified', async ({ page }) => {
  await seedSession(page);
  await page.route(`**/api/v1/tasks/${TASK_ID}`, (route) => json(route, 200, {
    task: task('awaiting_confirmation'),
    receipts: {
      result: { status: 'verified', receiptHash: HASH, createdAt: 1_900_000_010 },
      deletion: { status: 'verified', receiptHash: HASH, createdAt: 1_900_000_011 },
    },
  }));
  await page.route(`**/api/v1/tasks/${TASK_ID}/confirm`, (route) => json(route, 200, task('reward_pending')));

  await page.goto(`/tasks/${TASK_ID}/result`);
  await expect(page.getByText('검증됨')).toHaveCount(2);
  await page.getByRole('button', { name: '결과 확정' }).click();
  await expect(page.getByText('보상 검증 대기')).toBeVisible();
});

test('result view refreshes after a delayed deletion receipt arrives', async ({ page }) => {
  await seedSession(page);
  let deletionReady = false;
  await page.route(`**/api/v1/tasks/${TASK_ID}`, (route) => json(route, 200, {
    task: task('awaiting_confirmation'),
    receipts: {
      result: { status: 'verified', receiptHash: HASH, createdAt: 1_900_000_010 },
      deletion: deletionReady
        ? { status: 'verified', receiptHash: HASH, createdAt: 1_900_000_011 }
        : { status: 'missing', receiptHash: null, createdAt: null },
    },
  }));

  await page.goto(`/tasks/${TASK_ID}/result`);
  await expect(page.getByText('누락')).toBeVisible();
  await expect(page.getByRole('button', { name: '결과 확정' })).toBeDisabled();
  deletionReady = true;
  await page.getByRole('button', { name: '새로 확인' }).click();
  await expect(page.getByText('검증됨')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '결과 확정' })).toBeEnabled();
});

test('dispute sends a reason and only a hash of the private note', async ({ page }) => {
  await seedSession(page);
  const submitted = { body: null as Record<string, unknown> | null };
  await page.route(`**/api/v1/tasks/${TASK_ID}/dispute`, async (route) => {
    submitted.body = route.request().postDataJSON() as Record<string, unknown>;
    await json(route, 200, task('disputed'));
  });

  await page.goto(`/tasks/${TASK_ID}/dispute`);
  await page.getByRole('radio', { name: '필요한 내용이 빠졌습니다' }).check();
  await page.getByLabel(/개인 메모/).fill('이 원문은 서버로 보내지지 않아야 합니다.');
  await page.getByRole('button', { name: '담당자 검토 요청' }).click();

  await expect(page.getByText(/자동 보상은 중지됩니다/)).toBeVisible();
  expect(submitted.body).toMatchObject({ reasonCode: 'RESULT_INCOMPLETE' });
  expect(submitted.body?.evidenceHash).toMatch(/^0x[0-9a-f]{64}$/);
  expect(JSON.stringify(submitted.body)).not.toContain('이 원문은 서버로 보내지지 않아야 합니다.');
});
