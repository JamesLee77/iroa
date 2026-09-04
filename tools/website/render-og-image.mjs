import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { imageSize } from 'image-size';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolDir, '../..');
const outputPath = path.join(projectRoot, 'public/og/iroa-network-atlas.png');
const wordmarkPath = path.join(
  projectRoot,
  'docs/brand/masters/wordmark/iroa-wordmark-color.svg',
);
// The share image sets the same face the site does, so a link preview and the
// page it opens are not two different typefaces.
const fontDir = path.join(projectRoot, 'node_modules/pretendard/dist/web/static/woff2');
const [wordmark, fontBold, fontRegular] = await Promise.all([
  readFile(wordmarkPath),
  readFile(path.join(fontDir, 'Pretendard-Bold.woff2')),
  readFile(path.join(fontDir, 'Pretendard-Regular.woff2')),
]);
const wordmarkUrl = `data:image/svg+xml;base64,${wordmark.toString('base64')}`;
const fontBoldUrl = `data:font/woff2;base64,${fontBold.toString('base64')}`;
const fontRegularUrl = `data:font/woff2;base64,${fontRegular.toString('base64')}`;

await mkdir(path.dirname(outputPath), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <style>
          @font-face { font-family: IROA; src: url('${fontBoldUrl}') format('woff2'); font-weight: 700; }
          @font-face { font-family: IROA; src: url('${fontRegularUrl}') format('woff2'); font-weight: 400; }
          :root { --ink: #232e3c; --quiet: #55606e; --line: #dbe2ea; --action: #0e7490; --verified: #0f766e; --settlement: #1d4ed8; }
          * { box-sizing: border-box; }
          html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
          /* The same pastel wash the hero opens with, so a shared link and the
             page it lands on read as one surface. */
          body {
            position: relative;
            background:
              radial-gradient(52% 60% at 12% 14%, #cfe8fb 0%, rgb(207 232 251 / 0%) 62%),
              radial-gradient(44% 52% at 88% 8%, #d6f0e8 0%, rgb(214 240 232 / 0%) 60%),
              radial-gradient(58% 62% at 74% 84%, #dde7fa 0%, rgb(221 231 250 / 0%) 64%),
              radial-gradient(34% 36% at 20% 78%, #f6efe3 0%, rgb(246 239 227 / 0%) 56%),
              #f7f9fb;
            color: var(--ink);
            font-family: IROA, Arial, sans-serif;
          }
          main { display: grid; width: 100%; height: 100%; grid-template-columns: 1fr 1fr; gap: 52px; padding: 54px 60px; }
          section { min-width: 0; }
          .brand { width: 150px; height: auto; margin-bottom: 44px; }
          .kicker { margin: 0 0 16px; color: var(--verified); font: 700 13px IROA, Arial, sans-serif; letter-spacing: .16em; }
          h1 { margin: 0 0 22px; font: 700 54px/1.14 IROA, Arial, sans-serif; letter-spacing: -.035em; word-break: keep-all; }
          .copy { max-width: 440px; margin: 0; color: var(--quiet); font: 400 17px/1.6 IROA, Arial, sans-serif; word-break: keep-all; }
          .facts { display: flex; gap: 10px; margin-top: 30px; font: 700 12px IROA, Arial, sans-serif; }
          .facts span { padding: 9px 13px; border: 1px solid var(--line); border-radius: 6px; background: rgb(255 255 255 / 76%); }

          /* Stages are told apart by three things at once: a numbered rail, a
             filled marker that carries the stage's own colour, and a card that
             sits on white against the wash. One cue alone was not enough to
             separate them at preview scale. */
          .atlas { display: flex; flex-direction: column; justify-content: center; padding: 32px 30px; border: 1px solid var(--line); border-radius: 16px; background: rgb(255 255 255 / 82%); }
          .atlas-label { margin: 0 0 22px; color: var(--verified); font: 700 12px IROA, Arial, sans-serif; letter-spacing: .16em; }
          .path { display: grid; gap: 0; padding: 0; margin: 0; list-style: none; }
          .path li { position: relative; display: grid; align-items: baseline; padding: 13px 0 13px 40px; grid-template-columns: 34px 1fr; }
          .path li + li { border-top: 1px solid var(--line); }
          .path li::before { position: absolute; top: 20px; left: 6px; width: 11px; height: 11px; border-radius: 50%; background: var(--verified); content: ''; }
          .path li::after { position: absolute; top: 31px; bottom: -13px; left: 11px; width: 1px; background: var(--line); content: ''; }
          .path li:last-child::after { display: none; }
          .path li:first-child::before { background: var(--action); }
          .path li:last-child::before { background: var(--settlement); }
          .index { color: var(--quiet); font: 700 12px IROA, Arial, sans-serif; }
          .node { font: 700 18px IROA, Arial, sans-serif; }
          .node small { display: block; margin-top: 3px; color: var(--quiet); font: 400 12px IROA, Arial, sans-serif; }
          .settlement { color: var(--settlement); }
          .planes { display: grid; gap: 8px 18px; padding: 20px 0 0; margin: 22px 0 0; border-top: 1px solid var(--line); grid-template-columns: 1fr 1fr; list-style: none; }
          .planes li { display: flex; gap: 8px; color: var(--quiet); font: 700 11px IROA, Arial, sans-serif; letter-spacing: .06em; text-transform: uppercase; }
          .planes b { color: var(--verified); }
        </style>
      </head>
      <body>
        <main>
          <section>
            <img class="brand" src="${wordmarkUrl}" alt="" />
            <p class="kicker">IROA NETWORK ATLAS</p>
            <h1>현실 세계를 위한<br />검증 가능한<br />실행 네트워크.</h1>
            <p class="copy">AI, 사람, 기관, 검증된 Node를 연결해 승인된 요청을 결과와 증빙까지 조정합니다.</p>
            <div class="facts"><span>Personal Data Off-chain</span><span>IROA Rewards · Validation</span></div>
          </section>
          <section class="atlas">
            <p class="atlas-label">VERIFIABLE EXECUTION PATH</p>
            <ol class="path">
              <li><b class="index">01</b><span class="node">Voice Request</span></li>
              <li><b class="index">02</b><span class="node">Task Capsule</span></li>
              <li><b class="index">03</b><span class="node">N2 Verified Node</span></li>
              <li><b class="index">04</b><span class="node">Proof Receipt</span></li>
              <li><b class="index">05</b><span class="node settlement">Base Settlement · 계획 <small>Native USDC · 계획</small></span></li>
            </ol>
            <ol class="planes">
              <li><b>01</b><span>Interaction Plane</span></li>
              <li><b>02</b><span>Control Plane</span></li>
              <li><b>03</b><span>Execution Plane</span></li>
              <li><b>04</b><span>Settlement Plane</span></li>
            </ol>
          </section>
        </main>
      </body>
    </html>`);
  await page.screenshot({ path: outputPath, type: 'png', animations: 'disabled' });
} finally {
  await browser.close();
}

const dimensions = imageSize(await readFile(outputPath));
if (dimensions.width !== 1200 || dimensions.height !== 630) {
  throw new Error(
    `Expected 1200x630 OG image, received ${dimensions.width ?? 'unknown'}x${dimensions.height ?? 'unknown'}`,
  );
}

console.log(`Rendered ${path.relative(projectRoot, outputPath)} (${dimensions.width}x${dimensions.height})`);
