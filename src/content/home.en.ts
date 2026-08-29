import wordmarkUrl from '../../docs/brand/masters/wordmark/iroa-wordmark-color.svg?url';
import whitepaperUrl from '../../docs/whitepaper/exports/IROA_WHITEPAPER_EN.pdf';
import { PRIVACY_BOUNDARY_EN } from '../lib/protocol/flow';
import type { HomepageContent } from '../types/home';

export const homeEn: HomepageContent = {
  navigation: [
    { label: 'Protocol', href: '#protocol' },
    { label: 'Network', href: '#network' },
    { label: 'Economy', href: '#economy' },
    { label: 'Whitepaper', href: '#whitepaper-entry' },
    { label: 'Roadmap', href: '#roadmap' },
  ],
  hero: {
    eyebrow: 'IROA NETWORK ATLAS',
    title: 'A verifiable execution network for the real world.',
    description: 'IROA is a protocol direction that coordinates user-approved real-world tasks through AI, people, institutions, and request-specific verified Nodes—through to a confirmed outcome.',
    primaryCta: { label: 'Explore the network', href: '#protocol' },
    secondaryCta: { label: 'Read the whitepaper', href: '/en/whitepaper' },
    facts: [
      { label: 'Base Primary Network', status: 'planned' },
      { label: 'Native USDC Settlement', status: 'planned' },
      { label: 'Personal Data Off-chain', status: 'current' },
      { label: 'IROA Rewards · In Validation', status: 'validation' },
    ],
    trust: ['User-controlled approval', 'Data minimization', 'Outcome verification'],
  },
  lifecycle: [
    { title: 'Request', description: 'State the desired outcome by voice, text, or touch.' },
    { title: 'Plan', description: 'Explain the work, expected time, and cost in plain language.' },
    { title: 'Choose', description: 'Let the user choose among available services and people.' },
    { title: 'Approve', description: 'Reconfirm scope before payment, submission, or sensitive-data transfer.' },
    { title: 'Execute', description: 'Run within limited permissions in an approved execution space.' },
    { title: 'Verify', description: 'Mark complete only after checking the external outcome.' },
    { title: 'Recover or hand off', description: 'Cancel, retry, or transfer to a person when uncertain.' },
  ],
  protections: [
    { title: 'User control', description: 'Consequential actions require clear, renewed approval.' },
    { title: 'Least privilege', description: 'Permissions are limited to the request and time required.' },
    { title: 'Outcome verification', description: 'Verify external results, not merely a changed screen.' },
  ],
  scenarios: [{ title: 'Booking and mobility support', quote: '“Prepare my hospital visit next week.”', description: 'A direction for validating bounded requests and approval points.', flow: ['Confirm request', 'User approval', 'Bounded execution', 'External outcome check'], status: 'validation' }],
  institutions: [{ title: 'Institution and field validation', value: 'Define the target users and one real-world task before designing the validation scope.', pilot: 'Request · approval · outcome check' }],
  safety: [{ title: 'Personal-data boundary', description: 'Raw personal data remains off-chain.' }, { title: 'Human handoff', description: 'Expose uncertainty and failure, then return control to a person.' }],
  safetyBoundaries: ['Raw personal data remains off-chain.', 'When confidence or authority is insufficient, the system does not guess and act.'],
  ecosystem: [{ title: 'Execution network', description: 'Separate and verify the roles of Nodes, institutions, and people.', items: ['Interaction', 'Control', 'Execution', 'Settlement'], status: 'planned' }],
  protocol: {
    title: 'Four planes connect human intent to real-world outcomes.',
    description: 'Each plane has a distinct role. IROA never presents an external service’s authority or outcome as its own.',
    planes: [
      { id: 'interaction', label: 'Interaction Plane', status: 'validation', description: 'Captures user intent and approval through phone, watch, mobile, kiosk, and companion devices.' },
      { id: 'control', label: 'Control Plane', status: 'validation', description: 'Separates request state, consent, policy, and trust levels.' },
      { id: 'execution', label: 'Execution Plane', status: 'validation', description: 'Runs an isolated Task Capsule with minimum permissions and cleans up when it ends.' },
      { id: 'settlement', label: 'Settlement Plane', status: 'planned', description: 'Explores a future B2B settlement boundary based on verified completion evidence.' },
    ],
  },
  network: {
    title: 'Nodes and evidence have separate, verifiable roles.',
    description: 'No Node controls the entire request. User approval, bounded authority, and external outcome checks remain distinct boundaries.',
    node: { level: 'N2', status: 'validation', description: 'N2 is the design and review stage for approved access points such as kiosks, welfare centers, and companion devices.' },
    proof: {
      result: 'A task is not complete until its external outcome is verified.',
      proofId: 'Proof identifiers are published only when deployment and operation can support the claim.',
      policyVersion: 'Policy version is kept as separate minimum evidence.',
      disputeState: 'Uncertain outcomes move to human review and dispute handling.',
    },
    privacy: { status: 'current', ...PRIVACY_BOUNDARY_EN },
  },
  settlement: {
    title: 'Consumer payment and B2B settlement remain separate.',
    status: 'planned', network: 'Base', asset: 'Circle Native USDC',
    consumerPayment: 'Consumers use KRW, cards, bank transfers, and established payment channels.',
    description: 'Base and Circle Native USDC are a future B2B settlement direction, subject to deployment, legal, security, and completion-evidence reviews. They are not live settlement infrastructure.',
    boundaries: ['Gas and wallet management are not consumer requirements.', 'IROA will not issue its own stablecoin initially.', 'Raw personal data and detailed execution records are not placed on-chain.'],
    steps: [
      { title: 'Consumer payment', description: 'KRW · card · bank transfer · existing payment channels' },
      { title: 'Request and approval', description: 'Confirm scope, cost, and permission' },
      { title: 'Outcome check', description: 'Check external outcome and dispute state' },
      { title: 'B2B settlement', description: 'Base · Circle Native USDC · planned' },
    ],
    principles: ['Gas and wallets are not consumer requirements.', 'Raw personal data is never recorded on-chain.'],
  },
  economy: {
    title: 'Reward design begins with service sustainability.',
    description: 'IROA explores rewards for verified execution, accessibility quality, security, and deletion compliance. Access to essential support never depends on token ownership.',
    rewards: { label: 'IROA Rewards', status: 'validation', description: 'IROA Rewards remain in validation until issuance, legal review, deployment, and audit evidence are complete.' },
    boundaries: ['No promise of price, yield, liquidity, or exchange listing.', 'Verified contribution is evaluated together with dispute, cancellation, and quality rules.', 'Token ownership is not a condition for essential daily support.'],
  },
  whitepaper: {
    title: 'IROA.AI Whitepaper', version: '1.0', language: 'Korean', status: 'current',
    description: 'The complete English edition of the IROA.AI whitepaper. The Korean edition remains the controlling version.',
    primaryCta: { label: 'Read the web whitepaper', href: '/en/whitepaper' },
    chapters: [
      { label: 'Core Declaration', href: '/en/whitepaper/core-declaration' },
      { label: 'Secure Execution Space', href: '/en/whitepaper/secure-execution-space' },
      { label: 'Token Economy', href: '/en/whitepaper/token-economy' },
    ],
  },
  roadmap: [
    { title: 'Foundation', status: 'current', description: 'Publish the whitepaper and shared principles, and fix the public status language for each capability.', entryCriteria: 'Public information separates operational evidence from plans.', evidence: 'Whitepaper v1.0 and published design principles' },
    { title: 'Request Validation', status: 'next', description: 'Validate bounded requests that require approval, recovery, and human handoff.', entryCriteria: 'Users understand and can confirm goals and outcomes.', evidence: 'Request lifecycle and field-validation criteria' },
    { title: 'Secure Execution', status: 'planned', description: 'Design and review per-request isolation, one-time permission, and deletion confirmation.', entryCriteria: 'Residual sensitive data and duplicate execution are controlled.', evidence: 'Task Capsule and secure execution principles' },
    { title: 'Network Research', status: 'research', description: 'Long-term research on institutional links, execution-space rewards, companion devices, and high-risk robotics.', entryCriteria: 'Legal, safety, and field evidence comes first.', evidence: 'Node trust levels and staged safety review' },
  ],
  contact: {
    title: 'Design the validation scope with institutions and practitioners.', status: 'planned',
    description: 'Future participation begins with the target users, one real-world task, and the current failure, delay, and human-handoff process.',
    intake: ['Institution and target users', 'One real-world task to validate', 'Current failure, delay, and human-handoff process'],
    privacyNotice: 'No personal data is collected until an official contact channel is available.',
    channelLabel: 'Official contact channel in preparation', whitepaperHref: '/en/whitepaper',
  },
  assets: { wordmarkUrl, whitepaperUrl },
};
