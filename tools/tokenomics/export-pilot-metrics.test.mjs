import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePilotMetrics } from './export-pilot-metrics.mjs';

function validInput() {
  return {
    schemaVersion: 1,
    asOf: '2026-08-31T00:00:00.000Z',
    period: {
      start: '2026-08-01T00:00:00.000Z',
      end: '2026-08-31T00:00:00.000Z',
      timezone: 'UTC',
    },
    monthlyBudgetWei: '1000000000000000000',
    nodes: [{ nodeId: 'NODE-001', status: 'active' }],
    tasks: [{
      taskId: 'TASK-001',
      nodeId: 'NODE-001',
      operatorId: 'OP-001',
      status: 'valid',
      disputed: false,
      deletionRequired: true,
      deletionVerified: true,
      rewardWei: '500000000000000000',
      processingCostKrw: '30000',
    }],
  };
}

test('rejects direct identifiers hidden in otherwise valid pilot records', () => {
  const withOperatorAddress = validInput();
  withOperatorAddress.tasks[0].operatorAddress = '0x1111111111111111111111111111111111111111';
  assert.throws(() => calculatePilotMetrics(withOperatorAddress), /unexpected field|direct identifier/);

  const withFullName = validInput();
  withFullName.nodes[0].fullName = 'Private Participant';
  assert.throws(() => calculatePilotMetrics(withFullName), /unexpected field|direct identifier/);
});
