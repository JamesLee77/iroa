export type Locale = 'ko' | 'en';

const ko = {
  app: 'NODE 운영자 포털', private: '비공개 검증 환경', noTrading: '공개 거래 불가',
  wallet: '운영자 지갑', connect: '브라우저 지갑 연결', connecting: '연결 중…', disconnect: '연결 해제',
  signIn: '운영자 서명 로그인', signing: '서명 확인 중…', wrongChain: '연결된 네트워크가 다릅니다.',
  switchChain: '올바른 네트워크로 전환', manifestMissing: '배포 정보가 아직 설정되지 않아 온체인 쓰기 기능이 잠겨 있습니다.',
  navEnrollment: 'NODE 등록', navNodes: '내 NODE', navTasks: '작업', navRewards: '보상', navMigrate: 'V1→V2 이전',
  enrollmentTitle: '새 NODE를 안전하게 연결합니다', enrollmentLead: '기기 개인키는 포털로 보내지 않습니다. 기기 주소와 키 해시, 일회용 서명만 사용합니다.',
  deviceAddress: '기기 지갑 주소', deviceKeyHash: '기기 키 해시', trustLevel: '신뢰 수준', policyVersion: '정책 버전',
  createChallenge: '기기 서명 요청 만들기', challengeMessage: '기기에서 서명할 일회용 문장', deviceSignature: '기기 서명',
  register: '온체인 등록 후 포털 연결', registering: '등록 중…', registered: 'NODE 등록이 완료되었습니다.',
  nodesTitle: '내 NODE 상태', nodesLead: '기기별 상태와 최근 연결을 확인합니다. 비밀키와 내부 접속 주소는 표시하지 않습니다.',
  noNodes: '등록된 NODE가 없습니다.', status: '상태', lastSeen: '최근 연결', agentVersion: 'Agent 버전', capacity: '처리 여유', details: '기술 상세',
  suspend: 'NODE 일시 중지', revoke: '기기 키 영구 폐기', confirmImpact: '영향을 이해했습니다', confirmAgain: '이 작업을 다시 확인합니다',
  suspendImpact: '새 작업 배정을 중지합니다. 권한이 있는 운영자만 다시 활성화할 수 있습니다.',
  revokeImpact: '이 기기 키는 영구 폐기되며 되돌릴 수 없습니다. 새 NODE로 다시 등록해야 합니다.',
  apply: '변경 적용', cancel: '취소', actionDone: '상태 변경이 반영되었습니다.',
  tasksTitle: 'NODE 작업 현황', tasksLead: '내 NODE에 배정된 합성 검증 작업만 표시합니다.', noTasks: '배정된 작업이 없습니다.', taskId: '작업 번호', updated: '마지막 변경',
  rewardsTitle: '검증된 NODE 보상', rewardsLead: '서버의 안내 상태가 아니라 온체인 root와 claim 여부를 다시 확인한 뒤 청구합니다.',
  noRewards: '현재 확인할 보상 기록이 없습니다.', claimable: '청구 가능', claimed: '청구 완료', excluded: '정산 제외', claim: '보상 청구', claiming: '청구 중…',
  score: '점수', amount: '청구 금액', validatedTasks: '검증 작업', resultQuality: '결과 품질', accessibility: '접근성 품질', securityGate: '보안 기준',
  reasons: '제외 사유', proofDetails: '증명 상세', transaction: '거래 해시',
  migrateTitle: 'IROA V1을 V2로 1:1 이전', migrateLead: '감사 후 V2 이전이 활성화된 경우에만 사용할 수 있습니다. 승인과 이전은 별도 거래입니다.',
  migrationUnavailable: 'V2 이전 배포 정보가 아직 없습니다.', v1Balance: 'V1 잔액', v2Balance: 'V2 잔액', amountInput: '이전할 V1 수량',
  approve: '정확한 수량 승인', approving: '승인 중…', migrate: 'V2로 이전', migrating: '이전 중…', allowanceReady: '승인 완료', allowanceNeeded: '먼저 정확한 수량을 승인하세요.',
  burned: '이전으로 소각된 V1', minted: '이전으로 발행된 V2', combinedSupply: 'V1+V2 합산 공급', partialHelp: '잔액 일부만 입력해 부분 이전할 수 있습니다.',
  error: '요청을 완료할 수 없습니다. 상태를 새로 확인한 뒤 다시 시도해 주세요.', sessionExpired: '운영자 세션이 끝났습니다. 다시 서명해 주세요.',
  refresh: '새로 확인', loading: '불러오는 중…', language: 'English', skip: '본문으로 건너뛰기', network: '선택된 네트워크', writeLocked: '쓰기 잠김', writeReady: '쓰기 가능',
} as const;

const en: Record<keyof typeof ko, string> = {
  app: 'NODE Operator Portal', private: 'Private validation environment', noTrading: 'Public trading unavailable',
  wallet: 'Operator wallet', connect: 'Connect browser wallet', connecting: 'Connecting…', disconnect: 'Disconnect',
  signIn: 'Sign in with operator signature', signing: 'Checking signature…', wrongChain: 'The connected network is incorrect.',
  switchChain: 'Switch to the correct network', manifestMissing: 'Deployment data is not configured, so onchain writes are locked.',
  navEnrollment: 'Enroll NODE', navNodes: 'My NODEs', navTasks: 'Tasks', navRewards: 'Rewards', navMigrate: 'V1→V2 migration',
  enrollmentTitle: 'Connect a new NODE safely', enrollmentLead: 'The device private key never enters this portal. Only its address, key hash, and one-time signature are used.',
  deviceAddress: 'Device wallet address', deviceKeyHash: 'Device key hash', trustLevel: 'Trust level', policyVersion: 'Policy version',
  createChallenge: 'Create device signing request', challengeMessage: 'One-time message to sign on the device', deviceSignature: 'Device signature',
  register: 'Register onchain and connect portal', registering: 'Registering…', registered: 'NODE enrollment is complete.',
  nodesTitle: 'My NODE status', nodesLead: 'Review each device state and last connection. Private keys and internal endpoints are never displayed.',
  noNodes: 'No NODEs are enrolled.', status: 'Status', lastSeen: 'Last seen', agentVersion: 'Agent version', capacity: 'Capacity', details: 'Technical details',
  suspend: 'Suspend NODE', revoke: 'Permanently revoke device key', confirmImpact: 'I understand the impact', confirmAgain: 'I confirm this action again',
  suspendImpact: 'Stops new task assignment. Only an authorized operator can reactivate it.', revokeImpact: 'This device key is permanently revoked and cannot be restored. Enroll a new NODE to continue.',
  apply: 'Apply change', cancel: 'Cancel', actionDone: 'The state change was applied.',
  tasksTitle: 'NODE task status', tasksLead: 'Only synthetic validation tasks assigned to your NODEs are displayed.', noTasks: 'No tasks are assigned.', taskId: 'Task reference', updated: 'Last changed',
  rewardsTitle: 'Verified NODE rewards', rewardsLead: 'Claims are checked against the onchain root and claim state, not an unsigned server label.',
  noRewards: 'No reward records are available.', claimable: 'Claimable', claimed: 'Claimed', excluded: 'Excluded', claim: 'Claim reward', claiming: 'Claiming…',
  score: 'Score', amount: 'Claim amount', validatedTasks: 'Validated tasks', resultQuality: 'Result quality', accessibility: 'Accessibility quality', securityGate: 'Security gate',
  reasons: 'Exclusion reasons', proofDetails: 'Proof details', transaction: 'Transaction hash',
  migrateTitle: 'Migrate IROA V1 to V2 at 1:1', migrateLead: 'Available only after audited V2 migration is activated. Approval and migration are separate transactions.',
  migrationUnavailable: 'V2 migration deployment data is not available.', v1Balance: 'V1 balance', v2Balance: 'V2 balance', amountInput: 'V1 amount to migrate',
  approve: 'Approve exact amount', approving: 'Approving…', migrate: 'Migrate to V2', migrating: 'Migrating…', allowanceReady: 'Approval complete', allowanceNeeded: 'Approve the exact amount first.',
  burned: 'V1 burned by migration', minted: 'V2 minted by migration', combinedSupply: 'Combined V1+V2 supply', partialHelp: 'Enter less than your balance to make a partial migration.',
  error: 'The request could not be completed. Refresh the state and try again.', sessionExpired: 'Your operator session ended. Sign in again.',
  refresh: 'Refresh', loading: 'Loading…', language: '한국어', skip: 'Skip to main content', network: 'Selected network', writeLocked: 'Writes locked', writeReady: 'Writes enabled',
};

export type CopyKey = keyof typeof ko;

export function t(locale: Locale, key: CopyKey): string {
  return (locale === 'ko' ? ko : en)[key];
}

export function initialLocale(): Locale {
  const saved = localStorage.getItem('iroa-operator-locale');
  if (saved === 'ko' || saved === 'en') return saved;
  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export function storeLocale(locale: Locale): void {
  localStorage.setItem('iroa-operator-locale', locale);
  document.documentElement.lang = locale;
}
