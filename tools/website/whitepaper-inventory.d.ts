export interface WhitepaperInventoryEntry {
  kind: 'image' | 'link';
  raw: string;
  source: 'markdown' | 'html';
  alt?: string;
  html?: string;
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

export function parseDestination(rawDestination: string): ParsedDestination;
export function isExternalDestination(rawDestination: string): boolean;
export function parseWhitepaperInventory(markdown: string): WhitepaperInventory;
