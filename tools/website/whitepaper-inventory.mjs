import { marked } from 'marked';

const RAW_HTML_TAG_PATTERN = /<(a|img)\b[^>]*>/gi;
const RAW_HTML_ATTRIBUTE_PATTERN = /\b(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;

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

function rawHtmlDestinations(rawHtml) {
  const destinations = [];
  for (const tag of rawHtml.matchAll(RAW_HTML_TAG_PATTERN)) {
    const tagName = tag[1].toLowerCase();
    for (const attribute of tag[0].matchAll(RAW_HTML_ATTRIBUTE_PATTERN)) {
      const attributeName = attribute[1].toLowerCase();
      if ((tagName === 'a' && attributeName !== 'href') || (tagName === 'img' && attributeName !== 'src')) continue;
      destinations.push({
        kind: tagName === 'img' ? 'image' : 'link',
        raw: attribute[2] ?? attribute[3] ?? attribute[4] ?? '',
        source: 'html',
        html: tag[0],
      });
    }
  }
  return destinations;
}

function walkTokens(tokens, inventory) {
  for (const token of tokens ?? []) {
    if (token.type === 'image') {
      inventory.images.push({ kind: 'image', raw: token.href, source: 'markdown', alt: token.text ?? '' });
    } else if (token.type === 'link') {
      inventory.links.push({ kind: 'link', raw: token.href, source: 'markdown' });
    } else if (token.type === 'html') {
      for (const destination of rawHtmlDestinations(token.text ?? token.raw ?? '')) {
        if (destination.kind === 'image') inventory.images.push(destination);
        else inventory.links.push(destination);
      }
    }

    if (Array.isArray(token.tokens)) walkTokens(token.tokens, inventory);
    if (Array.isArray(token.items)) {
      for (const item of token.items) walkTokens(item.tokens, inventory);
    }
  }
}

export function parseWhitepaperInventory(markdown) {
  const inventory = { images: [], links: [] };
  walkTokens(marked.lexer(markdown, { gfm: true }), inventory);
  return {
    images: [...new Map(inventory.images.map((entry) => [`${entry.source}:${entry.raw}`, entry])).values()],
    links: [...new Map(inventory.links.map((entry) => [`${entry.source}:${entry.raw}`, entry])).values()],
  };
}
