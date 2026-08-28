export type PublicStatus = 'current' | 'next' | 'planned' | 'validation' | 'research';

export const STATUS_LABELS: Record<PublicStatus, string> = {
  current: '현재',
  next: '다음',
  planned: '계획',
  validation: '검증 중',
  research: '장기 연구',
};

export const getStatusLabel = (status: PublicStatus) => STATUS_LABELS[status];
