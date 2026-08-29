export const WHITEPAPER_STATUSES = ['draft', 'validation', 'reviewed', 'published'] as const;

export const LOCKED_WHITEPAPER_SLUGS = [
  'core-declaration', 'daily-journeys', 'problem-and-market', 'product-system',
  'safe-execution', 'mobile', 'watch', 'secure-execution-space', 'ai-kiosk',
  'service-architecture', 'ai-technology', 'privacy-and-safety',
  'health-and-wearables', 'data-contribution', 'reward-economy', 'token-economy',
  'business-model', 'roadmap', 'operations-and-accountability', 'risks',
  'prelaunch-validation', 'conclusion',
] as const;

export type WhitepaperStatus = (typeof WHITEPAPER_STATUSES)[number];
export type WhitepaperLocale = 'ko' | 'en';

export interface WhitepaperMetadata {
  title: string;
  version: string;
  date: string;
  language: string;
  controllingLanguage: string;
  status: WhitepaperStatus;
  pdfPath: string;
  slugs: string[];
}

export interface WhitepaperHeading {
  level: number;
  id: string;
  title: string;
}

export interface WhitepaperNavigation {
  number: number;
  slug: string;
  title: string;
}

export interface WhitepaperChapter {
  number: number;
  slug: string;
  title: string;
  html: string;
  headings: WhitepaperHeading[];
  previous?: WhitepaperNavigation;
  next?: WhitepaperNavigation;
}

export interface WhitepaperPublication {
  metadata: WhitepaperMetadata;
  preambleHtml: string;
  chapters: WhitepaperChapter[];
  locale: WhitepaperLocale;
  routeBase: '/whitepaper' | '/en/whitepaper';
}
