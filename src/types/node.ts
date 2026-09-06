import type { PublicStatus } from '../lib/content/status';

export type NodeTrustLevelId = 'N0' | 'N1' | 'N2' | 'N3' | 'N4';

/** One row of the whitepaper's trust-level table (§8.3), kept verbatim. */
export interface NodeTrustLevel {
  level: NodeTrustLevelId;
  name: string;
  examples: string;
  allowed: string;
}

export interface NodeOperatorStep {
  title: string;
  description: string;
}

/** One line of the whitepaper's NODE reward formula (§16.4), kept verbatim. */
export interface NodeRewardTerm {
  sign: '=' | '+' | '-';
  label: string;
}

export interface NodeScoreWeight {
  label: string;
  weightPercent: number;
}

export interface NodePilotStage {
  id: 'A' | 'B' | 'C' | 'D' | 'E';
  title: string;
  outcome: string;
  entryCriteria: string;
  status: PublicStatus;
}

export type NodeMetricId = 'active-nodes' | 'trust-mix' | 'finalized-epochs' | 'last-root' | 'claims';

export interface NodeMetric {
  id: NodeMetricId;
  label: string;
  description: string;
}

export interface NodePageContent {
  eyebrow: string;
  title: string;
  lead: string;
  /** Operating-state boundary shown before any section. */
  notice: string;
  contentsLabel: string;
  definition: {
    title: string;
    status: PublicStatus;
    paragraphs: string[];
    capsuleLabel: string;
    capsule: string[];
  };
  trustLevels: {
    title: string;
    status: PublicStatus;
    lead: string;
    columns: { level: string; examples: string; allowed: string };
    levels: NodeTrustLevel[];
    note: string;
  };
  operator: {
    title: string;
    status: PublicStatus;
    lead: string;
    steps: NodeOperatorStep[];
    approvalNote: string;
  };
  rewards: {
    title: string;
    status: PublicStatus;
    lead: string;
    allocation: { label: string; share: string; amount: string; source: string };
    formulaLabel: string;
    formula: NodeRewardTerm[];
    scoreLabel: string;
    scoreWeights: NodeScoreWeight[];
    rules: string[];
  };
  dilution: {
    title: string;
    status: PublicStatus;
    alt: string;
    paragraph: string;
    source: string;
  };
  networkState: {
    title: string;
    status: PublicStatus;
    lead: string;
    predeploy: { title: string; description: string };
    metrics: NodeMetric[];
    placeholder: string;
    profileLabels: { network: string; release: string; contracts: string; explorer: string };
  };
  pilot: {
    title: string;
    lead: string;
    stages: NodePilotStage[];
    boundary: string;
    columns: { outcome: string; entryCriteria: string };
  };
  participation: {
    title: string;
    status: PublicStatus;
    lead: string;
    requirements: string[];
    channelLabel: string;
    privacyNotice: string;
  };
  boundaries: {
    title: string;
    items: string[];
  };
  whitepaperCta: { label: string; href: string };
  faqCta: { label: string; href: string };
}
