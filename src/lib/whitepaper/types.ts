export const WHITEPAPER_STATUSES = ['draft', 'validation', 'reviewed', 'published'] as const;

export type WhitepaperStatus = (typeof WHITEPAPER_STATUSES)[number];

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
}
