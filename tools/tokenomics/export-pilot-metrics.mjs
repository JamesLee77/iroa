#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEI = 10n ** 18n;
const FORBIDDEN_KEY = /(price|return|listing|apy|roi)/i;
const DIRECT_IDENTIFIER_KEY = /^(name|email|wallet|walletAddress|address)$/i;
const PSEUDONYM = /^(NODE|OP|TASK)-[A-Z0-9][A-Z0-9_-]{2,63}$/;

function usage() {
  return 'Usage: node tools/tokenomics/export-pilot-metrics.mjs --input <pilot.json> --output-dir <directory>';
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value) throw new Error(usage());
    args.set(key, value);
  }
  const input = args.get('--input');
  const outputDir = args.get('--output-dir');
  if (!input || !outputDir || args.size !== 2) throw new Error(usage());
  return { input: resolve(input), outputDir: resolve(outputDir) };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function assertNoProjectionOrPii(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoProjectionOrPii(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key)) throw new Error(`forbidden projection field at ${path}.${key}`);
    if (DIRECT_IDENTIFIER_KEY.test(key)) throw new Error(`direct identifier field is forbidden at ${path}.${key}`);
    assertNoProjectionOrPii(item, `${path}.${key}`);
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function assertExactKeys(value, allowed, label) {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) throw new Error(`${label} contains unexpected field: ${unexpected.join(', ')}`);
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function requireInteger(value, label) {
  const text = requireString(value, label);
  if (!/^\d+$/.test(text)) throw new Error(`${label} must be a non-negative integer string`);
  return BigInt(text);
}

function requirePseudonym(value, prefix, label) {
  const text = requireString(value, label);
  if (!PSEUDONYM.test(text) || !text.startsWith(`${prefix}-`)) {
    throw new Error(`${label} must be a repository-safe ${prefix}- pseudonym`);
  }
  return text;
}

function requireIsoDate(value, label) {
  const text = requireString(value, label);
  const milliseconds = Date.parse(text);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== text) {
    throw new Error(`${label} must be an ISO-8601 UTC timestamp`);
  }
  return text;
}

function formatUnits(value, decimals = 18) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  const fraction = (absolute % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

function percent(numerator, denominator) {
  if (denominator === 0n) return null;
  const scaled = (numerator * 1_000_000n + denominator / 2n) / denominator;
  return formatUnits(scaled, 4);
}

function median(values) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  const midpoint = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return { numerator: ordered[midpoint], denominator: 1n };
  return { numerator: ordered[midpoint - 1] + ordered[midpoint], denominator: 2n };
}

function formatRationalIroa(value) {
  if (value === null) return null;
  const scaledTenthsOfWei = value.numerator * 10n / value.denominator;
  return formatUnits(scaledTenthsOfWei, 19);
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function metric(key, value, unit, numerator, denominator, definition) {
  return {
    key,
    value,
    unit,
    numerator: numerator === null ? null : String(numerator),
    denominator: denominator === null ? null : String(denominator),
    definition,
  };
}

export function calculatePilotMetrics(input) {
  assertNoProjectionOrPii(input);
  const root = requireObject(input, 'input');
  assertExactKeys(root, ['schemaVersion', 'asOf', 'period', 'monthlyBudgetWei', 'nodes', 'tasks'], 'input');
  if (root.schemaVersion !== 1) throw new Error('schemaVersion must equal 1');
  const period = requireObject(root.period, 'period');
  assertExactKeys(period, ['start', 'end', 'timezone'], 'period');
  const start = requireIsoDate(period.start, 'period.start');
  const end = requireIsoDate(period.end, 'period.end');
  if (Date.parse(start) >= Date.parse(end)) throw new Error('period.start must be before period.end');
  if (period.timezone !== 'UTC') throw new Error('period.timezone must be UTC');
  const asOf = requireIsoDate(root.asOf, 'asOf');
  if (Date.parse(asOf) < Date.parse(end)) throw new Error('asOf must not precede period.end');
  const monthlyBudgetWei = requireInteger(root.monthlyBudgetWei, 'monthlyBudgetWei');
  if (monthlyBudgetWei === 0n) throw new Error('monthlyBudgetWei must be positive');

  const nodes = requireArray(root.nodes, 'nodes').map((raw, index) => {
    const node = requireObject(raw, `nodes[${index}]`);
    assertExactKeys(node, ['nodeId', 'status'], `nodes[${index}]`);
    const nodeId = requirePseudonym(node.nodeId, 'NODE', `nodes[${index}].nodeId`);
    if (!['pending', 'active', 'suspended', 'revoked'].includes(node.status)) {
      throw new Error(`nodes[${index}].status is invalid`);
    }
    return { nodeId, status: node.status };
  });
  if (new Set(nodes.map(({ nodeId }) => nodeId)).size !== nodes.length) throw new Error('nodeId values must be unique');
  const knownNodes = new Set(nodes.map(({ nodeId }) => nodeId));

  const tasks = requireArray(root.tasks, 'tasks').map((raw, index) => {
    const task = requireObject(raw, `tasks[${index}]`);
    assertExactKeys(task, [
      'taskId', 'nodeId', 'operatorId', 'status', 'disputed', 'deletionRequired',
      'deletionVerified', 'rewardWei', 'processingCostKrw',
    ], `tasks[${index}]`);
    const taskId = requirePseudonym(task.taskId, 'TASK', `tasks[${index}].taskId`);
    const nodeId = requirePseudonym(task.nodeId, 'NODE', `tasks[${index}].nodeId`);
    const operatorId = requirePseudonym(task.operatorId, 'OP', `tasks[${index}].operatorId`);
    if (!knownNodes.has(nodeId)) throw new Error(`tasks[${index}].nodeId is not present in nodes`);
    if (!['valid', 'invalid'].includes(task.status)) throw new Error(`tasks[${index}].status is invalid`);
    if (typeof task.disputed !== 'boolean' || typeof task.deletionRequired !== 'boolean' || typeof task.deletionVerified !== 'boolean') {
      throw new Error(`tasks[${index}] boolean fields are invalid`);
    }
    if (!task.deletionRequired && task.deletionVerified) throw new Error(`tasks[${index}] cannot verify an unrequired deletion`);
    return {
      taskId,
      nodeId,
      operatorId,
      status: task.status,
      disputed: task.disputed,
      deletionRequired: task.deletionRequired,
      deletionVerified: task.deletionVerified,
      rewardWei: requireInteger(task.rewardWei, `tasks[${index}].rewardWei`),
      processingCostKrw: requireInteger(task.processingCostKrw, `tasks[${index}].processingCostKrw`),
    };
  });
  if (new Set(tasks.map(({ taskId }) => taskId)).size !== tasks.length) throw new Error('taskId values must be unique');

  const validTasks = tasks.filter(({ status }) => status === 'valid');
  if (tasks.some(({ status, rewardWei }) => status !== 'valid' && rewardWei !== 0n)) {
    throw new Error('invalid tasks must not receive a reward');
  }
  const rewardByOperator = new Map();
  for (const task of validTasks) {
    rewardByOperator.set(task.operatorId, (rewardByOperator.get(task.operatorId) ?? 0n) + task.rewardWei);
  }
  const operatorRewards = [...rewardByOperator.values()];
  const rewardPaidWei = operatorRewards.reduce((total, value) => total + value, 0n);
  if (rewardPaidWei > monthlyBudgetWei) throw new Error('valid rewards exceed monthlyBudgetWei');
  const orderedRewards = [...operatorRewards].sort((left, right) => left > right ? -1 : left < right ? 1 : 0);
  const top1 = orderedRewards.slice(0, 1).reduce((sum, value) => sum + value, 0n);
  const top5 = orderedRewards.slice(0, 5).reduce((sum, value) => sum + value, 0n);
  const disputed = tasks.filter(({ disputed: value }) => value).length;
  const deletionRequired = tasks.filter(({ deletionRequired: value }) => value);
  const deletionFailures = deletionRequired.filter(({ deletionVerified }) => !deletionVerified).length;
  const processingCostKrw = tasks.reduce((sum, task) => sum + task.processingCostKrw, 0n);
  const medianReward = median(operatorRewards);

  const metrics = [
    metric('active_node_count', nodes.filter(({ status }) => status === 'active').length, 'nodes', null, null, 'NODE records whose review status is active at period close'),
    metric('valid_task_count', validTasks.length, 'tasks', null, null, 'Reviewed tasks accepted by the verifier policy'),
    metric('rewarded_operator_count', operatorRewards.length, 'operators', null, null, 'Pseudonymous operators with at least one valid rewarded task'),
    metric('median_operator_reward_iroa', formatRationalIroa(medianReward), 'IROA', medianReward?.numerator ?? null, medianReward?.denominator ?? null, 'Median of valid-task reward totals per pseudonymous operator'),
    metric('top_1_reward_concentration_pct', percent(top1, rewardPaidWei), 'percent', top1, rewardPaidWei, 'Largest operator reward divided by all valid-task rewards'),
    metric('top_5_reward_concentration_pct', percent(top5, rewardPaidWei), 'percent', top5, rewardPaidWei, 'Five largest operator rewards divided by all valid-task rewards'),
    metric('monthly_budget_usage_pct', percent(rewardPaidWei, monthlyBudgetWei), 'percent', rewardPaidWei, monthlyBudgetWei, 'Valid-task rewards divided by the approved monthly NODE budget'),
    metric('unused_budget_iroa', formatUnits(monthlyBudgetWei - rewardPaidWei), 'IROA', monthlyBudgetWei - rewardPaidWei, WEI, 'Approved monthly NODE budget not assigned to valid tasks'),
    metric('dispute_rate_pct', percent(BigInt(disputed), BigInt(tasks.length)), 'percent', disputed, tasks.length, 'Disputed reviewed tasks divided by all reviewed tasks'),
    metric('deletion_failure_rate_pct', percent(BigInt(deletionFailures), BigInt(deletionRequired.length)), 'percent', deletionFailures, deletionRequired.length, 'Required deletions without a verified deletion receipt'),
    metric('processing_cost_total_krw', processingCostKrw.toString(), 'KRW', processingCostKrw, 1, 'Recorded processing cost for all reviewed tasks; excludes token valuation'),
    metric('processing_cost_per_valid_task_krw', validTasks.length === 0 ? null : (processingCostKrw / BigInt(validTasks.length)).toString(), 'KRW', processingCostKrw, validTasks.length, 'Recorded processing cost divided by valid task count, rounded down to won'),
  ];

  return {
    schemaVersion: 1,
    measurementKind: 'observed-private-pilot',
    asOf,
    period: { start, end, timezone: 'UTC' },
    sourceDigestSha256: createHash('sha256').update(stableStringify(input)).digest('hex'),
    definitionsVersion: 'iroa-pilot-metrics-1.0.0',
    caveat: 'Operational evidence only. It is not a price, return, liquidity, or listing projection.',
    metrics,
  };
}

export function toCsv(result) {
  const headers = ['metric', 'value', 'unit', 'numerator', 'denominator', 'definition'];
  const rows = result.metrics.map((item) => [item.key, item.value, item.unit, item.numerator, item.denominator, item.definition]);
  return `${[headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')}\n`;
}

async function writeAtomic(path, contents) {
  const temporary = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temporary, contents, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, path);
}

async function main() {
  const { input, outputDir } = parseArgs(process.argv.slice(2));
  const source = JSON.parse(await readFile(input, 'utf8'));
  const result = calculatePilotMetrics(source);
  await writeAtomic(resolve(outputDir, 'iroa-pilot-metrics.json'), `${JSON.stringify(result, null, 2)}\n`);
  await writeAtomic(resolve(outputDir, 'iroa-pilot-metrics.csv'), toCsv(result));
  process.stdout.write(`IROA pilot metrics exported: ${result.sourceDigestSha256}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main();
}
