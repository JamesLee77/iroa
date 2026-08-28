export interface ProtocolStage {
  id: 'request' | 'task-capsule' | 'verified-node' | 'proof-receipt' | 'base-settlement';
  label: string;
  description: string;
  network?: 'Base';
  asset?: 'Circle Native USDC';
}

export const PROTOCOL_STAGES: readonly ProtocolStage[] = [
  {
    id: 'request',
    label: 'Request',
    description: '사용자가 음성·글·터치로 목표를 표현하고, 중요한 실행 전에는 직접 승인합니다.',
  },
  {
    id: 'task-capsule',
    label: 'Task Capsule',
    description: '목적, 일회성 권한, 데이터 등급, 만료 시간과 확인 지점을 요청별로 묶습니다.',
  },
  {
    id: 'verified-node',
    label: 'Verified Node',
    description: '요청에 맞는 신뢰 수준과 실행 상태를 확인한 Node가 제한된 작업을 수행합니다.',
  },
  {
    id: 'proof-receipt',
    label: 'Proof Receipt',
    description: '외부 결과와 정책 기준을 확인하고, 필요한 최소 증빙만 남깁니다.',
  },
  {
    id: 'base-settlement',
    label: 'Base Settlement',
    description: '배포·법률·보안 검토 이후의 B2B 정산 방향입니다.',
    network: 'Base',
    asset: 'Circle Native USDC',
  },
];

export const PRIVACY_BOUNDARY = {
  onChain: ['정책 버전', '결과 무결성 해시', '개인과 분리된 최소 정산 증빙'],
  offChain: ['개인정보 원문', '대화·건강·예약 상세 기록', '비밀번호·OTP·결제키'],
  statement: '개인정보 원문은 오프체인에 머뭅니다.',
} as const;
