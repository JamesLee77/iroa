import { describe, expect, it } from 'vitest';
import { getStatusLabel, STATUS_LABELS } from './status';

describe('public status vocabulary', () => {
  it('labels the approved public status states', () => {
    expect(getStatusLabel('current')).toBe('현재');
    expect(getStatusLabel('validation')).toBe('검증 중');
    expect(STATUS_LABELS).toEqual({
      current: '현재',
      next: '다음',
      planned: '계획',
      validation: '검증 중',
      research: '장기 연구',
    });
  });
});
