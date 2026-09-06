import wordmarkUrl from '../../docs/brand/masters/wordmark/iroa-wordmark-color.svg?url';
import whitepaperUrl from '../../docs/whitepaper/exports/IROA_WHITEPAPER_KO.pdf';
import { PRIVACY_BOUNDARY } from '../lib/protocol/flow';
import type { HomepageContent } from '../types/home';

export const homeKo: HomepageContent = {
  navigation: [
    { label: '프로토콜', href: '#protocol' },
    { label: '네트워크', href: '/node' },
    { label: '이코노미', href: '#economy' },
    { label: '백서', href: '#whitepaper-entry' },
    { label: '로드맵', href: '#roadmap' },
  ],
  hero: {
    eyebrow: 'IROA NETWORK ATLAS',
    title: '현실 세계를 위한 검증 가능한 실행 네트워크.',
    description:
      'IROA는 AI, 사람, 기관, 그리고 요청별로 검증되는 Node를 연결해 사용자가 승인한 현실의 일을 결과까지 조정하는 프로토콜 방향입니다.',
    primaryCta: { label: '네트워크 살펴보기', href: '#protocol' },
    secondaryCta: { label: '웹 백서 읽기', href: '/whitepaper' },
    facts: [
      { label: 'Base Primary Network', status: 'planned' },
      { label: 'Native USDC Settlement', status: 'planned' },
      { label: 'Personal Data Off-chain', status: 'current' },
      { label: 'IROA Rewards · 검증 중', status: 'validation' },
    ],
    trust: ['사용자 승인 중심', '개인정보 최소화', '결과 검증'],
  },
  lifecycle: [
    { title: '요청', description: '말·글·터치로 원하는 결과를 표현합니다.' },
    { title: '계획', description: '해야 할 일과 예상 시간·비용을 쉬운 말로 구성합니다.' },
    { title: '선택', description: '가능한 서비스와 사람 중 사용자가 직접 고릅니다.' },
    { title: '승인', description: '결제·제출·민감정보 전송 전 범위를 다시 확인합니다.' },
    { title: '실행', description: '승인된 실행 공간이 제한된 권한 안에서 일을 수행합니다.' },
    { title: '검증', description: '외부 결과를 확인한 뒤에만 완료로 기록합니다.' },
    { title: '복구·사람 인계', description: '불확실하면 취소·재시도하거나 사람에게 연결합니다.' },
  ],
  protections: [
    { title: '사용자 통제', description: '되돌리기 어려운 실행은 이해 가능한 방식으로 다시 승인합니다.' },
    { title: '최소 권한', description: '요청에 필요한 범위와 시간만 권한을 사용합니다.' },
    { title: '결과 검증', description: '화면 변화가 아니라 외부 결과를 확인합니다.' },
  ],
  scenarios: [
    {
      title: '예약·이동 지원',
      quote: '“다음 주 병원 일정을 준비해줘.”',
      description: '제한된 요청 범위와 승인 지점을 검증하는 방향입니다.',
      flow: ['요청 확인', '사용자 승인', '제한된 실행', '외부 결과 확인'],
      status: 'validation',
    },
  ],
  institutions: [
    {
      title: '기관·현장 검증',
      value: '대상 사용자와 하나의 현실 업무를 정해 검증 범위를 설계합니다.',
      pilot: '요청·승인·결과 확인',
    },
  ],
  safety: [
    { title: '개인정보 경계', description: '개인정보 원문은 오프체인에 둡니다.' },
    { title: '사람 인계', description: '불확실성과 실패를 숨기지 않고 사람에게 연결합니다.' },
  ],
  safetyBoundaries: [
    '개인정보 원문은 오프체인에 머뭅니다.',
    '자동화 신뢰도나 권한이 부족하면 추측하여 실행하지 않습니다.',
  ],
  ecosystem: [
    {
      title: '실행 네트워크',
      description: 'Node와 기관·사람의 역할을 분리해 검증합니다.',
      items: ['Interaction', 'Control', 'Execution', 'Settlement'],
      status: 'planned',
    },
  ],
  protocol: {
    title: '사람의 의사와 현실의 결과를 연결하는 네 개의 영역',
    description:
      '각 영역은 역할을 나누며, 외부 서비스의 권한과 결과를 IROA가 소유한 것처럼 표현하지 않습니다.',
    planes: [
      {
        id: 'interaction',
        label: 'Interaction Plane',
        status: 'validation',
        description: '전화·워치·모바일·키오스크·반려기기에서 사용자의 의사와 승인을 받습니다.',
      },
      {
        id: 'control',
        label: 'Control Plane',
        status: 'validation',
        description: '요청 상태, 동의, 정책, 신뢰 수준을 분리해 관리합니다.',
      },
      {
        id: 'execution',
        label: 'Execution Plane',
        status: 'validation',
        description: '격리된 Task Capsule이 필요한 최소 권한으로 실행되고 종료 후 정리됩니다.',
      },
      {
        id: 'settlement',
        label: 'Settlement Plane',
        status: 'planned',
        description: '검증된 완료 증빙을 바탕으로 향후 B2B 정산 경계를 검토합니다.',
      },
    ],
  },
  network: {
    title: 'Node와 증빙은 역할을 나누어 검증합니다.',
    description:
      'Node는 요청 전체를 독점하지 않으며, 사용자 승인·제한 권한·외부 결과 확인을 각각의 경계로 둡니다.',
    directory: {
      summary: '신뢰 수준은 N0 공개 연산부터 N4 개인 승인까지 다섯 등급이며, 운영자는 자격 확인과 승인을 거쳐 NODE를 운영합니다.',
      label: 'NODE 네트워크 자세히 보기',
      href: '/node',
    },
    node: {
      level: 'N2',
      status: 'validation',
      description: 'N2는 키오스크·복지관·반려기기 같은 승인 접근 거점의 검증 기준을 설계·검토하는 단계입니다.',
    },
    proof: {
      result: '외부 결과 확인 전에는 완료로 표시하지 않습니다.',
      proofId: '증빙 식별자는 배포·운영 근거가 있을 때만 공개합니다.',
      policyVersion: '정책 버전은 최소 증빙으로 분리합니다.',
      disputeState: '불확실한 결과는 사람 검토와 분쟁 절차로 넘깁니다.',
    },
    privacy: {
      status: 'current',
      ...PRIVACY_BOUNDARY,
    },
  },
  settlement: {
    title: '사용자 결제와 B2B 정산을 분리합니다.',
    status: 'planned',
    network: 'Base',
    asset: 'Circle Native USDC',
    consumerPayment: '소비자 결제는 원화, 카드, 계좌이체와 기존 결제 채널을 사용합니다.',
    description:
      'Base와 Circle Native USDC는 배포·법률·보안 검토와 완료 증빙이 갖춰진 뒤 검토할 B2B 정산 방향이며, 현재 운영 중인 정산이 아닙니다.',
    boundaries: [
      '가스와 지갑 관리는 소비자 이용 조건이 아닙니다.',
      '자체 스테이블코인은 초기 발행하지 않습니다.',
      '개인정보 원문과 상세 실행 기록은 온체인에 올리지 않습니다.',
    ],
    steps: [
      { title: '소비자 결제', description: '원화·카드·계좌이체·기존 결제 채널' },
      { title: '요청과 승인', description: '범위·비용·권한 확인' },
      { title: '결과 확인', description: '외부 결과와 분쟁 상태 확인' },
      { title: 'B2B 정산', description: 'Base · Circle Native USDC · 계획' },
    ],
    principles: [
      '가스와 지갑은 소비자 이용 조건이 아닙니다.',
      '개인정보 원문은 온체인에 기록하지 않습니다.',
    ],
  },
  economy: {
    title: '보상 설계는 서비스의 지속 가능성을 먼저 검증합니다.',
    description:
      'IROA 보상은 검증된 실행, 접근성 품질, 보안과 삭제 준수의 기여를 검토하는 방향이며, 이용자의 필수 서비스 접근을 보유량과 연결하지 않습니다.',
    rewards: {
      label: 'IROA Rewards',
      status: 'validation',
      description: 'IROA 보상은 발행, 법률 검토, 배포, 감사 근거가 갖춰질 때까지 검증 중입니다.',
    },
    boundaries: [
      '가격, 수익률, 유동성, 거래소 상장을 약속하지 않습니다.',
      '검증된 기여와 분쟁·취소·품질 기준을 함께 검토합니다.',
      '토큰 보유 여부는 생활 지원의 필수 조건이 아닙니다.',
    ],
  },
  whitepaper: {
    title: 'IROA.AI 백서',
    version: '1.0',
    language: 'Korean',
    status: 'current',
    description: '한국어 원문을 기준으로 발행한 IROA.AI 백서입니다.',
    primaryCta: { label: '웹 백서 읽기', href: '/whitepaper' },
    chapters: [
      { label: '핵심 선언', href: '/whitepaper/core-declaration' },
      { label: '보안 실행 공간', href: '/whitepaper/secure-execution-space' },
      { label: '토큰 이코노미', href: '/whitepaper/token-economy' },
    ],
  },
  roadmap: [
    {
      title: 'Foundation',
      status: 'current',
      description: '백서와 공통 원칙을 공개하고, 각 기능의 상태 언어를 고정합니다.',
      entryCriteria: '공개 정보가 운영 증거와 계획을 구분합니다.',
      evidence: '백서 v1.0과 공개 설계 원칙',
    },
    {
      title: 'Request Validation',
      status: 'next',
      description: '사용자 승인, 실패 복구, 사람 인계가 필요한 요청을 제한된 범위에서 검증합니다.',
      entryCriteria: '사용자가 목표와 결과를 이해하고 확인할 수 있습니다.',
      evidence: '요청 생명주기와 현장 검증 기준',
    },
    {
      title: 'Secure Execution',
      status: 'planned',
      description: '요청별 격리 실행, 일회성 권한, 삭제 확인을 설계·검토합니다.',
      entryCriteria: '민감정보 잔존과 중복 실행을 통제합니다.',
      evidence: 'Task Capsule과 보안 실행 공간 원칙',
    },
    {
      title: 'Node Network',
      status: 'validation',
      description: '승인형 NODE 등록, 결과·삭제 확인서, 월별 결산과 보상 청구를 Base Sepolia에서 검증하고, 비공개 참여자 파일럿과 독립 감사를 거쳐 V2로 이전합니다. 반려기기와 로봇의 고위험 경계는 장기 연구로 남깁니다.',
      entryCriteria: 'Base Sepolia 배포 manifest와 모듈 검증이 완료됩니다.',
      evidence: '파일럿 단계 A–E와 NODE 네트워크 페이지',
    },
  ],
  contact: {
    title: '기관과 현장의 검증 범위를 함께 설계합니다.',
    status: 'planned',
    description:
      '향후 참여 논의는 대상 사용자, 한 가지 현실 업무, 현재의 실패·지연·사람 인계 방식을 기준으로 시작합니다.',
    intake: ['기관과 대상 사용자', '검증하려는 한 가지 현실 업무', '현재의 실패·지연·사람 인계 방식'],
    privacyNotice: '공식 문의 채널이 마련되기 전에는 개인정보를 수집하지 않습니다.',
    channelLabel: '공식 문의 채널 준비 중',
    whitepaperHref: '/whitepaper',
  },
  assets: {
    wordmarkUrl,
    whitepaperUrl,
  },
};
