import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { imageSize } from 'image-size';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolDir, '../..');
const sourcePath = path.join(projectRoot, 'docs/whitepaper/IROA_WHITEPAPER_KO.md');
const illustrationPath = path.join(
  projectRoot,
  'docs/brand/assets/illustrations/iroa-whitepaper-cover-v1.png',
);
const outputPath = path.join(projectRoot, 'src/assets/home/iroa-whitepaper-cover-card.png');
const fontDir = path.join(projectRoot, 'node_modules/pretendard/dist/web/static/woff2');

/**
 * The cover is derived from the whitepaper's own front matter rather than kept
 * as a separate render. A hand-made copy had drifted: the card on the homepage
 * still showed a stock photograph the document no longer contains, so a reader
 * saw one cover and downloaded another.
 */
const markdown = await readFile(sourcePath, 'utf8');
const lineStartingWith = (prefix) => {
  const line = markdown.split('\n').find((candidate) => candidate.startsWith(prefix));
  if (!line) throw new Error(`whitepaper front matter is missing a line starting with "${prefix}"`);
  return line.slice(prefix.length).trim();
};
const title = lineStartingWith('# ');
const tagline = lineStartingWith('## ');
const subtitle = lineStartingWith('### ');
const edition = lineStartingWith('> ');

const escape = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const [illustration, fontBold, fontSemiBold, fontRegular] = await Promise.all([
  readFile(illustrationPath),
  readFile(path.join(fontDir, 'Pretendard-Bold.woff2')),
  readFile(path.join(fontDir, 'Pretendard-SemiBold.woff2')),
  readFile(path.join(fontDir, 'Pretendard-Regular.woff2')),
]);
const illustrationUrl = `data:image/png;base64,${illustration.toString('base64')}`;
const asFont = (buffer) => `data:font/woff2;base64,${buffer.toString('base64')}`;

await mkdir(path.dirname(outputPath), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 840, height: 1188 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <style>
          @font-face { font-family: IROA; src: url('${asFont(fontBold)}') format('woff2'); font-weight: 700; }
          @font-face { font-family: IROA; src: url('${asFont(fontSemiBold)}') format('woff2'); font-weight: 600; }
          @font-face { font-family: IROA; src: url('${asFont(fontRegular)}') format('woff2'); font-weight: 400; }
          * { box-sizing: border-box; }
          html, body { width: 840px; height: 1188px; margin: 0; overflow: hidden; }
          body {
            display: flex;
            flex-direction: column;
            padding: 74px 68px;
            background:
              radial-gradient(56% 40% at 14% 8%, #cfe8fb 0%, rgb(207 232 251 / 0%) 62%),
              radial-gradient(46% 34% at 88% 4%, #d6f0e8 0%, rgb(214 240 232 / 0%) 60%),
              #f7f9fb;
            color: #232e3c;
            font-family: IROA, Arial, sans-serif;
            word-break: keep-all;
          }
          h1 { margin: 0 0 26px; font: 700 62px/1.12 IROA, Arial, sans-serif; letter-spacing: -.04em; }
          .tagline { margin: 0 0 14px; color: #0f766e; font: 700 30px/1.35 IROA, Arial, sans-serif; letter-spacing: -.02em; }
          .subtitle { margin: 0 0 34px; color: #55606e; font: 400 20px/1.55 IROA, Arial, sans-serif; }
          .edition { padding: 15px 20px; border-left: 4px solid #0e7490; border-radius: 0 6px 6px 0; margin: 0 0 46px; background: rgb(255 255 255 / 78%); color: #232e3c; font: 600 17px IROA, Arial, sans-serif; }
          figure { flex: 1; overflow: hidden; border: 1px solid #dbe2ea; border-radius: 14px; margin: 0; background: #fff; }
          img { display: block; width: 100%; height: 100%; object-fit: cover; }
        </style>
      </head>
      <body>
        <h1>${escape(title)}</h1>
        <p class="tagline">${escape(tagline)}</p>
        <p class="subtitle">${escape(subtitle)}</p>
        <p class="edition">${escape(edition)}</p>
        <figure><img src="${illustrationUrl}" alt="" /></figure>
      </body>
    </html>`);
  await page.screenshot({ path: outputPath, type: 'png', animations: 'disabled' });
} finally {
  await browser.close();
}

const dimensions = imageSize(await readFile(outputPath));
if (dimensions.width !== 840 || dimensions.height !== 1188) {
  throw new Error(
    `Expected an 840x1188 cover, received ${dimensions.width ?? 'unknown'}x${dimensions.height ?? 'unknown'}`,
  );
}

console.log(`Rendered ${path.relative(projectRoot, outputPath)} (${dimensions.width}x${dimensions.height})`);
