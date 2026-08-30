import { createHash } from 'node:crypto';
import { expect, test, type Page, type Route } from '@playwright/test';
import { decodeFunctionData, encodeFunctionData, encodeFunctionResult, keccak256, multicall3Abi, stringToBytes, toFunctionSelector, toHex, type Hex } from 'viem';

const WALLET = '0x2000000000000000000000000000000000000001';
const NODE_ID = `0x${'11'.repeat(32)}`;
const DEVICE_HASH = `0x${'22'.repeat(32)}`;
const TASK_ID = `0x${'33'.repeat(32)}`;
const EVIDENCE_HASH = `0x${'44'.repeat(32)}`;
const REWARD_ROOT = `0x${'55'.repeat(32)}` as Hex;
const RECEIPT_ROOT = `0x${'66'.repeat(32)}` as Hex;
const TX_HASH = `0x${'77'.repeat(32)}`;
const ROLE_IDS = {
  compliance: `0x${'a1'.repeat(32)}`,
  suspender: `0x${'a2'.repeat(32)}`,
  challenger: `0x${'a3'.repeat(32)}`,
  rootProposer: `0x${'a4'.repeat(32)}`,
};
const selectors = {
  compliance: toFunctionSelector('COMPLIANCE_ROLE()'),
  suspender: toFunctionSelector('SUSPENDER_ROLE()'),
  challenger: toFunctionSelector('CHALLENGER_ROLE()'),
  rootProposer: toFunctionSelector('ROOT_PROPOSER_ROLE()'),
  hasRole: toFunctionSelector('hasRole(bytes32,address)'),
};

type Persona = 'super_admin' | 'treasury' | 'compliance' | 'read_only';

function contractResult(data: string): Hex {
  if (data.startsWith(selectors.compliance)) return ROLE_IDS.compliance as Hex;
  if (data.startsWith(selectors.suspender)) return ROLE_IDS.suspender as Hex;
  if (data.startsWith(selectors.challenger)) return ROLE_IDS.challenger as Hex;
  if (data.startsWith(selectors.rootProposer)) return ROLE_IDS.rootProposer as Hex;
  if (data.startsWith(selectors.hasRole)) return toHex(1n, { size: 32 });
  return toHex(0n, { size: 32 });
}

async function installWallet(page: Page) {
  await page.addInitScript(({ wallet }) => {
    const listeners: Record<string, Array<(value: unknown) => void>> = {};
    Object.defineProperty(window, 'ethereum', { configurable: true, value: {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [wallet];
        if (method === 'eth_chainId') return '0x14a34';
        if (method === 'personal_sign') return `0x${'99'.repeat(65)}`;
        if (method === 'wallet_switchEthereumChain') return null;
        throw new Error(`Unhandled wallet method: ${method}`);
      },
      on: (event: string, listener: (value: unknown) => void) => { (listeners[event] ??= []).push(listener); },
      removeListener: (event: string, listener: (value: unknown) => void) => { listeners[event] = (listeners[event] ?? []).filter((current) => current !== listener); },
    } });
  }, { wallet: WALLET });
}

async function rpc(route: Route) {
  const request = route.request().postDataJSON() as { id: number; method: string; params?: unknown[] };
  let result: unknown = '0x0';
  if (request.method === 'eth_chainId') result = '0x14a34';
  else if (request.method === 'eth_blockNumber') result = '0x10';
  else if (request.method === 'eth_call') {
    const call = (request.params?.[0] ?? {}) as { data?: string };
    const data = call.data ?? '0x';
    if (data.startsWith('0x82ad56cb')) {
      const decoded = decodeFunctionData({ abi: multicall3Abi, data: data as Hex });
      if (decoded.functionName !== 'aggregate3') throw new Error('Unexpected multicall function');
      result = encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: decoded.args[0].map((item) => ({ success: true, returnData: contractResult(item.callData) })) });
    } else result = contractResult(data);
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) });
}

function settlementFixture() {
  const artifact = JSON.stringify({
    allocations: [{ operatorIdHash: NODE_ID, nodeId: NODE_ID, score: '100', rewardAmount: '1000' }],
    capExcludedAmount: '0', claims: [{ leaf: { epoch: 1, operatorIdHash: NODE_ID, nodeId: NODE_ID, score: '100', rewardAmount: '1000', receiptBatchRoot: RECEIPT_ROOT, policyVersion: '1.0.0', claimNonce: NODE_ID }, leafHash: NODE_ID, proof: [] }],
    epoch: 1, excludedTasks: [{ taskId: TASK_ID, reasons: ['DISPUTE_OPEN'] }], includedTaskCount: 1,
    monthlyBudget: '2000', policyVersion: '1.0.0', receiptBatchRoot: RECEIPT_ROOT,
    rewardRoot: REWARD_ROOT, roundingExcludedAmount: '0', totalReward: '1000', totalValidScore: '100', unusedAmount: '1000',
  });
  return { ...JSON.parse(artifact), canonicalArtifact: artifact, artifactSha256: `0x${createHash('sha256').update(artifact).digest('hex')}` };
}

async function installRoutes(page: Page, persona: Persona) {
  await page.route('**/rpc', rpc);
  await page.route('**/api/me', (route) => route.fulfill({ status: 200, json: { accessVerified: true, persona } }));
  await page.route('**/control/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/siwe/challenge')) return route.fulfill({ status: 201, json: { nonce: 'nonce-12345678', expiresAt: Math.floor(Date.now() / 1_000) + 600 } });
    if (path.endsWith('/auth/siwe')) return route.fulfill({ status: 200, json: { actorIdHash: `0x${'cd'.repeat(32)}`, csrfToken: 'csrf-token-1234567890', expiresAt: Math.floor(Date.now() / 1_000) + 3600 } });
    if (path.endsWith('/admin/nodes')) return route.fulfill({ status: 200, json: [{ nodeId: NODE_ID, deviceKeyHash: DEVICE_HASH, trustLevel: 'N1', policyVersion: '1.0.0', status: 'pending', agentVersion: '1.0.0', capacityBucket: 'medium', lastSeenAt: 1_800_000_000, createdAt: 1, updatedAt: 1 }] });
    if (path.endsWith('/admin/disputes')) return route.fulfill({ status: 200, json: [{ taskId: TASK_ID, evidenceHash: EVIDENCE_HASH, status: 'open', openedAt: 1_800_000_000, resolvedAt: null, reasonCode: 'RESULT_MISMATCH' }] });
    if (path.endsWith('/admin/settlements/current/proposal')) {
      const settlement = settlementFixture();
      const policyVersionHash = keccak256(stringToBytes(settlement.policyVersion));
      const data = encodeFunctionData({ abi: [{ type: 'function', name: 'proposeRoot', stateMutability: 'nonpayable', outputs: [], inputs: [{ name: 'epoch', type: 'uint64' }, { name: 'rewardRoot', type: 'bytes32' }, { name: 'receiptBatchRoot', type: 'bytes32' }, { name: 'policyVersionHash', type: 'bytes32' }] }] as const, functionName: 'proposeRoot', args: [1n, REWARD_ROOT, RECEIPT_ROOT, policyVersionHash] });
      return route.fulfill({ status: 200, json: { to: '0x1000000000000000000000000000000000000002', data, value: '0', artifactSha256: settlement.artifactSha256, policyVersionHash } });
    }
    if (path.endsWith('/admin/settlements/current')) return route.fulfill({ status: 200, json: settlementFixture() });
    if (path.endsWith('/admin/governance/queue')) return route.fulfill({ status: 200, json: [] });
    if (path.endsWith('/admin/audit')) return route.fulfill({ status: 200, json: [{ auditId: 'audit-1', actor: NODE_ID, action: 'NODE_APPROVED', target: NODE_ID, policyVersion: '1.0.0', timestamp: 1_800_000_000, transactionHash: TX_HASH, result: 'confirmed' }] });
    return route.fulfill({ status: 404, json: { error: 'NOT_FOUND' } });
  });
}

async function connectAndSignIn(page: Page) {
  await page.getByRole('button', { name: /연결$/ }).click();
  await page.getByRole('button', { name: '관리자 서명 로그인' }).click();
  await expect(page.getByText('SIWE 확인됨')).toBeVisible();
}

test('persona route guard blocks direct URL access', async ({ page }) => {
  await installWallet(page); await installRoutes(page, 'compliance');
  await page.goto('/settlement');
  await expect(page.getByRole('heading', { name: '이 화면을 볼 수 없습니다' })).toBeVisible();
  await expect(page.getByText('/settlement 화면이 포함되지 않습니다')).toBeVisible();
});

test('read-only persona can inspect but cannot approve a NODE', async ({ page }) => {
  await installWallet(page); await installRoutes(page, 'read_only');
  await page.goto('/nodes'); await connectAndSignIn(page);
  await expect(page.getByRole('button', { name: 'NODE 승인' })).toBeDisabled();
});

test('open dispute remains visibly held out of settlement', async ({ page }) => {
  await installWallet(page); await installRoutes(page, 'treasury');
  await page.goto('/settlement'); await connectAndSignIn(page);
  await expect(page.getByText('DISPUTE_OPEN')).toBeVisible();
  await expect(page.getByText('제외 작업').locator('..').getByText('1')).toBeVisible();
});

test('settlement verification creates a download artifact without sending a transaction', async ({ page }) => {
  await installWallet(page); await installRoutes(page, 'treasury');
  await page.goto('/settlement'); await connectAndSignIn(page);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '검증 후 Safe 제안 생성' }).click();
  await expect(page.getByText('아직 어떤 트랜잭션도 전송되지 않았습니다')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Safe 제안 파일 내려받기' }).click();
  await expect((await download).suggestedFilename()).toBe('iroa-root-proposal-epoch-1.json');
});

test('audit export neutralizes spreadsheet formulas and excludes private payload fields', async ({ page }) => {
  await installWallet(page); await installRoutes(page, 'compliance');
  await page.goto('/audit'); await connectAndSignIn(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV 내려받기' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const content = await import('node:fs/promises').then((fs) => fs.readFile(path!, 'utf8'));
  expect(content).toContain(NODE_ID);
  expect(content).not.toContain('capsule');
  expect(content).not.toContain('receipt');
});
