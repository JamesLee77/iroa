import { expect, test, type Page, type Route } from '@playwright/test';
import { decodeFunctionData, encodeFunctionResult, multicall3Abi, toFunctionSelector, toHex, type Hex } from 'viem';
import { createHash } from 'node:crypto';

const OPERATOR = '0x2000000000000000000000000000000000000001';
const ACTOR_HASH = `0x${'22'.repeat(32)}`;
const DEVICE_HASH = `0x${'44'.repeat(32)}`;
const NODE_ID = `0x${createHash('sha256').update(`${OPERATOR.toLowerCase()}:${DEVICE_HASH}`).digest('hex')}`;
const RECORD_ID = `0x${'55'.repeat(32)}`;
const RECEIPT_ROOT = `0x${'66'.repeat(32)}`;
const CLAIM_NONCE = `0x${'77'.repeat(32)}`;
const PROOF = `0x${'88'.repeat(32)}`;
const TX_HASH = `0x${'99'.repeat(32)}`;
const TOKEN_V1 = '0x1000000000000000000000000000000000000001';
const TOKEN_V2 = '0x1000000000000000000000000000000000000004';
const MIGRATION = '0x1000000000000000000000000000000000000005';
const BASE_SEPOLIA = '0x14a34';

const selectors = {
  balanceOf: toFunctionSelector('balanceOf(address)'),
  totalSupply: toFunctionSelector('totalSupply()'),
  allowance: toFunctionSelector('allowance(address,address)'),
  approve: toFunctionSelector('approve(address,uint256)'),
  migrate: toFunctionSelector('migrate(uint256)'),
  migrationBurned: toFunctionSelector('migrationBurned()'),
  migrationMinted: toFunctionSelector('migrationMinted()'),
  claimed: toFunctionSelector('claimed(bytes32)'),
  nodeStatus: toFunctionSelector('nodeStatus(bytes32)'),
  registerNode: toFunctionSelector('registerNode(bytes32,bytes32,bytes32,uint8,bytes)'),
  deviceKeyNode: toFunctionSelector('deviceKeyNode(bytes32)'),
  operatorWallet: toFunctionSelector('operatorWallet(bytes32)'),
  operatorIdHash: toFunctionSelector('operatorIdHash(bytes32)'),
};

interface MockState {
  chainId: Hex;
  claimed: boolean;
  v1Balance: bigint;
  v2Balance: bigint;
  allowance: bigint;
  burned: bigint;
  minted: bigint;
  transactionCount: number;
  enrollFailures: number;
  statusFailures: number;
  showNode: boolean;
  nodeChainStatus: bigint;
  registeredOnchain: boolean;
  rpcDelayMs: number;
}

function word(value: bigint | boolean): Hex {
  return toHex(typeof value === 'boolean' ? (value ? 1n : 0n) : value, { size: 32 });
}

function receipt(hash: Hex) {
  return {
    blockHash: `0x${'ab'.repeat(32)}`,
    blockNumber: '0x10',
    contractAddress: null,
    cumulativeGasUsed: '0x5208',
    effectiveGasPrice: '0x1',
    from: OPERATOR,
    gasUsed: '0x5208',
    logs: [],
    logsBloom: `0x${'00'.repeat(256)}`,
    status: '0x1',
    to: MIGRATION,
    transactionHash: hash,
    transactionIndex: '0x0',
    type: '0x2',
  };
}

function contractResult(to: string | undefined, data: string, state: MockState): Hex {
  const target = to?.toLowerCase();
  if (data.startsWith(selectors.claimed)) return word(state.claimed);
  if (data.startsWith(selectors.nodeStatus)) return word(state.nodeChainStatus);
  if (data.startsWith(selectors.deviceKeyNode)) return state.registeredOnchain ? NODE_ID as Hex : word(0n);
  if (data.startsWith(selectors.operatorWallet)) return `0x${'0'.repeat(24)}${OPERATOR.slice(2)}` as Hex;
  if (data.startsWith(selectors.operatorIdHash)) return ACTOR_HASH as Hex;
  if (data.startsWith(selectors.balanceOf)) return word(target === TOKEN_V1.toLowerCase() ? state.v1Balance : state.v2Balance);
  if (data.startsWith(selectors.allowance)) return word(state.allowance);
  if (data.startsWith(selectors.totalSupply)) return word(target === TOKEN_V1.toLowerCase() ? 100_000_000n * 10n ** 18n - state.burned : state.minted);
  if (data.startsWith(selectors.migrationBurned)) return word(state.burned);
  if (data.startsWith(selectors.migrationMinted)) return word(state.minted);
  if (data.startsWith(selectors.migrate) || data.startsWith(toFunctionSelector('claim(uint64,bytes32,bytes32,uint256,uint256,bytes32,string,bytes32,bytes32[])'))) return '0x';
  return word(0n);
}

async function installWallet(page: Page, state: MockState) {
  await page.addInitScript(({ address, startingChain, baseChain, approveSelector, migrateSelector, registerSelector, tokenV1, migration }) => {
    let chainId = startingChain;
    let listeners: Record<string, Array<(value: unknown) => void>> = {};
    let transactionCount = Number(localStorage.getItem('iroa-e2e-transaction-count') ?? '0');
    const provider = {
      isMetaMask: true,
      request: async ({ method, params = [] }: { method: string; params?: unknown[] }) => {
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [address];
        if (method === 'eth_chainId') return chainId;
        if (method === 'wallet_switchEthereumChain') {
          chainId = (params[0] as { chainId: Hex }).chainId;
          for (const listener of listeners.chainChanged ?? []) listener(chainId);
          return null;
        }
        if (method === 'personal_sign') return `0x${'11'.repeat(65)}`;
        if (method === 'eth_estimateGas') return '0x186a0';
        if (method === 'eth_gasPrice' || method === 'eth_maxPriorityFeePerGas') return '0x1';
        if (method === 'eth_getTransactionCount') return '0x0';
        if (method === 'eth_sendTransaction') {
          transactionCount += 1;
          localStorage.setItem('iroa-e2e-transaction-count', String(transactionCount));
          const transaction = params[0] as { to?: string; data?: string };
          const data = transaction.data ?? '0x';
          if (transaction.to?.toLowerCase() === tokenV1.toLowerCase() && data.startsWith(approveSelector)) {
            (window as unknown as { __iroaApprovedAmount: string }).__iroaApprovedAmount = `0x${data.slice(-64)}`;
          }
          if (transaction.to?.toLowerCase() === migration.toLowerCase() && data.startsWith(migrateSelector)) {
            (window as unknown as { __iroaMigratedAmount: string }).__iroaMigratedAmount = `0x${data.slice(-64)}`;
          }
          if (data.startsWith(registerSelector)) {
            (window as unknown as { __iroaRegisteredNode: boolean }).__iroaRegisteredNode = true;
            localStorage.setItem('iroa-e2e-registered-node', 'true');
          }
          (window as unknown as { __iroaTransactionCount: number }).__iroaTransactionCount = transactionCount;
          return `0x${transactionCount.toString(16).padStart(64, '9')}` as Hex;
        }
        throw new Error(`Unhandled wallet method: ${method}`);
      },
      on: (event: string, listener: (value: unknown) => void) => { (listeners[event] ??= []).push(listener); },
      removeListener: (event: string, listener: (value: unknown) => void) => { listeners[event] = (listeners[event] ?? []).filter((current) => current !== listener); },
    };
    Object.defineProperty(window, 'ethereum', { configurable: true, value: provider });
    (window as unknown as { __iroaTransactionCount: number }).__iroaTransactionCount = transactionCount;
    if (startingChain === baseChain) chainId = baseChain;
  }, { address: OPERATOR, startingChain: state.chainId, baseChain: BASE_SEPOLIA, approveSelector: selectors.approve, migrateSelector: selectors.migrate, registerSelector: selectors.registerNode, tokenV1: TOKEN_V1, migration: MIGRATION });
}

async function jsonRpc(route: Route, state: MockState) {
  const body = route.request().postDataJSON() as { id: number; method: string; params?: unknown[] };
  let result: unknown;
  if (body.method === 'eth_chainId') result = BASE_SEPOLIA;
  else if (body.method === 'eth_blockNumber') result = '0x10';
  else if (body.method === 'eth_getTransactionReceipt') result = receipt((body.params?.[0] ?? TX_HASH) as Hex);
  else if (body.method === 'eth_getBlockByNumber') result = { baseFeePerGas: '0x1', gasLimit: '0x1c9c380', gasUsed: '0x0', hash: `0x${'ab'.repeat(32)}`, number: '0x10', timestamp: '0x1' };
  else if (body.method === 'eth_call') {
    const call = (body.params?.[0] ?? {}) as { to?: string; data?: string };
    const data = call.data ?? '0x';
    if (data.startsWith('0x82ad56cb')) {
      const decoded = decodeFunctionData({ abi: multicall3Abi, data: data as Hex });
      if (decoded.functionName !== 'aggregate3') throw new Error('Unexpected multicall function');
      const calls = decoded.args[0];
      result = encodeFunctionResult({
        abi: multicall3Abi,
        functionName: 'aggregate3',
        result: calls.map((item) => ({ success: true, returnData: contractResult(item.target, item.callData, state) })),
      });
    } else result = contractResult(call.to, data, state);
  } else if (body.method === 'eth_estimateGas') result = '0x186a0';
  else result = '0x0';
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: body.id, result }) });
}

async function installRoutes(page: Page, state: MockState) {
  await page.route('**/rpc', async (route) => {
    if (state.rpcDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, state.rpcDelayMs));
    state.registeredOnchain = state.registeredOnchain || await page.evaluate(() => localStorage.getItem('iroa-e2e-registered-node') === 'true').catch(() => false);
    const approved = await page.evaluate(() => (window as unknown as { __iroaApprovedAmount?: string }).__iroaApprovedAmount).catch(() => undefined);
    if (approved) state.allowance = BigInt(approved);
    const migrated = await page.evaluate(() => (window as unknown as { __iroaMigratedAmount?: string }).__iroaMigratedAmount).catch(() => undefined);
    if (migrated) {
      const amount = BigInt(migrated);
      state.v1Balance -= amount;
      state.v2Balance += amount;
      state.burned += amount;
      state.minted += amount;
      state.allowance -= amount;
      await page.evaluate(() => { delete (window as unknown as { __iroaMigratedAmount?: string }).__iroaMigratedAmount; });
    }
    await jsonRpc(route, state);
  });
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/siwe/challenge')) return route.fulfill({ status: 201, json: { nonce: 'nonce-12345678', expiresAt: Math.floor(Date.now() / 1_000) + 600 } });
    if (path.endsWith('/auth/siwe')) return route.fulfill({ status: 200, headers: { 'set-cookie': 'iroa_session=test; Path=/; SameSite=Strict' }, json: { actorIdHash: ACTOR_HASH, csrfToken: 'csrf-token-1234567890', expiresAt: Math.floor(Date.now() / 1_000) + 3600 } });
    if (path.endsWith('/auth/nodes/challenge')) return route.fulfill({ status: 201, json: { nonce: 'node-nonce-1234', expiresAt: Math.floor(Date.now() / 1_000) + 600, message: 'IROA NODE proof\nNonce: node-nonce-1234' } });
    if (path.endsWith('/nodes/enroll')) {
      if (state.enrollFailures > 0) { state.enrollFailures -= 1; return route.fulfill({ status: 503, json: { error: 'TEMPORARY_FAILURE' } }); }
      return route.fulfill({ status: 201, json: { nodeId: NODE_ID, deviceKeyHash: DEVICE_HASH, trustLevel: 'N0', policyVersion: '1.0.0', status: 'pending', agentVersion: null, capacityBucket: null, lastSeenAt: null, createdAt: 1, updatedAt: 1 } });
    }
    if (/\/nodes\/0x[0-9a-f]{64}\/status$/i.test(path)) {
      if (state.statusFailures > 0) { state.statusFailures -= 1; return route.fulfill({ status: 403, json: { error: 'COMPLIANCE_AUTH_REQUIRED' } }); }
      return route.fulfill({ status: 200, json: { nodeId: NODE_ID, deviceKeyHash: DEVICE_HASH, trustLevel: 'N0', policyVersion: '1.0.0', status: 'suspended', agentVersion: '1.0.0', capacityBucket: 'medium', lastSeenAt: 1_800_000_000, createdAt: 1, updatedAt: 2 } });
    }
    if (path.endsWith('/operator/nodes')) return route.fulfill({ status: 200, json: state.showNode ? [{ nodeId: NODE_ID, deviceKeyHash: DEVICE_HASH, trustLevel: 'N0', policyVersion: '1.0.0', status: 'active', agentVersion: '1.0.0', capacityBucket: 'medium', lastSeenAt: 1_800_000_000, createdAt: 1, updatedAt: 1 }] : [] });
    if (path.endsWith('/operator/tasks')) return route.fulfill({ status: 200, json: [] });
    if (path.endsWith('/operator/rewards')) return route.fulfill({ status: 200, json: [{ recordId: RECORD_ID, leaf: { epoch: 1, operatorIdHash: ACTOR_HASH, nodeId: NODE_ID, score: '95', rewardAmount: (25n * 10n ** 18n).toString(), receiptBatchRoot: RECEIPT_ROOT, policyVersion: '1.0.0', claimNonce: CLAIM_NONCE }, proof: [PROOF], scoreBreakdown: { validatedTasks: 12, resultQualityBps: 9800, accessibilityQualityBps: 9600, securityGate: true }, excludedReasons: [] }] });
    return route.fulfill({ status: 404, json: { error: 'NOT_FOUND' } });
  });
}

async function connectAndSignIn(page: Page) {
  await page.getByRole('button', { name: '브라우저 지갑 연결' }).click();
  await page.getByRole('button', { name: '운영자 서명 로그인' }).click();
  await expect(page.getByText(`${OPERATOR.slice(0, 6)}…${OPERATOR.slice(-4)}`)).toBeVisible();
}

function initialState(overrides: Partial<MockState> = {}): MockState {
  return { chainId: BASE_SEPOLIA, claimed: false, v1Balance: 10n * 10n ** 18n, v2Balance: 0n, allowance: 0n, burned: 0n, minted: 0n, transactionCount: 0, enrollFailures: 0, statusFailures: 0, showNode: false, nodeChainStatus: 1n, registeredOnchain: false, rpcDelayMs: 0, ...overrides };
}

test('wrong chain locks writes until the wallet switches to the selected network', async ({ page }) => {
  const state = initialState({ chainId: '0x1' });
  await installWallet(page, state);
  await installRoutes(page, state);
  await page.goto('/nodes');
  await page.getByRole('button', { name: '브라우저 지갑 연결' }).click();
  await expect(page.getByRole('button', { name: '올바른 네트워크로 전환' })).toBeVisible();
  await expect(page.getByText('쓰기 잠김')).toBeVisible();
  await page.getByRole('button', { name: '올바른 네트워크로 전환' }).click();
  await expect(page.getByRole('button', { name: '운영자 서명 로그인' })).toBeVisible();
});

test('enrollment retries only the portal connection after an onchain success', async ({ page }) => {
  const state = initialState({ enrollFailures: 1 });
  await installWallet(page, state);
  await installRoutes(page, state);
  await page.goto('/enrollment');
  await connectAndSignIn(page);
  await page.getByLabel('기기 지갑 주소').fill('0x3000000000000000000000000000000000000001');
  await page.getByLabel('기기 키 해시').fill(DEVICE_HASH);
  await page.getByRole('button', { name: '기기 서명 요청 만들기' }).click();
  await page.getByLabel('기기 서명', { exact: true }).fill(`0x${'aa'.repeat(65)}`);
  await page.getByLabel('온체인 등록 기기 서명').fill(`0x${'bb'.repeat(65)}`);
  await page.getByRole('button', { name: '온체인 등록 후 포털 연결' }).click();
  await expect(page.getByText(/온체인 등록 완료/)).toBeVisible();
  await page.reload();
  const connect = page.getByRole('button', { name: '브라우저 지갑 연결' });
  if (await connect.isVisible()) await connect.click();
  await page.getByLabel('기기 지갑 주소').fill('0x3000000000000000000000000000000000000001');
  await page.getByLabel('기기 키 해시').fill(DEVICE_HASH);
  await page.getByRole('button', { name: '기기 서명 요청 만들기' }).click();
  await page.getByLabel('기기 서명', { exact: true }).fill(`0x${'aa'.repeat(65)}`);
  await page.getByLabel('온체인 등록 기기 서명').fill(`0x${'bb'.repeat(65)}`);
  await page.getByRole('button', { name: '온체인 등록 후 포털 연결' }).click();
  await expect(page.getByText('NODE 등록이 완료되었습니다.')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __iroaTransactionCount: number }).__iroaTransactionCount)).toBe(1);
});

test('reward claim status is read from the chain and duplicate claim is disabled', async ({ page }) => {
  const state = initialState({ claimed: true });
  await installWallet(page, state);
  await installRoutes(page, state);
  await page.goto('/rewards');
  await connectAndSignIn(page);
  await expect(page.getByText('청구 완료').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '청구 완료' })).toBeDisabled();
});

test('reward stays in checking state until the onchain claim read completes', async ({ page }) => {
  const state = initialState({ rpcDelayMs: 800 });
  await installWallet(page, state);
  await installRoutes(page, state);
  await page.goto('/rewards');
  await connectAndSignIn(page);
  await expect(page.getByText('온체인 청구 상태 확인 중')).toBeVisible();
  await expect(page.getByRole('button', { name: '보상 청구' })).toBeDisabled();
});

test('a rejected portal status request does not claim that offchain state changed', async ({ page }) => {
  const state = initialState({ showNode: true, statusFailures: 1 });
  await installWallet(page, state);
  await installRoutes(page, state);
  await page.goto('/nodes');
  await connectAndSignIn(page);
  await page.getByRole('button', { name: 'NODE 일시 중지' }).click();
  await page.getByLabel('영향을 이해했습니다').check();
  await page.getByLabel('이 작업을 다시 확인합니다').check();
  await page.getByRole('button', { name: '변경 적용' }).click();
  await expect(page.getByRole('alert')).toContainText('요청을 완료할 수 없습니다');
  await expect(page.getByRole('alert')).not.toContainText('포털 중지는 반영');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __iroaTransactionCount: number }).__iroaTransactionCount)).toBe(0);
});

test('NODE status display distinguishes the onchain status from portal state', async ({ page }) => {
  const state = initialState({ showNode: true, nodeChainStatus: 2n });
  await installWallet(page, state);
  await installRoutes(page, state);
  await page.goto('/nodes');
  await connectAndSignIn(page);
  await expect(page.getByText('온체인 상태 · 일시 중지')).toBeVisible();
  await expect(page.getByRole('button', { name: 'NODE 일시 중지' })).toBeDisabled();
});

test('a partial V1 amount is approved exactly and migrated 1:1', async ({ page }) => {
  const state = initialState();
  await installWallet(page, state);
  await installRoutes(page, state);
  await page.goto('/migrate');
  await connectAndSignIn(page);
  await page.getByLabel('이전할 V1 수량').fill('2.5');
  await page.getByRole('button', { name: '정확한 수량 승인' }).click();
  await expect(page.getByText('승인 완료')).toBeVisible();
  await page.getByRole('button', { name: 'V2로 이전' }).click();
  await expect(page.getByText('7.5 IROA')).toBeVisible();
  await expect(page.getByText('2.5 IROA')).toBeVisible();
});
