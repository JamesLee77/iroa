import type { WhitepaperChapter } from './types';

interface PrepareChapterOptions {
  eagerImages?: boolean;
  locale?: 'ko' | 'en';
}

function escapeAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function prepareChapterHtml(chapter: WhitepaperChapter, options: PrepareChapterOptions = {}) {
  let html = options.eagerImages
    ? chapter.html.replaceAll(' loading="lazy"', '')
    : chapter.html;
  for (const heading of chapter.headings) {
    const id = escapeAttribute(heading.id);
    const opening = `<h${heading.level} id="${id}">`;
    const openingAt = html.indexOf(opening);
    if (openingAt === -1) throw new Error(`missing rendered heading ${heading.id}`);
    const closing = `</h${heading.level}>`;
    const closingAt = html.indexOf(closing, openingAt + opening.length);
    if (closingAt === -1) throw new Error(`missing closing tag for heading ${heading.id}`);
    const insertionAt = closingAt + closing.length;
    const label = escapeAttribute(options.locale === 'en' ? `Link to ${heading.title}` : `${heading.title} 제목 링크`);
    const linkText = options.locale === 'en' ? 'Link' : '링크';
    const permalink = `<a class="heading-permalink" href="#${id}" aria-label="${label}"><span aria-hidden="true">${linkText}</span></a>`;
    html = `${html.slice(0, insertionAt)}${permalink}${html.slice(insertionAt)}`;
  }
  return html;
}
