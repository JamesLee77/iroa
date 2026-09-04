export interface ProtocolStage {
  id: 'request' | 'task-capsule' | 'verified-node' | 'proof-receipt' | 'base-settlement';
  label: string;
  description: string;
  /** Short form for the hero panel, where the full description would repeat
   *  the protocol section directly below it. */
  summary: string;
  network?: 'Base';
  asset?: 'Circle Native USDC';
}

export const PROTOCOL_STAGES: readonly ProtocolStage[] = [
  {
    id: 'request',
    label: 'Request',
    description: '사용자가 음성·글·터치로 목표를 표현하고, 중요한 실행 전에는 직접 승인합니다.',
    summary: '음성·글·터치, 사용자 승인',
  },
  {
    id: 'task-capsule',
    label: 'Task Capsule',
    description: '목적, 일회성 권한, 데이터 등급, 만료 시간과 확인 지점을 요청별로 묶습니다.',
    summary: '일회성 권한 · 데이터 D2 · 만료',
  },
  {
    id: 'verified-node',
    label: 'Verified Node',
    description: '요청에 맞는 신뢰 수준과 실행 상태를 확인한 Node가 제한된 작업을 수행합니다.',
    summary: '신뢰 수준 확인 후 제한 실행',
  },
  {
    id: 'proof-receipt',
    label: 'Proof Receipt',
    description: '외부 결과와 정책 기준을 확인하고, 필요한 최소 증빙만 남깁니다.',
    summary: '외부 결과 확인 · 최소 증빙',
  },
  {
    id: 'base-settlement',
    label: 'Base Settlement',
    description: '배포·법률·보안 검토 이후의 B2B 정산 방향입니다.',
    summary: '검토 이후의 B2B 정산',
    network: 'Base',
    asset: 'Circle Native USDC',
  },
];

export const PROTOCOL_STAGES_EN: readonly ProtocolStage[] = [
  {
    id: 'request',
    label: 'Request',
    description: 'The user states a goal by voice, text, or touch and directly approves every consequential action.',
    summary: 'Voice, text, or touch, then approval',
  },
  {
    id: 'task-capsule',
    label: 'Task Capsule',
    description: 'Purpose, one-time permission, data class, expiry, and confirmation points are bound to each request.',
    summary: 'One-time scope · Data D2 · Expiry',
  },
  {
    id: 'verified-node',
    label: 'Verified Node',
    description: 'A Node with the required trust level and verified runtime performs only the bounded task.',
    summary: 'Trust checked, then scoped execution',
  },
  {
    id: 'proof-receipt',
    label: 'Proof Receipt',
    description: 'External outcomes and policy requirements are checked, leaving only the minimum evidence required.',
    summary: 'External result · Minimum proof',
  },
  {
    id: 'base-settlement',
    label: 'Base Settlement',
    description: 'A future B2B settlement direction, subject to deployment, legal, and security review.',
    summary: 'B2B settlement after review',
    network: 'Base',
    asset: 'Circle Native USDC',
  },
];

export const PRIVACY_BOUNDARY = {
  onChain: ['정책 버전', '결과 무결성 해시', '개인과 분리된 최소 정산 증빙'],
  offChain: ['개인정보 원문', '대화·건강·예약 상세 기록', '비밀번호·OTP·결제키'],
  statement: '개인정보 원문은 오프체인에 머뭅니다.',
} as const;

export const PRIVACY_BOUNDARY_EN = {
  onChain: ['Policy version', 'Outcome-integrity hash', 'Minimal settlement proof separated from identity'],
  offChain: ['Raw personal data', 'Conversation, health, and booking details', 'Passwords, OTPs, and payment keys'],
  statement: 'Raw personal data remains off-chain.',
} as const;
