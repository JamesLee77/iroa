import { readFile } from 'node:fs/promises';
import path from 'node:path';
import GithubSlugger from 'github-slugger';
import { marked, Renderer, type Tokens } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { imageAsset, isExternalUrl, REPOSITORY_ROOT, resolveLocalAsset } from './assets';
import {
  WHITEPAPER_STATUSES,
  type WhitepaperChapter,
  type WhitepaperHeading,
  type WhitepaperMetadata,
  type WhitepaperPublication,
} from './types';

const SOURCE_PATH = 'docs/whitepaper/IROA_WHITEPAPER_KO.md';
const METADATA_PATH = 'docs/whitepaper/IROA_WHITEPAPER_KO.meta.json';
const CHAPTER_PATTERN = /^## (\d+)\.\s+(.+)$/m;
const LOWER_HEADING_PATTERN = /^(#{3,6})\s+(.+)$/gm;
const EXPLICIT_ANCHOR_PATTERN = /\s+\{#([A-Za-z][\w:.-]*)\}\s*$/;

interface ParsedChapter {
  number: number;
  title: string;
  markdown: string;
}

function textWithoutExplicitAnchor(value: string) {
  return value.replace(EXPLICIT_ANCHOR_PATTERN, '').trim();
}

function assertMetadata(metadata: WhitepaperMetadata) {
  if (!WHITEPAPER_STATUSES.includes(metadata.status)) {
    throw new Error(`unknown whitepaper publication status "${metadata.status}"`);
  }
  if (!metadata.title || !metadata.version || !metadata.language || !metadata.pdfPath) {
    throw new Error('whitepaper metadata is missing a required publication field');
  }
  if (metadata.slugs.length === 0) {
    throw new Error('whitepaper metadata has no locked chapter slugs');
  }
  if (metadata.slugs.length !== 22) {
    throw new Error(`whitepaper metadata must lock 22 chapter slugs; received ${metadata.slugs.length}`);
  }
  const duplicateSlug = metadata.slugs.find((slug, index) => metadata.slugs.indexOf(slug) !== index);
  if (duplicateSlug) {
    throw new Error(`duplicate locked slug "${duplicateSlug}"`);
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

function assertChapterOrder(chapters: ParsedChapter[], expectedCount: number) {
  const seen = new Set<number>();
  for (const chapter of chapters) {
    if (seen.has(chapter.number)) {
      throw new Error(`duplicate chapter number ${chapter.number}`);
    }
    seen.add(chapter.number);
    const expectedNumber = seen.size;
    if (chapter.number !== expectedNumber) {
      throw new Error(`chapter order is invalid: expected ${expectedNumber}, received ${chapter.number}`);
    }
  }
  if (chapters.length !== expectedCount) {
    throw new Error(`expected ${expectedCount} chapters, received ${chapters.length}`);
  }
}

function validateRepositoryLinks(markdown: string) {
  const markdownLinks = markdown.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g);
  for (const match of markdownLinks) {
    const link = match[1];
    if (isExternalUrl(link) || link.startsWith('/')) continue;
    try {
      resolveLocalAsset(link);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith('missing local image')) {
        throw new Error(`broken repository-local link "${link}"`);
      }
      throw error;
    }
  }
}

function validateImages(markdown: string) {
  const images = markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g);
  for (const match of images) {
    const image = match[1];
    if (!isExternalUrl(image)) resolveLocalAsset(image);
  }
}

function collectHeadings(markdown: string, chapterNumber: number, slugger: GithubSlugger) {
  const headings: WhitepaperHeading[] = [];
  const seenIds = new Set<string>();
  for (const match of markdown.matchAll(LOWER_HEADING_PATTERN)) {
    const rawTitle = match[2].trim();
    const explicitAnchor = rawTitle.match(EXPLICIT_ANCHOR_PATTERN)?.[1];
    const title = textWithoutExplicitAnchor(rawTitle);
    const candidateId = explicitAnchor ?? slugger.slug(title);
    if (seenIds.has(candidateId)) {
      throw new Error(`chapter ${chapterNumber} has duplicate heading ID "${candidateId}"`);
    }
    seenIds.add(candidateId);
    headings.push({ level: match[1].length, id: candidateId, title });
  }
  return headings;
}

function sanitize(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'figure', 'figcaption', 'img'],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['id'],
      a: ['href', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
  });
}

function renderMarkdown(markdown: string, headings: WhitepaperHeading[], lazyImages: boolean) {
  let headingIndex = 0;
  const renderer = new Renderer();
  renderer.heading = ({ depth, tokens }: Tokens.Heading) => {
    const heading = headings[headingIndex++];
    const content = renderer.parser.parseInline(tokens);
    return heading
      ? `<h${depth} id="${heading.id}">${content}</h${depth}>\n`
      : `<h${depth}>${content}</h${depth}>\n`;
  };
  renderer.image = ({ href, title, text }: Tokens.Image) => {
    if (isExternalUrl(href)) {
      return `<img src="${href}" alt="${text}"${title ? ` title="${title}"` : ''}>`;
    }
    const asset = imageAsset(href, lazyImages);
    return `<figure><img src="${asset.publicUrl}" alt="${text}" width="${asset.width}" height="${asset.height}"${asset.lazy ? ' loading="lazy"' : ''}${title ? ` title="${title}"` : ''}><figcaption>${text}</figcaption></figure>`;
  };
  return sanitize(marked.parse(markdown, { gfm: true, renderer }) as string);
}

function validateTokenAllocation(chapters: ParsedChapter[]) {
  const tokenChapter = chapters.find(({ number }) => number === 16);
  if (!tokenChapter) return;
  const allocationRows = [...tokenChapter.markdown.matchAll(/^\|\s*([^|]+?)\s*\|\s*\*?\*?([\d.]+)%\*?\*?\s*\|\s*\*?\*?([\d,]+)\*?\*?\s*\|/gm)];
  const rows = allocationRows.filter((match) => !match[1].includes('비율') && !match[1].includes('합계'));
  if (rows.length === 0) return;
  const totalPercent = rows.reduce((sum, match) => sum + Number(match[2]), 0);
  const totalAmount = rows.reduce((sum, match) => sum + Number(match[3].replaceAll(',', '')), 0);
  if (totalPercent !== 100) {
    throw new Error(`token allocation total must equal 100%; received ${totalPercent}%`);
  }
  if (totalAmount !== 10_000_000_000) {
    throw new Error(`token allocation amount must equal 10,000,000,000 IROA; received ${totalAmount.toLocaleString()} IROA`);
  }
}

export function validateNavigation(chapters: WhitepaperChapter[]) {
  for (const [index, chapter] of chapters.entries()) {
    if (index > 0 && !chapter.previous) {
      throw new Error(`chapter ${chapter.number} is missing previous navigation`);
    }
    if (index < chapters.length - 1 && !chapter.next) {
      throw new Error(`chapter ${chapter.number} is missing next navigation`);
    }
  }
}

export function parseWhitepaper(markdown: string, metadata: WhitepaperMetadata): WhitepaperPublication {
  assertMetadata(metadata);
  validateRepositoryLinks(markdown);
  validateImages(markdown);
  const { preamble, chapters: parsedChapters } = parseChapterBlocks(markdown);
  assertChapterOrder(parsedChapters, 22);
  validateTokenAllocation(parsedChapters);

  const slugger = new GithubSlugger();
  const chapters = parsedChapters.map((chapter, index): WhitepaperChapter => {
    const headings = collectHeadings(chapter.markdown, chapter.number, slugger);
    const markdownWithoutExplicitAnchors = chapter.markdown.replace(LOWER_HEADING_PATTERN, (_line, hashes: string, rawTitle: string) => `${hashes} ${textWithoutExplicitAnchor(rawTitle)}`);
    return {
      number: chapter.number,
      slug: metadata.slugs[index],
      title: chapter.title,
      html: renderMarkdown(markdownWithoutExplicitAnchors, headings, true),
      headings,
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
    preambleHtml: renderMarkdown(preamble, [], false),
    chapters,
  };
}

export async function loadWhitepaper(): Promise<WhitepaperPublication> {
  const [markdown, metadataSource] = await Promise.all([
    readFile(path.join(REPOSITORY_ROOT, SOURCE_PATH), 'utf8'),
    readFile(path.join(REPOSITORY_ROOT, METADATA_PATH), 'utf8'),
  ]);
  const metadata = JSON.parse(metadataSource) as WhitepaperMetadata;
  const publication = parseWhitepaper(markdown, metadata);
  if (publication.chapters.length !== 22) {
    throw new Error(`canonical whitepaper must contain 22 chapters; received ${publication.chapters.length}`);
  }
  return publication;
}
