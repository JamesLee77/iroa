import type { PublicStatus } from '../lib/content/status';

export type NavigationHref = `#${string}` | `/${string}`;

export interface NavigationItem {
  label: string;
  href: NavigationHref;
}

export interface HeroFact {
  label: string;
  status: PublicStatus;
}

export interface HeroContent {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: NavigationItem;
  secondaryCta: NavigationItem;
  facts: HeroFact[];
  trust: string[];
  imageUrl: string;
  imageAlt: string;
}

export interface LifecycleStep {
  title: string;
  description: string;
}

export interface ProtectionRail {
  title: string;
  description: string;
}

export interface ScenarioStory {
  title: string;
  quote: string;
  description: string;
  flow: string[];
  status: PublicStatus;
  imageUrl: string;
  imageAlt: string;
}

export interface InstitutionModel {
  title: string;
  value: string;
  pilot: string;
}

export interface SafetyLayer {
  title: string;
  description: string;
}

export interface EcosystemLayer {
  title: string;
  description: string;
  items: string[];
  status?: PublicStatus;
}

export interface ProtocolPlane {
  id: 'interaction' | 'control' | 'execution' | 'settlement';
  label: string;
  status: PublicStatus;
  description: string;
}

export interface ProtocolContent {
  title: string;
  description: string;
  planes: ProtocolPlane[];
}

export interface NodeProofContent {
  title: string;
  description: string;
  node: {
    level: 'N0' | 'N1' | 'N2' | 'N3' | 'N4';
    status: PublicStatus;
    description: string;
  };
  proof: {
    result: string;
    proofId: string;
    policyVersion: string;
    disputeState: string;
  };
  privacy: {
    status: PublicStatus;
    statement: string;
    onChain: readonly string[];
    offChain: readonly string[];
  };
}

export interface SettlementStep {
  title: string;
  description: string;
}

export interface SettlementContent {
  status: PublicStatus;
  network: 'Base';
  asset: 'Circle Native USDC';
  consumerPayment: string;
  title: string;
  description: string;
  boundaries: string[];
  steps: SettlementStep[];
  principles: string[];
}

export interface EconomyContent {
  title: string;
  description: string;
  rewards: {
    label: string;
    status: PublicStatus;
    description: string;
  };
  boundaries: string[];
}

export interface WhitepaperContent {
  title: string;
  version: string;
  language: string;
  status: PublicStatus;
  description: string;
  primaryCta: NavigationItem;
  chapters: NavigationItem[];
}

export interface RoadmapPhase {
  title: string;
  status: PublicStatus;
  description: string;
  entryCriteria: string;
  evidence: string;
}

export interface ContactContent {
  title: string;
  status: PublicStatus;
  description: string;
  intake: string[];
  privacyNotice: string;
  channelLabel: string;
  whitepaperHref: `/${string}`;
}

export interface HomepageContent {
  navigation: NavigationItem[];
  hero: HeroContent;
  lifecycle: LifecycleStep[];
  protections: ProtectionRail[];
  scenarios: ScenarioStory[];
  institutions: InstitutionModel[];
  safety: SafetyLayer[];
  safetyBoundaries: string[];
  ecosystem: EcosystemLayer[];
  protocol: ProtocolContent;
  network: NodeProofContent;
  settlement: SettlementContent;
  economy: EconomyContent;
  whitepaper: WhitepaperContent;
  roadmap: RoadmapPhase[];
  contact: ContactContent;
  assets: {
    wordmarkUrl: string;
    whitepaperUrl: string;
    photoManifestUrl: string;
  };
}
