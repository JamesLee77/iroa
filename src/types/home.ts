export type ContentStatus = '현재' | '목표 경험' | '다음' | '계획' | '장기';

export interface NavigationItem {
  label: string;
  href: `#${string}`;
}

export interface HeroContent {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: NavigationItem;
  secondaryCta: NavigationItem;
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
  status: ContentStatus;
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
  status?: ContentStatus;
}

export interface SettlementStep {
  title: string;
  description: string;
}

export interface SettlementContent {
  network: 'Base';
  asset: 'Circle Native USDC';
  consumerPayment: string;
  title: string;
  description: string;
  steps: SettlementStep[];
  principles: string[];
}

export interface RoadmapPhase {
  title: string;
  status: ContentStatus;
  description: string;
  evidence: string;
}

export interface ContactContent {
  title: string;
  description: string;
  intake: string[];
  privacyNotice: string;
  channelLabel: string;
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
  settlement: SettlementContent;
  roadmap: RoadmapPhase[];
  contact: ContactContent;
  assets: {
    wordmarkUrl: string;
    whitepaperUrl: string;
    photoManifestUrl: string;
  };
}
