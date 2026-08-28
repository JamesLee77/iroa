export interface WhitepaperInventoryEntry {
  kind: 'image' | 'link';
  raw: string;
  source: 'markdown' | 'html';
  alt?: string;
  html?: string;
  sourceContext: WhitepaperSourceContext;
}

export interface WhitepaperSourceContext {
  scope?: 'preamble' | 'chapter' | 'document';
  chapterNumber?: number;
  chapterSlug?: string;
}

export interface ParsedDestination {
  raw: string;
  path: string;
  fragment: string;
  isExternal: boolean;
  isRootRelative: boolean;
}

export interface WhitepaperInventory {
  images: WhitepaperInventoryEntry[];
  links: WhitepaperInventoryEntry[];
}

export interface HtmlStartTag {
  name: 'a' | 'img';
  raw: string;
  start: number;
  end: number;
  attributes: Record<string, string>;
}

export function parseDestination(rawDestination: string): ParsedDestination;
export function isExternalDestination(rawDestination: string): boolean;
export function scanHtmlStartTags(html: string): HtmlStartTag[];
export function htmlAttribute(tag: HtmlStartTag, name: string): string;
export function parseWhitepaperInventory(markdown: string, sourceContext?: WhitepaperSourceContext): WhitepaperInventory;
