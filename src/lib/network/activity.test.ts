import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import { activityLines, describeEvent, type ActivityTemplates } from './activity';
import type { NetworkEvent } from './events';

const templates: ActivityTemplates = {
  registered: '{level} NODE {id} 등록 · 승인 대기',
  approved: 'NODE {id} 승인',
  suspended: 'NODE {id} 정지',
  revoked: 'NODE {id} 폐기',
  reinstated: 'NODE {id} 재개',
  rootProposed: '{epoch} 에폭 결산 루트 제안 · 이의 창 열림',
  rootFinalized: '{epoch} 에폭 결산 확정',
  rewardClaimed: '{epoch} 에폭 보상 청구 1건',
};

const nodeId = ('0x' + 'abcdef12'.padEnd(64, '0')) as Hex;
const tx = ('0x' + 'ff'.repeat(32)) as Hex;
const base = { blockNumber: 5n, logIndex: 0, transactionHash: tx, timestamp: 1 };

describe('activity sentences', () => {
  it('names a NODE by eight characters of its id and never by a wallet', () => {
    const text = describeEvent({ ...base, kind: 'NodeRegistered', nodeId, trustLevel: 2 }, templates);
    expect(text).toBe('N2 NODE abcdef12 등록 · 승인 대기');
  });

  it('tells approval, suspension, revocation, and reinstatement apart', () => {
    const change = (previousStatus: 0 | 1 | 2 | 3, newStatus: 0 | 1 | 2 | 3) =>
      describeEvent({ ...base, kind: 'NodeStatusChanged', nodeId, previousStatus, newStatus }, templates);
    expect(change(0, 1)).toBe('NODE abcdef12 승인');
    expect(change(1, 2)).toBe('NODE abcdef12 정지');
    expect(change(2, 3)).toBe('NODE abcdef12 폐기');
    expect(change(2, 1)).toBe('NODE abcdef12 재개');
  });

  it('prints a claim as a count of one, with no amount', () => {
    const event: NetworkEvent = { ...base, kind: 'RewardClaimed', epoch: 7n, nodeId };
    expect(describeEvent(event, templates)).toBe('7 에폭 보상 청구 1건');
  });

  it('keeps the newest ten lines and links each to its transaction', () => {
    const events: NetworkEvent[] = Array.from({ length: 12 }, (_, index) => ({
      ...base,
      kind: 'RootFinalized',
      epoch: BigInt(index),
      revision: 0,
      blockNumber: BigInt(index),
    }));
    const lines = activityLines(events, templates, 'https://sepolia.basescan.org');
    expect(lines).toHaveLength(10);
    expect(lines[0].text).toBe('11 에폭 결산 확정');
    expect(lines[0].href).toBe(`https://sepolia.basescan.org/tx/${tx}`);
  });
});
