import { readFile } from 'node:fs/promises';
import path from 'node:path';
import GithubSlugger from 'github-slugger';
import { marked, Renderer, type Tokens } from 'marked';
import sanitizeHtml from 'sanitize-html';
import {
  imageAsset,
  REPOSITORY_ROOT,
  resolveInventoryImages,
  resolveRepositoryLink,
  type LocalAsset,
  type WhitepaperInventory,
  type WhitepaperInventoryEntry,
  type WhitepaperHeadingEntry,
} from './assets';
import {
  LOCKED_WHITEPAPER_SLUGS,
  WHITEPAPER_STATUSES,
  type WhitepaperChapter,
  type WhitepaperHeading,
  type WhitepaperMetadata,
  type WhitepaperPublication,
} from './types';
import {
  htmlAttribute,
  parseDestination,
  parseWhitepaperInventory,
  scanHtmlStartTags,
} from '../../../tools/website/whitepaper-inventory.mjs';

const SOURCE_PATH = 'docs/whitepaper/IROA_WHITEPAPER_KO.md';
const METADATA_PATH = 'docs/whitepaper/IROA_WHITEPAPER_KO.meta.json';
const CHAPTER_PATTERN = /^## (\d+)\.\s+(.+)$/m;
const EXPLICIT_ANCHOR_PATTERN = /\s+\{#([A-Za-z][\w:.-]*)\}\s*$/;

interface ParsedChapter {
  number: number;
  title: string;
  markdown: string;
}

function textWithoutExplicitAnchor(value: string) {
  return value.replace(EXPLICIT_ANCHOR_PATTERN, '').trim();
}

function assertNonEmptyString(metadata: unknown, field: string) {
  const value = (metadata as Record<string, unknown>)[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`metadata field ${field} must be a non-empty string`);
  }
  return value;
}

function assertMetadata(metadata: WhitepaperMetadata) {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error('whitepaper metadata must be an object');
  }
  for (const field of ['title', 'version', 'date', 'language', 'controllingLanguage', 'status', 'pdfPath']) {
    assertNonEmptyString(metadata, field);
  }
  const dateParts = metadata.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsedDate = dateParts ? new Date(`${metadata.date}T00:00:00Z`) : undefined;
  if (!dateParts || !parsedDate || Number.isNaN(parsedDate.getTime())
    || parsedDate.getUTCFullYear() !== Number(dateParts[1])
    || parsedDate.getUTCMonth() + 1 !== Number(dateParts[2])
    || parsedDate.getUTCDate() !== Number(dateParts[3])) {
    throw new Error('metadata field date must be a valid YYYY-MM-DD date');
  }
  if (!WHITEPAPER_STATUSES.includes(metadata.status)) {
    throw new Error(`unknown whitepaper publication status "${metadata.status}"`);
  }
  if (!Array.isArray(metadata.slugs)) {
    throw new Error('metadata field slugs must be an array');
  }
  if (metadata.slugs.length !== LOCKED_WHITEPAPER_SLUGS.length) {
    throw new Error(`whitepaper metadata must lock ${LOCKED_WHITEPAPER_SLUGS.length} chapter slugs; received ${metadata.slugs.length}`);
  }
  const duplicateSlug = metadata.slugs.find((slug, index) => metadata.slugs.indexOf(slug) !== index);
  if (duplicateSlug) throw new Error(`duplicate locked slug "${duplicateSlug}"`);
  for (const [index, slug] of metadata.slugs.entries()) {
    if (typeof slug !== 'string' || slug.trim() === '') {
      throw new Error(`metadata field slugs[${index}] must be a non-empty string`);
    }
    if (slug !== LOCKED_WHITEPAPER_SLUGS[index]) {
      throw new Error(`locked slug mismatch at chapter ${index + 1}: expected "${LOCKED_WHITEPAPER_SLUGS[index]}", received "${slug}"`);
    }
  }
}

function parseChapterBlocks(markdown: string): { preamble: string; chapters: ParsedChapter[] } {
  const matches = [...markdown.matchAll(new RegExp(CHAPTER_PATTERN.source, 'gm'))];
  const preamble = markdown.slice(0, matches[0]?.index ?? markdown.length);
  const chapters = matches.map((match, index) => ({
    number: Number(match[1]),
    title: match[2].trim(),
    markdown: markdown.slice((match.index ?? 0) + match[0].length, matches[index + 1]?.index).trim(),
  }));
  return { preamble, chapters };
}

function assertChapterOrder(chapters: ParsedChapter[]) {
  const seen = new Set<number>();
  for (const chapter of chapters) {
    if (seen.has(chapter.number)) throw new Error(`duplicate chapter number ${chapter.number}`);
    seen.add(chapter.number);
    const expectedNumber = seen.size;
    if (chapter.number !== expectedNumber) {
      throw new Error(`chapter order is invalid: expected ${expectedNumber}, received ${chapter.number}`);
    }
  }
  if (chapters.length !== LOCKED_WHITEPAPER_SLUGS.length) {
    throw new Error(`expected ${LOCKED_WHITEPAPER_SLUGS.length} chapters, received ${chapters.length}`);
  }
}

function collectHeadings(entries: WhitepaperHeadingEntry[], chapterNumber: number, slugger: GithubSlugger, publicationIds: Set<string>) {
  const headings: WhitepaperHeading[] = [];
  for (const entry of entries) {
    const rawTitle = entry.text.trim();
    const explicitAnchor = rawTitle.match(EXPLICIT_ANCHOR_PATTERN)?.[1];
    const title = textWithoutExplicitAnchor(rawTitle);
    const candidateId = explicitAnchor ?? slugger.slug(title);
    if (publicationIds.has(candidateId)) {
      throw new Error(`chapter ${chapterNumber} has duplicate heading ID "${candidateId}"`);
    }
    publicationIds.add(candidateId);
    headings.push({ level: entry.depth, id: candidateId, title });
  }
  return headings;
}

function brokenLink(entry: WhitepaperInventoryEntry, error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('missing local link')) {
    throw new Error(`broken repository-local link "${entry.raw}"`);
  }
  throw error;
}

function sourceScope(entry: WhitepaperInventoryEntry) {
  return entry.sourceContext.chapterSlug ?? 'preamble';
}

function whitepaperRouteScope(target: string, metadata: WhitepaperMetadata) {
  if (target === '/whitepaper') return 'preamble';
  return metadata.slugs.find((slug) => target === `/whitepaper/${slug}`);
}

function assertKnownFragment(fragment: string, scope: string, headingIdsByScope: Map<string, Set<string>>, message: string) {
  if (!headingIdsByScope.get(scope)?.has(fragment)) throw new Error(message);
}

function validateLinkInventory(inventory: WhitepaperInventory, metadata: WhitepaperMetadata, headingIdsByScope: Map<string, Set<string>>) {
  for (const entry of inventory.links) {
    const destination = parseDestination(entry.raw);
    if (destination.isExternal) continue;
    if (!destination.path) {
      if (destination.fragment) {
        const scope = sourceScope(entry);
        const label = scope === 'preamble' ? 'whitepaper preamble' : `chapter ${entry.sourceContext.chapterNumber}`;
        assertKnownFragment(destination.fragment, scope, headingIdsByScope, `unknown document fragment "#${destination.fragment}" in ${label}`);
      }
      continue;
    }
    const destinationScope = destination.isRootRelative ? whitepaperRouteScope(destination.path, metadata) : undefined;
    if (destinationScope) {
      if (destination.fragment) {
        const label = destinationScope === 'preamble' ? 'whitepaper preamble' : `chapter "${destinationScope}"`;
        assertKnownFragment(destination.fragment, destinationScope, headingIdsByScope, `unknown document fragment "#${destination.fragment}" for ${label}`);
      }
      continue;
    }
    try {
      const resolvedLink = resolveRepositoryLink(entry);
      if (destination.fragment && resolvedLink.repositoryPath === SOURCE_PATH) {
        const scope = sourceScope(entry);
        const label = scope === 'preamble' ? 'whitepaper preamble' : `chapter ${entry.sourceContext.chapterNumber}`;
        assertKnownFragment(destination.fragment, scope, headingIdsByScope, `unknown document fragment "#${destination.fragment}" in ${label}`);
      }
    } catch (error) {
      brokenLink(entry, error);
    }
  }
}

function validateTokenAllocation(chapters: ParsedChapter[]) {
  const tokenChapter = chapters.find(({ number }) => number === 16);
  if (!tokenChapter) throw new Error('chapter 16 token allocation table is missing or unparseable');
  const rows = [...tokenChapter.markdown.matchAll(/^\|\s*([^|]+?)\s*\|\s*\*?\*?([\d.]+)%\*?\*?\s*\|\s*\*?\*?([\d,]+)\*?\*?\s*\|/gm)]
    .filter((match) => !match[1].includes('비율') && !match[1].includes('합계'));
  if (rows.length === 0) throw new Error('chapter 16 token allocation table is missing or unparseable');

  const totalPercent = rows.reduce((sum, match) => sum + Number(match[2]), 0);
  const totalAmount = rows.reduce((sum, match) => sum + Number(match[3].replaceAll(',', '')), 0);
  if (totalPercent !== 100) throw new Error(`token allocation total must equal 100%; received ${totalPercent}%`);
  if (totalAmount !== 10_000_000_000) {
    throw new Error(`token allocation amount must equal 10,000,000,000 IROA; received ${totalAmount.toLocaleString()} IROA`);
  }
}

function sanitize(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'figure', 'figcaption', 'img'],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['id'],
      a: ['href', 'title'],
      div: ['class', 'role', 'aria-label', 'tabindex'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      table: ['aria-label'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
  });
}

function imageHtml(rawPath: string, alt: string, lazyImages: boolean, assets: Map<string, LocalAsset>) {
  const asset = assets.get(rawPath);
  if (!asset) throw new Error(`image URL is absent from parsed whitepaper inventory "${rawPath}"`);
  const image = imageAsset(asset, lazyImages);
  return `<figure><img src="${image.publicUrl}" alt="${alt}" width="${image.width}" height="${image.height}"${image.lazy ? ' loading="lazy"' : ''}><figcaption>${alt}</figcaption></figure>`;
}

function rewriteRawHtmlImages(html: string, assets: Map<string, LocalAsset>, lazyImages: boolean) {
  let cursor = 0;
  let rewritten = '';
  for (const tag of scanHtmlStartTags(html)) {
    if (tag.name !== 'img') continue;
    const source = htmlAttribute(tag, 'src');
    if (!source || parseDestination(source).isExternal) continue;
    rewritten += html.slice(cursor, tag.start);
    rewritten += imageHtml(source, htmlAttribute(tag, 'alt'), lazyImages, assets);
    cursor = tag.end;
  }
  return cursor === 0 ? html : `${rewritten}${html.slice(cursor)}`;
}

function escapeAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function renderMarkdown(
  markdown: string,
  headings: WhitepaperHeading[],
  lazyImages: boolean,
  assets: ReturnType<typeof resolveInventoryImages>,
  fallbackTableSubject: string,
) {
  let headingIndex = 0;
  let currentSectionTitle = fallbackTableSubject;
  const tableOrdinals = new Map<string, number>();
  const renderer = new Renderer();
  const renderTable = renderer.table.bind(renderer);
  renderer.heading = ({ depth, tokens }: Tokens.Heading) => {
    const content = textWithoutExplicitAnchor(renderer.parser.parseInline(tokens));
    if (depth < 3) return `<h${depth}>${content}</h${depth}>\n`;
    const heading = headings[headingIndex++];
    if (!heading || heading.level !== depth) {
      throw new Error(`whitepaper heading renderer mismatch at level ${depth}; expected lower heading ${headingIndex}`);
    }
    currentSectionTitle = heading.title;
    return `<h${depth} id="${heading.id}">${content}</h${depth}>\n`;
  };
  renderer.table = (token: Tokens.Table) => {
    const ordinal = (tableOrdinals.get(currentSectionTitle) ?? 0) + 1;
    tableOrdinals.set(currentSectionTitle, ordinal);
    const subject = ordinal === 1 ? currentSectionTitle : `${currentSectionTitle} ${ordinal}번`;
    const tableName = escapeAttribute(`${subject} 표`);
    const regionName = escapeAttribute(`${subject} 표 스크롤 영역`);
    const table = renderTable(token).replace('<table>', `<table aria-label="${tableName}">`);
    return `<div class="whitepaper-table-scroll" role="region" aria-label="${regionName}" tabindex="0">${table}</div>\n`;
  };
  renderer.image = ({ href, title, text }: Tokens.Image) => {
    if (parseDestination(href).isExternal) return `<img src="${href}" alt="${text}"${title ? ` title="${title}"` : ''}>`;
    return imageHtml(href, text, lazyImages, assets);
  };
  renderer.html = ({ text }: Tokens.HTML) => rewriteRawHtmlImages(text, assets, lazyImages);
  const rendered = marked.parse(markdown, { gfm: true, renderer }) as string;
  if (headingIndex !== headings.length) {
    throw new Error(`whitepaper heading renderer did not emit ${headings.length - headingIndex} collected lower heading IDs`);
  }
  return sanitize(rendered);
}

export function validateNavigation(chapters: WhitepaperChapter[]) {
  for (const [index, chapter] of chapters.entries()) {
    if (index > 0 && !chapter.previous) throw new Error(`chapter ${chapter.number} is missing previous navigation`);
    if (index < chapters.length - 1 && !chapter.next) throw new Error(`chapter ${chapter.number} is missing next navigation`);
  }
}

export function parseWhitepaper(markdown: string, metadata: WhitepaperMetadata): WhitepaperPublication {
  assertMetadata(metadata);
  const { preamble, chapters: parsedChapters } = parseChapterBlocks(markdown);
  assertChapterOrder(parsedChapters);
  validateTokenAllocation(parsedChapters);

  const inventories = [
    parseWhitepaperInventory(preamble, { scope: 'preamble' }),
    ...parsedChapters.map((chapter, index) => parseWhitepaperInventory(chapter.markdown, {
      scope: 'chapter', chapterNumber: chapter.number, chapterSlug: metadata.slugs[index],
    })),
  ] as WhitepaperInventory[];
  const slugger = new GithubSlugger();
  const publicationIds = new Set<string>();
  const preambleHeadings = collectHeadings(inventories[0].headings, 0, slugger, publicationIds);
  const chapterHeadings = parsedChapters.map((chapter, index) => collectHeadings(inventories[index + 1].headings, chapter.number, slugger, publicationIds));
  const headingIdsByScope = new Map<string, Set<string>>([
    ['preamble', new Set(preambleHeadings.map(({ id }) => id))],
    ...chapterHeadings.map((headings, index) => [metadata.slugs[index], new Set(headings.map(({ id }) => id))] as const),
  ]);
  const inventory: WhitepaperInventory = {
    images: inventories.flatMap(({ images }) => images),
    links: inventories.flatMap(({ links }) => links),
    headings: inventories.flatMap(({ headings }) => headings),
  };
  validateLinkInventory(inventory, metadata, headingIdsByScope);
  const assets = resolveInventoryImages(inventory);
  const chapters = parsedChapters.map((chapter, index): WhitepaperChapter => {
    return {
      number: chapter.number,
      slug: metadata.slugs[index],
      title: chapter.title,
      html: renderMarkdown(
        chapter.markdown,
        chapterHeadings[index],
        true,
        assets,
        `${chapter.number}. ${chapter.title}`,
      ),
      headings: chapterHeadings[index],
      previous: undefined,
      next: undefined,
    };
  });
  for (const [index, chapter] of chapters.entries()) {
    if (index > 0) {
      const previous = chapters[index - 1];
      chapter.previous = { number: previous.number, slug: previous.slug, title: previous.title };
    }
    if (index < chapters.length - 1) {
      const next = chapters[index + 1];
      chapter.next = { number: next.number, slug: next.slug, title: next.title };
    }
  }
  validateNavigation(chapters);
  return {
    metadata,
    preambleHtml: renderMarkdown(preamble, preambleHeadings, false, assets, '백서 개요'),
    chapters,
  };
}

export async function loadWhitepaper(): Promise<WhitepaperPublication> {
  const [markdown, metadataSource] = await Promise.all([
    readFile(path.join(REPOSITORY_ROOT, SOURCE_PATH), 'utf8'),
    readFile(path.join(REPOSITORY_ROOT, METADATA_PATH), 'utf8'),
  ]);
  return parseWhitepaper(markdown, JSON.parse(metadataSource) as WhitepaperMetadata);
}
