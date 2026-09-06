import type { PublicStatus } from '../lib/content/status';

export interface FaqEntry {
  /** Stable identifier used for the anchor and the contents link. */
  id: string;
  question: string;
  /** Each string renders as its own paragraph. */
  answer: string[];
  /** Rendered as a list under the answer when the entry enumerates items. */
  points?: string[];
  /**
   * Set only when the answer describes a capability that is not operating yet,
   * so a plan is never presented as a live service.
   */
  status?: PublicStatus;
  /** A pointer to the page that carries the fuller explanation. */
  link?: { label: string; href: string };
}

export interface FaqGroup {
  id: string;
  title: string;
  entries: FaqEntry[];
}

export interface FaqPageContent {
  eyebrow: string;
  title: string;
  lead: string;
  /** Operating-state boundary shown before any answer. */
  notice: string;
  contentsLabel: string;
  groups: FaqGroup[];
  closing: {
    title: string;
    message: string;
  };
  whitepaperCta: {
    label: string;
    href: string;
  };
}
