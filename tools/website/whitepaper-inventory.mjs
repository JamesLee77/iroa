import { marked } from 'marked';

export function parseDestination(rawDestination) {
  const raw = String(rawDestination ?? '').trim();
  const hashIndex = raw.indexOf('#');
  const beforeFragment = hashIndex === -1 ? raw : raw.slice(0, hashIndex);
  const rawFragment = hashIndex === -1 ? '' : raw.slice(hashIndex + 1);
  const queryIndex = beforeFragment.indexOf('?');
  const rawPath = queryIndex === -1 ? beforeFragment : beforeFragment.slice(0, queryIndex);

  try {
    return {
      raw,
      path: decodeURIComponent(rawPath),
      fragment: rawFragment ? decodeURIComponent(rawFragment) : '',
      isExternal: /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(rawPath),
      isRootRelative: rawPath.startsWith('/'),
    };
  } catch {
    throw new Error(`invalid percent-encoding in URL/path "${raw}"`);
  }
}

export function isExternalDestination(rawDestination) {
  return parseDestination(rawDestination).isExternal;
}

export function scanHtmlStartTags(html) {
  const tags = [];
  for (let start = 0; start < html.length; start += 1) {
    if (html[start] !== '<' || html[start + 1] === '/') continue;
    const nameMatch = html.slice(start + 1).match(/^(a|img)\b/i);
    if (!nameMatch) continue;
    const name = nameMatch[1].toLowerCase();
    let quote = '';
    let end = start + 1 + nameMatch[0].length;
    for (; end < html.length; end += 1) {
      const character = html[end];
      if (quote) {
        if (character === quote) quote = '';
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '>') {
        end += 1;
        break;
      }
    }
    if (end > html.length || html[end - 1] !== '>') continue;
    const raw = html.slice(start, end);
    tags.push({ name, raw, start, end, attributes: parseHtmlAttributes(raw, name) });
    start = end - 1;
  }
  return tags;
}

function parseHtmlAttributes(tag, tagName) {
  const attributes = {};
  let index = 1 + tagName.length;
  while (index < tag.length - 1) {
    while (/\s|\//.test(tag[index] ?? '')) index += 1;
    if (index >= tag.length - 1) break;
    const nameStart = index;
    while (index < tag.length - 1 && !/[\s=/>]/.test(tag[index])) index += 1;
    const name = tag.slice(nameStart, index).toLowerCase();
    if (!name) break;
    while (/\s/.test(tag[index] ?? '')) index += 1;
    let value = '';
    if (tag[index] === '=') {
      index += 1;
      while (/\s/.test(tag[index] ?? '')) index += 1;
      const quote = tag[index] === '"' || tag[index] === "'" ? tag[index++] : '';
      const valueStart = index;
      if (quote) {
        while (index < tag.length - 1 && tag[index] !== quote) index += 1;
        value = tag.slice(valueStart, index);
        if (tag[index] === quote) index += 1;
      } else {
        while (index < tag.length - 1 && !/[\s>]/.test(tag[index])) index += 1;
        value = tag.slice(valueStart, index);
      }
    }
    attributes[name] = value;
  }
  return attributes;
}

export function htmlAttribute(tag, name) {
  return tag.attributes[name.toLowerCase()] ?? '';
}

function rawHtmlDestinations(rawHtml, context) {
  const destinations = [];
  for (const tag of scanHtmlStartTags(rawHtml)) {
    const raw = tag.name === 'img' ? htmlAttribute(tag, 'src') : htmlAttribute(tag, 'href');
    if (!raw) continue;
    destinations.push({
      kind: tag.name === 'img' ? 'image' : 'link',
      raw,
      source: 'html',
      alt: tag.name === 'img' ? htmlAttribute(tag, 'alt') : undefined,
      html: tag.raw,
      sourceContext: { ...context },
    });
  }
  return destinations;
}

function walkTokens(tokens, inventory, context) {
  for (const token of tokens ?? []) {
    if (token.type === 'image') {
      inventory.images.push({ kind: 'image', raw: token.href, source: 'markdown', alt: token.text ?? '', sourceContext: { ...context } });
    } else if (token.type === 'link') {
      inventory.links.push({ kind: 'link', raw: token.href, source: 'markdown', sourceContext: { ...context } });
    } else if (token.type === 'heading' && token.depth >= 3) {
      inventory.headings.push({ depth: token.depth, text: token.text ?? '', sourceContext: { ...context } });
    } else if (token.type === 'html') {
      for (const destination of rawHtmlDestinations(token.text ?? token.raw ?? '', context)) {
        if (destination.kind === 'image') inventory.images.push(destination);
        else inventory.links.push(destination);
      }
    }

    if (Array.isArray(token.tokens)) walkTokens(token.tokens, inventory, context);
    if (Array.isArray(token.items)) {
      for (const item of token.items) walkTokens(item.tokens, inventory, context);
    }
    if (Array.isArray(token.header)) {
      for (const cell of token.header) walkTokens(cell.tokens, inventory, context);
    }
    if (Array.isArray(token.rows)) {
      for (const row of token.rows) {
        for (const cell of row) walkTokens(cell.tokens, inventory, context);
      }
    }
  }
}

export function parseWhitepaperInventory(markdown, sourceContext = {}) {
  const inventory = { images: [], links: [], headings: [] };
  walkTokens(marked.lexer(markdown, { gfm: true }), inventory, sourceContext);
  const key = (entry) => `${entry.source}:${entry.sourceContext.scope ?? ''}:${entry.sourceContext.chapterSlug ?? ''}:${entry.raw}`;
  return {
    images: [...new Map(inventory.images.map((entry) => [key(entry), entry])).values()],
    links: [...new Map(inventory.links.map((entry) => [key(entry), entry])).values()],
    headings: inventory.headings,
  };
}
