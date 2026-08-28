import wordmarkUrl from '../../docs/brand/masters/wordmark/iroa-wordmark-color.svg?url';
import cafePaymentUrl from '../../docs/brand/assets/photos/cafe-payment-4064023.jpg?url';
import communityConversationUrl from '../../docs/brand/assets/photos/community-conversation-6647066.jpg?url';
import coverConversationUrl from '../../docs/brand/assets/photos/cover-conversation-6248760.jpg?url';
import telehealthCallUrl from '../../docs/brand/assets/photos/telehealth-call-8376171.jpg?url';
import photoManifestUrl from '../../docs/brand/assets/photos/PHOTO-MANIFEST.md?url';
import whitepaperUrl from '../../docs/whitepaper/exports/IROA_WHITEPAPER_KO.pdf';
import type { HomepageContent } from '../types/home';

export const homeKo: HomepageContent = {
  navigation: [
    { label: '작동 방식', href: '#how-it-works' },
    { label: '활용 사례', href: '#scenarios' },
    { label: '안전과 신뢰', href: '#safety' },
    { label: '생태계', href: '#ecosystem' },
    { label: '네트워크', href: '#network' },
    { label: '기관 도입', href: '#contact' },
  ],
  hero: {
    eyebrow: 'REAL-WORLD ORCHESTRATION FOR EVERYONE',
    title: '말로 요청하면, 현실의 일이 안전하게 완료됩니다.',
    description:
      'IROA는 디지털 접근이 어려운 사람의 요청을 이해하고, 필요한 서비스와 사람을 연결해 실행부터 확인까지 돕는 현실 실행 네트워크입니다.',
    primaryCta: { label: '기관 도입·PoC 상담', href: '#contact' },
    secondaryCta: { label: 'IROA 작동 방식 보기', href: '#how-it-works' },
    trust: ['사용자 승인 중심', '사람에게 연결', '개인정보 최소화', '완료 검증'],
    imageUrl: coverConversationUrl,
    imageAlt: '밝은 실내에서 차를 마시며 편안하게 이야기하는 두 명의 고령자',
  },
  lifecycle: [
    { title: '요청', description: '말·글·터치로 원하는 결과를 표현합니다.' },
    { title: '계획', description: '해야 할 일과 예상 시간·비용을 쉬운 말로 구성합니다.' },
    { title: '선택', description: '가능한 서비스와 사람 중 사용자가 직접 고릅니다.' },
    { title: '승인', description: '결제·제출·민감정보 전송 전 범위를 다시 확인합니다.' },
    { title: '실행', description: '승인된 기관·현장 제공자·실행 공간이 일을 수행합니다.' },
    { title: '검증', description: '예약번호·접수 결과·영수증처럼 외부 결과를 확인합니다.' },
    { title: '복구·사람 인계', description: '실패하면 취소·재시도하거나 승인된 사람에게 연결합니다.' },
  ],
  protections: [
    { title: '사용자 통제', description: '비용과 권한을 이해하고 승인하기 전에는 되돌리기 어려운 일을 실행하지 않습니다.' },
    { title: '사람 연결', description: '자동화가 불확실하거나 사용자가 원하면 보호자·담당자·현장 지원자에게 전환합니다.' },
    { title: '완료 책임', description: '화면 변화가 아니라 실제 서비스의 결과를 확인한 뒤 완료로 기록합니다.' },
  ],
  scenarios: [
    {
      title: '병원 방문 지원',
      quote: '“다음 주 진료를 예약하고, 이동도 도와줘.”',
      description: '예약 후보와 비용을 확인하고 접근 가능한 이동, 방문 전 알림, 귀가 확인까지 하나의 요청으로 이어갑니다.',
      flow: ['진료 시간 확인', '사용자 승인', '이동 지원 연결', '방문·귀가 확인'],
      status: '목표 경험',
      imageUrl: telehealthCallUrl,
      imageAlt: '고령자가 태블릿 화면의 의료진과 영상으로 상담하는 모습',
    },
    {
      title: '생활 서비스 지원',
      quote: '“전등이 고장 났는데 믿을 수 있는 사람을 불러줘.”',
      description: '요청 범위와 예상 비용을 먼저 설명하고, 승인된 제공자의 작업 결과까지 확인합니다.',
      flow: ['요청 확인', '비용 제안', '제공자 연결', '완료 확인'],
      status: '목표 경험',
      imageUrl: cafePaymentUrl,
      imageAlt: '휠체어 이용자가 카페에서 스마트폰으로 결제하는 모습',
    },
    {
      title: '보호자·기관 연계',
      quote: '“오늘 지원 일정이 잘 끝났는지 알려줘.”',
      description: '허용된 범위의 수행 상태만 확인하고 지연이나 이상 상황은 담당자에게 책임 있게 연결합니다.',
      flow: ['권한 확인', '수행 상태 확인', '이상 감지', '사람에게 연결'],
      status: '목표 경험',
      imageUrl: communityConversationUrl,
      imageAlt: '지원자와 고령자가 주방에서 차를 마시며 편안하게 대화하는 모습',
    },
  ],
  institutions: [
    {
      title: '지자체·복지기관',
      value: '분산된 생활 지원 요청과 진행 상태를 하나의 책임 흐름으로 연결합니다.',
      pilot: '이동·방문·생활 지원 요청',
    },
    {
      title: '병원·돌봄기관',
      value: '진료 전후 준비와 보호자·담당자 인계를 사용자의 승인 안에서 이어갑니다.',
      pilot: '예약·이동·귀가 확인',
    },
    {
      title: '기업·프랜차이즈·CSR',
      value: '접근 가능한 서비스 제공과 검증 가능한 지원 프로그램을 함께 설계합니다.',
      pilot: '매장 주문·사회공헌 지원',
    },
  ],
  safety: [
    { title: '사용자 권한', description: '무엇을 요청하고 승인했는지 쉬운 말로 다시 확인합니다.' },
    { title: '정보 보호', description: '필요한 정보만 필요한 곳에 필요한 시간 동안 제공합니다.' },
    { title: '실행 통제', description: '결제·제출·외부 전송은 별도의 확인 지점을 통과합니다.' },
    { title: '사람 중심 회복', description: '실패와 불확실성을 숨기지 않고 사람 연결을 선택지로 제공합니다.' },
    { title: '완료 검증과 정산', description: '외부 결과를 확인한 뒤 보고와 정산을 진행합니다.' },
  ],
  safetyBoundaries: [
    '민감정보는 퍼블릭 블록체인에 기록하지 않습니다.',
    '온체인에는 필요한 경우 최소 정산 기록이나 완료 영수증 해시만 남깁니다.',
    '자동화 신뢰도나 권한이 부족하면 추측하여 실행하지 않습니다.',
    '현재·목표 경험·계획·장기 기능을 명확하게 구분합니다.',
  ],
  ecosystem: [
    { title: '사용자 접점', description: '사용자가 편한 방식으로 요청하고 승인합니다.', items: ['Mobile', 'Watch', 'Kiosk', 'Companion'] },
    { title: 'IROA Agent', description: '요청을 이해하고 계획·선택·승인을 관리합니다.', items: ['요청 이해', '계획', '제안', '승인 관리'] },
    { title: 'Orchestration & Safety Core', description: '상태·권한·복구·완료 책임을 유지합니다.', items: ['상태 관리', '최소 권한', '복구', '완료 검증'] },
    { title: '현실 실행 네트워크', description: '기관과 사람이 실제 서비스를 수행합니다.', items: ['Institution', 'Partner', 'Node', 'Human Support', 'Robot'], status: '장기' },
    { title: '검증 가능한 정산', description: '완료가 확인된 B2B 기여를 정산합니다.', items: ['Base', 'Circle Native USDC'], status: '계획' },
  ],
  settlement: {
    network: 'Base',
    asset: 'Circle Native USDC',
    consumerPayment: '일반 사용자는 원화·카드·계좌·기존 전자지갑을 사용합니다.',
    title: '사용자에게는 단순하게, 기관 정산은 검증 가능하게',
    description: 'Base와 Native USDC는 서비스 전면이 아니라 완료 이후 기관·상점·Node·도움 제공자 사이에서 작동하는 B2B 정산 레이어입니다.',
    steps: [
      { title: '사용자 결제', description: '원화·카드·계좌' },
      { title: '요청과 승인', description: '범위·비용·권한 확인' },
      { title: '현실 실행', description: '기관·상점·제공자 수행' },
      { title: '완료 검증', description: '결과·영수증·분쟁 상태 확인' },
      { title: 'B2B 정산', description: 'Base · Circle Native USDC' },
    ],
    principles: [
      '가스와 지갑은 사용자에게 보이지 않습니다.',
      '자체 스테이블코인은 초기 발행하지 않습니다.',
      '민감정보 원문과 상세 실행 기록은 온체인에 올리지 않습니다.',
      '향후 체인 어댑터로 Solana·BNB 연결 가능성을 보존합니다.',
    ],
  },
  roadmap: [
    { title: 'Foundation', status: '현재', description: '서비스 원칙과 시각 언어를 정립합니다.', evidence: '백서·승인된 BI·기관 파일럿 설계' },
    { title: 'Institutional Pilot', status: '다음', description: '범위를 제한한 실제 요청과 사람 인계를 검증합니다.', evidence: '요청 생명주기·기관 연동·완료 측정' },
    { title: 'Settlement Pilot', status: '계획', description: '완료 증빙과 운영·법률 검토 후 B2B 정산을 시험합니다.', evidence: 'Base · Circle Native USDC' },
    { title: 'Network Expansion', status: '장기', description: '검증된 실행 공간과 파트너 모듈을 확장합니다.', evidence: 'Node·기관 연결·선택적 체인 어댑터' },
  ],
  contact: {
    title: '우리 기관의 첫 번째 IROA 요청을 함께 설계합니다.',
    description: '거대한 시스템 교체보다 대상 사용자와 하나의 현실 업무를 정해 안전한 파일럿부터 시작합니다.',
    intake: ['기관과 대상 사용자', '해결하려는 한 가지 업무', '현재의 실패·지연·사람 인계 방식'],
    privacyNotice: '공식 문의 채널 연결 전에는 개인정보를 수집하지 않습니다.',
    channelLabel: '공식 문의 채널 준비 중',
  },
  assets: {
    wordmarkUrl,
    whitepaperUrl,
    photoManifestUrl,
  },
};
