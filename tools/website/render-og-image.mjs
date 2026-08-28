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
const koreanFontPath = path.join(projectRoot, 'docs/brand/assets/fonts/NotoSansKR-Bold.otf');

const [wordmark, koreanFont] = await Promise.all([
  readFile(wordmarkPath),
  readFile(koreanFontPath),
]);
const wordmarkUrl = `data:image/svg+xml;base64,${wordmark.toString('base64')}`;
const fontUrl = `data:font/otf;base64,${koreanFont.toString('base64')}`;

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
          @font-face { font-family: IROA; src: url('${fontUrl}') format('opentype'); font-weight: 700; }
          * { box-sizing: border-box; }
          html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
          body { background: #f9fafb; color: #16263d; font-family: IROA, Arial, sans-serif; }
          main { display: grid; width: 100%; height: 100%; grid-template-columns: 0.82fr 1.18fr; gap: 46px; padding: 48px 58px; }
          .brand { width: 154px; height: auto; margin-bottom: 54px; }
          .kicker { margin: 0 0 18px; color: #3d8b83; font: 700 13px Arial, sans-serif; letter-spacing: 0.15em; }
          h1 { max-width: 520px; margin: 0 0 26px; font-size: 56px; line-height: 1.08; letter-spacing: -0.055em; }
          .copy { max-width: 450px; margin: 0; color: #526174; font: 700 18px/1.75 IROA, Arial, sans-serif; }
          .facts { display: flex; gap: 12px; margin-top: 34px; color: #16263d; font: 700 12px Arial, sans-serif; }
          .facts span { padding: 10px 13px; border: 1px solid #d9dee5; border-radius: 999px; background: #fff; }
          .atlas { position: relative; overflow: hidden; border: 1px solid #d9dee5; border-radius: 28px; background: #fff; box-shadow: 0 24px 64px rgba(22,38,61,.09); }
          .atlas::before, .atlas::after { position: absolute; border: 1px solid rgba(61,139,131,.25); border-radius: 50%; content: ''; }
          .atlas::before { inset: 46px 70px 42px 38px; }
          .atlas::after { inset: 118px 170px 20px 18px; }
          .atlas-label { position: absolute; top: 26px; left: 30px; margin: 0; color: #3d8b83; font: 700 11px Arial, sans-serif; letter-spacing: .16em; }
          ol { padding: 0; margin: 0; list-style: none; }
          .path { position: absolute; z-index: 2; inset: 72px 176px 42px 34px; display: grid; align-content: space-between; }
          .path li { position: relative; display: flex; align-items: center; gap: 10px; }
          .path li:nth-child(2) { margin-left: 26%; }
          .path li:nth-child(3) { margin-left: 48%; }
          .path li:nth-child(4) { margin-left: 34%; }
          .path li:nth-child(5) { margin-left: 12%; }
          .path li:not(:last-child)::after { position: absolute; z-index: -1; top: 54px; left: 26px; width: 1px; height: 57px; transform: rotate(-31deg); transform-origin: top; border-left: 4px solid #f06d5e; content: ''; }
          .path li:nth-child(2)::after { transform: rotate(-24deg); }
          .path li:nth-child(3)::after { transform: rotate(17deg); }
          .path li:nth-child(4)::after { transform: rotate(31deg); }
          .index { color: #526174; font: 700 10px Arial, sans-serif; }
          .node { display: flex; min-height: 52px; align-items: center; gap: 10px; padding: 0 18px; border: 1px solid #d9dee5; border-radius: 999px; background: #fff; box-shadow: 0 12px 28px rgba(22,38,61,.1); font: 700 13px Arial, sans-serif; white-space: nowrap; }
          .node::before { width: 10px; height: 10px; border: 2px solid #3d8b83; border-radius: 50%; content: ''; }
          .path li:first-child .node::before, .path li:nth-child(4) .node::before { border-color: #f06d5e; }
          .path li:last-child .node::before { border-color: #2879e8; background: #2879e8; }
          .node small { color: #526174; font-size: 10px; }
          .planes { position: absolute; z-index: 3; top: 78px; right: 22px; bottom: 42px; display: flex; width: 142px; flex-direction: column; justify-content: space-between; }
          .planes li { display: grid; grid-template-columns: 20px 1fr; gap: 6px; font: 700 9px/1.35 Arial, sans-serif; text-transform: uppercase; }
          .planes b { color: #3d8b83; }
          .settlement { color: #2879e8; }
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
              <li><b class="index">05</b><span class="node settlement">Base Settlement <small>Native USDC</small></span></li>
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
