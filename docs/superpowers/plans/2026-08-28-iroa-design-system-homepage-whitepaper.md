# IROA Design System, Homepage, and Web Whitepaper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current photo-led React SPA with an Astro-based IROA Web3 public site that ships the approved design system, Network Atlas homepage, and complete Korean web whitepaper.

**Architecture:** Astro 7 statically renders the site shell, homepage, design-system inventory, whitepaper index, and 22 chapter routes. React remains installed for later isolated interactive islands, but this delivery keeps the primary content semantic and static. The canonical whitepaper Markdown is parsed at build time into typed chapter models, validated, and rendered through shared document components.

**Tech Stack:** Node 22.12+, Astro 7.2.9, @astrojs/react 6.0.4, @astrojs/sitemap 3.7.3, React 19.2.8, TypeScript 7.0.2, Vitest 4.1.11, Playwright 1.62.1, @axe-core/playwright 4.13.0, marked 18.0.11, sanitize-html 2.17.7, github-slugger 2.0.0, image-size 2.0.2, @fontsource-variable/inter 5.3.0, lucide-astro 0.556.0, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-08-28-iroa-web3-design-system-and-site-design.md`

## Global Constraints

- Use the selected light Network Atlas visual direction and the approved Track A IROA masters.
- Base is the primary network; Circle Native USDC is the planned B2B settlement asset.
- Consumer payment remains KRW, cards, bank transfers, and existing payment channels.
- IROA rewards remain labeled `Validation` until issuance, legal review, deployment, and audit evidence exists.
- Personal and sensitive source data remains off-chain.
- Do not publish token price, yield, listing, guaranteed-return, live-partner, or unsupported certification claims.
- Use semantic color aliases; raw brand hex values appear only in the foundation token file.
- Coral filled actions use Navy text; White text on Coral is prohibited.
- Teal on Ivory is not used for normal-size body text.
- Use Noto Sans KR for Korean and Inter for Latin text and tabular data.
- Interactive targets are at least 44×44px; focus is visible; color is never the only state signal.
- Respect `prefers-reduced-motion`; do not use scroll-jacking, auto-playing video, parallax, or forced horizontal page scroll.
- Verify 375, 768, 1024, and 1440px layouts, 200% zoom, keyboard navigation, and mobile landscape.
- Preserve `docs/whitepaper/IROA_WHITEPAPER_KO.md` as the canonical whitepaper content source.
- Source, browser, deployment, and live-operation evidence are reported separately.

## Scope Decomposition

This plan is the first independently testable delivery from the approved site specification. It covers the framework foundation, design system, homepage, and full web whitepaper because those pieces share the global shell, navigation, document entry point, and visual language.

The secondary public routes `/protocol`, `/network`, `/economy`, and `/roadmap` will be implemented in a separate plan after this delivery. In this plan, those header items link to the matching homepage sections so no navigation target is broken.

---

## File Structure

### Project and build

- `package.json` — Astro runtime, validation, build, preview, test, and asset-sync scripts.
- `package-lock.json` — reproducible npm dependency graph.
- `astro.config.mjs` — React and sitemap integrations, canonical site URL, and static output.
- `tsconfig.json` — Astro strict TypeScript configuration plus Vitest and Playwright types.
- `src/env.d.ts` — Astro client types.
- `.gitignore` — generated public whitepaper assets and existing test output.
- `public/robots.txt` — public crawler policy and sitemap location.
- `tools/website/render-og-image.mjs` — deterministic 1200×630 Network Atlas share-image renderer.

### Design system

- `design-system/MASTER.md` — human-readable source of design-system rules.
- `design-system/pages/homepage.md` — homepage-specific hierarchy and composition rules.
- `design-system/pages/whitepaper.md` — reader-specific typography and navigation rules.
- `src/styles/tokens.css` — raw brand constants and semantic light/dark theme mappings.
- `src/styles/foundations.css` — reset, local fonts, typography, grid, focus, motion, and accessibility foundations.
- `src/styles/components.css` — primitive and IROA-pattern styles.
- `src/styles/pages.css` — homepage, design-system route, and whitepaper layouts.

### Shared shell and primitives

- `src/layouts/SiteLayout.astro` — canonical, Open Graph, Twitter, robots, global CSS, skip link, header, main slot, and footer.
- `src/layouts/WhitepaperLayout.astro` — document control, chapter navigation, article slot, and reader shell.
- `src/components/primitives/ButtonLink.astro` — primary, secondary, and quiet link actions.
- `src/components/primitives/StatusBadge.astro` — text-plus-shape status treatment.
- `src/components/primitives/SectionIntro.astro` — eyebrow, heading, and lead.
- `src/components/SiteHeader.astro` — desktop links and native mobile disclosure navigation.
- `src/components/SiteFooter.astro` — publication, privacy, security, and source links.

### Content and IROA patterns

- `src/lib/content/status.ts` — closed public-status vocabulary and labels.
- `src/lib/content/status.test.ts` — status mapping and forbidden-state tests.
- `src/content/home.ko.ts` — approved homepage copy and factual statuses.
- `src/content/home.ko.test.ts` — content integrity and prohibited-claim tests.
- `src/lib/protocol/flow.ts` — typed protocol stages and privacy boundary.
- `src/lib/protocol/flow.test.ts` — order, Base, Native USDC, and off-chain assertions.
- `src/components/patterns/ProtocolPath.astro` — accessible ordered execution path.
- `src/components/patterns/TaskCapsule.astro` — purpose, permission, data class, and duration.
- `src/components/patterns/VerifiedNode.astro` — Node level and verification status.
- `src/components/patterns/ProofReceipt.astro` — result, proof ID, policy, and dispute state.
- `src/components/patterns/SettlementRecord.astro` — Base and Native USDC settlement status.
- `src/components/patterns/PrivacyBoundary.astro` — on-chain and off-chain separation.

### Homepage

- `src/components/sections/HomeHero.astro` — message, actions, facts, and Network Atlas execution path.
- `src/components/sections/ProtocolPlanes.astro` — Interaction, Control, Execution, and Settlement planes.
- `src/components/sections/NetworkProof.astro` — Node trust, execution, and proof model.
- `src/components/sections/SettlementOverview.astro` — consumer payment and B2B settlement boundary.
- `src/components/sections/EconomyStatus.astro` — IROA reward status and non-speculative boundaries.
- `src/components/sections/WhitepaperEntry.astro` — document status and chapter entry.
- `src/components/sections/RoadmapPreview.astro` — phases and entry gates.
- `src/components/sections/ParticipationContact.astro` — honest institutional contact entry without a fake form.
- `src/pages/index.astro` — homepage composition.
- `src/pages/404.astro` — branded unknown-route recovery with homepage and whitepaper entry points.

### Whitepaper

- `docs/whitepaper/IROA_WHITEPAPER_KO.meta.json` — publication metadata and locked 22-chapter slug map.
- `src/lib/whitepaper/types.ts` — publication, chapter, and heading types.
- `src/lib/whitepaper/assets.ts` — safe repository-relative image resolution.
- `src/lib/whitepaper/load.ts` — canonical Markdown loader, chapter splitter, renderer, and validation.
- `src/lib/whitepaper/load.test.ts` — metadata, chapter, slug, heading, link, and source-value tests.
- `tools/website/sync-whitepaper-assets.mjs` — copies referenced local images into generated public paths.
- `src/components/whitepaper/DocumentControl.astro` — title, version, date, language, and status.
- `src/components/whitepaper/ChapterIndex.astro` — complete chapter list and active state.
- `src/components/whitepaper/OnThisPage.astro` — stable lower-heading links for the current chapter.
- `src/components/whitepaper/ChapterPager.astro` — previous and next chapter links.
- `src/pages/whitepaper/index.astro` — web-publication overview and 22-chapter index.
- `src/pages/whitepaper/[chapter].astro` — statically generated chapter route.

### Design-system inventory and verification

- `src/pages/design-system.astro` — foundations, primitives, states, protocol patterns, and reader samples with `noindex` metadata.
- `playwright.config.ts` — Astro production-preview browser configuration.
- `e2e/site-shell.spec.ts` — routing, header, mobile navigation, and asset checks.
- `e2e/home-web3.spec.ts` — Network Atlas homepage content and connected-flow checks.
- `e2e/whitepaper.spec.ts` — index, direct chapter URLs, anchors, previous/next, and PDF download.
- `e2e/accessibility.spec.ts` — axe checks, keyboard flow, reduced motion, zoom, and viewport overflow.
- `docs/website/IROA_WEB3_SITE_VERIFICATION.md` — final source and browser evidence.

---

### Task 1: Migrate the public shell from Vite SPA to Astro

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `astro.config.mjs`
- Modify: `tsconfig.json`
- Create: `src/env.d.ts`
- Create: `public/robots.txt`
- Create: `src/layouts/SiteLayout.astro`
- Create: `src/pages/index.astro`
- Create: `e2e/site-shell.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**
- Produces: Astro static build scripts `dev`, `typecheck`, `build`, `preview`, and `test:e2e`.
- Produces: `SiteLayout` props `{ title: string; description: string; canonicalPath: string; robots?: string; imagePath?: string }`.
- Produces: production route `/` with one `<main id="main-content">` landmark.

- [ ] **Step 1: Write the failing Astro shell browser test**

Create `e2e/site-shell.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('serves the new static IROA shell', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/IROA\.AI/);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: '현실 세계를 위한 검증 가능한 실행 네트워크.',
    }),
  ).toBeVisible();
});
```

- [ ] **Step 2: Run the shell test and verify RED**

Run: `npm run test:e2e -- e2e/site-shell.spec.ts`

Expected: FAIL because the current homepage still exposes the old hero promise.

- [ ] **Step 3: Install the locked Astro dependency set**

Run:

```bash
npm install astro@7.2.9 @astrojs/react@6.0.4 @astrojs/sitemap@3.7.3 react@19.2.8 react-dom@19.2.8 marked@18.0.11 sanitize-html@2.17.7 github-slugger@2.0.0 image-size@2.0.2 @fontsource-variable/inter@5.3.0 lucide-astro@0.556.0
npm install --save-dev @astrojs/check@0.9.10 @axe-core/playwright@4.13.0 @types/sanitize-html@2.16.1
```

Expected: npm exits 0 and updates `package-lock.json` without removing the existing Vitest, Testing Library, or Playwright toolchain.

- [ ] **Step 4: Replace the build scripts and add Astro configuration**

Set the package engine and scripts to:

```json
{
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "astro dev",
    "test": "vitest",
    "test:run": "vitest run",
    "sync:whitepaper-assets": "node tools/website/sync-whitepaper-assets.mjs",
    "typecheck": "astro check",
    "build": "npm run sync:whitepaper-assets && npm run typecheck && astro build",
    "preview": "astro preview",
    "pretest:e2e": "npm run build",
    "test:e2e": "playwright test"
  }
}
```

Create `astro.config.mjs`:

```js
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://iroa.ai',
  output: 'static',
  integrations: [react(), sitemap()],
});
```

- [ ] **Step 5: Add the minimal static layout and page**

Create `src/layouts/SiteLayout.astro` with the exact public contract:

```astro
---
interface Props {
  title: string;
  description: string;
  canonicalPath: string;
  robots?: string;
  imagePath?: string;
}

const {
  title,
  description,
  canonicalPath,
  robots = 'index,follow',
  imagePath = '/og/iroa-network-atlas.png',
} = Astro.props;
const canonical = new URL(canonicalPath, Astro.site);
const shareImage = new URL(imagePath, Astro.site);
---

<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <meta name="robots" content={robots} />
    <link rel="canonical" href={canonical} />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="IROA.AI" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content={shareImage} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={shareImage} />
    <title>{title}</title>
  </head>
  <body>
    <a class="skip-link" href="#main-content">본문으로 바로가기</a>
    <main id="main-content"><slot /></main>
  </body>
</html>
```

Create `src/pages/index.astro` with the approved H1 and no old React root import.

Create `public/robots.txt` with `User-agent: *`, `Allow: /`, and `Sitemap: https://iroa.ai/sitemap-index.xml`.

- [ ] **Step 6: Update TypeScript and Playwright for Astro**

Set `tsconfig.json` to extend `astro/tsconfigs/strict`, include `src`, `astro.config.mjs`, `playwright.config.ts`, and `e2e`, and retain the Vitest globals. Keep Playwright's preview command and `http://127.0.0.1:4173` base URL.

- [ ] **Step 7: Verify GREEN**

Run:

```bash
npm run typecheck
npm run build
npm run test:e2e -- e2e/site-shell.spec.ts
```

Expected: all commands exit 0, `dist/index.html` exists, and the new H1 is visible.

- [ ] **Step 8: Commit the framework migration**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json src/env.d.ts public/robots.txt src/layouts/SiteLayout.astro src/pages/index.astro e2e/site-shell.spec.ts playwright.config.ts
git commit -m "build: migrate IROA public site to Astro"
```

---

### Task 2: Establish the IROA Web3 design-system foundations

**Files:**
- Create: `design-system/MASTER.md`
- Create: `design-system/pages/homepage.md`
- Create: `design-system/pages/whitepaper.md`
- Modify: `src/styles/tokens.css`
- Create: `src/styles/foundations.css`
- Create: `src/styles/components.css`
- Create: `src/styles/pages.css`
- Create: `src/lib/design-system/tokens.test.ts`
- Modify: `src/layouts/SiteLayout.astro`

**Interfaces:**
- Produces: semantic CSS tokens `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-action`, `--color-on-action`, `--color-verified`, `--color-border`, and `--color-focus`.
- Produces: layout tokens `--container`, `--gutter`, `--space-1` through `--space-12`, and motion tokens.
- Consumes: exact approved Track A colors from `docs/brand/IROA_BI_GUIDE_KO.md`.

- [ ] **Step 1: Write the failing token contract test**

Create `src/lib/design-system/tokens.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/tokens.css', 'utf8');

describe('IROA semantic tokens', () => {
  it.each([
    '--color-bg',
    '--color-surface',
    '--color-text',
    '--color-action',
    '--color-on-action',
    '--color-verified',
    '--color-focus',
    '--control-min',
  ])('defines %s', (token) => expect(css).toContain(`${token}:`));

  it('uses Navy text on the Coral action fill', () => {
    expect(css).toMatch(/--color-action:\s*var\(--brand-coral\)/);
    expect(css).toMatch(/--color-on-action:\s*var\(--brand-navy\)/);
  });
});
```

- [ ] **Step 2: Run the token test and verify RED**

Run: `npm run test:run -- src/lib/design-system/tokens.test.ts`

Expected: FAIL because the current token file does not define the semantic contract.

- [ ] **Step 3: Define the exact foundation tokens**

Replace `src/styles/tokens.css` with brand constants and semantic aliases beginning with:

```css
:root {
  --brand-navy: #16263d;
  --brand-coral: #f06d5e;
  --brand-ivory: #f7f3ea;
  --brand-teal: #3d8b83;
  --brand-light-teal: #83cdc4;
  --brand-ink: #19222e;
  --brand-white: #ffffff;

  --color-bg: #f9fafb;
  --color-surface: var(--brand-white);
  --color-surface-soft: var(--brand-ivory);
  --color-text: var(--brand-navy);
  --color-text-muted: #526174;
  --color-action: var(--brand-coral);
  --color-on-action: var(--brand-navy);
  --color-verified: var(--brand-teal);
  --color-border: #d9dee5;
  --color-focus: var(--brand-navy);
  --color-dark-bg: #0d1726;
  --color-on-dark: var(--brand-white);

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --container: 77.5rem;
  --gutter: clamp(1rem, 4vw, 2.5rem);
  --control-min: 2.75rem;
  --motion-fast: 180ms;
  --motion-base: 240ms;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
}
```

- [ ] **Step 4: Implement foundations and human-readable design rules**

Define local `@font-face` rules for the checked-in Noto Sans KR Medium and Bold files and import the locally bundled Inter variable font from `@fontsource-variable/inter`. Use Noto Sans KR for Korean and Inter for Latin text and tabular values. Add a 16px mobile body minimum, 60–75-character article measure, 12-column utility grid, 44px controls, visible 3px focus ring, and reduced-motion override. Write `design-system/MASTER.md` with the approved brand, semantic color, typography, spacing, icon, motion, accessibility, and anti-pattern rules. Write page overrides that narrow homepage and whitepaper behavior without redefining brand tokens.

- [ ] **Step 5: Import the styles from the site layout**

Add these imports to `SiteLayout.astro`:

```astro
---
import '../styles/tokens.css';
import '../styles/foundations.css';
import '../styles/components.css';
import '../styles/pages.css';
---
```

- [ ] **Step 6: Verify GREEN and build**

Run:

```bash
npm run test:run -- src/lib/design-system/tokens.test.ts
npm run typecheck
npm run build
```

Expected: token tests pass, typecheck passes, and the site builds with local fonts and no raw brand hex values outside `tokens.css`.

Run this source guard and expect no output:

```bash
if rg -n '#(16263d|f06d5e|f7f3ea|3d8b83|83cdc4|19222e)' src --glob '!src/styles/tokens.css'; then exit 1; fi
```

- [ ] **Step 7: Commit the foundations**

```bash
git add design-system src/styles src/lib/design-system src/layouts/SiteLayout.astro
git commit -m "feat: establish IROA Web3 design system"
```

---

### Task 3: Create the truthful content and protocol contracts

**Files:**
- Create: `src/lib/content/status.ts`
- Create: `src/lib/content/status.test.ts`
- Modify: `src/content/home.ko.ts`
- Create: `src/content/home.ko.test.ts`
- Create: `src/lib/protocol/flow.ts`
- Create: `src/lib/protocol/flow.test.ts`

**Interfaces:**
- Produces: `type PublicStatus = 'current' | 'next' | 'planned' | 'validation' | 'research'`.
- Produces: `getStatusLabel(status: PublicStatus): string`.
- Produces: `PROTOCOL_STAGES: readonly ProtocolStage[]` in Request, Task Capsule, Verified Node, Proof Receipt, Base Settlement order.
- Produces: `homeKo` data consumed by all homepage sections.

- [ ] **Step 1: Write failing status and protocol tests**

Create tests with these exact assertions:

```ts
expect(getStatusLabel('current')).toBe('현재');
expect(getStatusLabel('validation')).toBe('검증 중');
expect(PROTOCOL_STAGES.map(({ id }) => id)).toEqual([
  'request', 'task-capsule', 'verified-node', 'proof-receipt', 'base-settlement',
]);
expect(PROTOCOL_STAGES.at(-1)).toMatchObject({
  network: 'Base',
  asset: 'Circle Native USDC',
});
expect(PRIVACY_BOUNDARY.onChain).not.toContain('개인정보 원문');
expect(PRIVACY_BOUNDARY.offChain).toContain('개인정보 원문');
```

- [ ] **Step 2: Run the contract tests and verify RED**

Run:

```bash
npm run test:run -- src/lib/content/status.test.ts src/lib/protocol/flow.test.ts src/content/home.ko.test.ts
```

Expected: FAIL because the new closed status and protocol contracts do not exist.

- [ ] **Step 3: Implement the status vocabulary**

Create `status.ts`:

```ts
export type PublicStatus = 'current' | 'next' | 'planned' | 'validation' | 'research';

export const STATUS_LABELS: Record<PublicStatus, string> = {
  current: '현재',
  next: '다음',
  planned: '계획',
  validation: '검증 중',
  research: '장기 연구',
};

export const getStatusLabel = (status: PublicStatus) => STATUS_LABELS[status];
```

- [ ] **Step 4: Implement the protocol contract and approved Korean homepage content**

Define `ProtocolStage` with `id`, `label`, `description`, optional `network`, and optional `asset`. Define the five exact stages from the spec and the off-chain privacy boundary. Rewrite `home.ko.ts` around the new hero, four planes, Node proof, settlement, economy status, whitepaper entry, roadmap, and contact content. Keep every capability status explicit.

- [ ] **Step 5: Add prohibited-claim tests**

Serialize `homeKo` and assert it does not contain `수익 보장`, `상장 예정`, `운영 중인 Base 정산`, `공식 파트너`, or `토큰 구매`. Assert it contains `Base`, `Circle Native USDC`, `개인정보 원문`, and `검증 중`.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm run test:run -- src/lib/content/status.test.ts src/lib/protocol/flow.test.ts src/content/home.ko.test.ts
npm run typecheck
```

Expected: all content and protocol tests pass.

- [ ] **Step 7: Commit the contracts**

```bash
git add src/lib/content src/lib/protocol src/content/home.ko.ts src/content/home.ko.test.ts
git commit -m "feat: define IROA protocol content contracts"
```

---

### Task 4: Build primitives and the responsive site shell

**Files:**
- Create: `src/components/primitives/ButtonLink.astro`
- Create: `src/components/primitives/StatusBadge.astro`
- Create: `src/components/primitives/SectionIntro.astro`
- Create: `src/components/SiteHeader.astro`
- Create: `src/components/SiteFooter.astro`
- Modify: `src/layouts/SiteLayout.astro`
- Modify: `e2e/site-shell.spec.ts`

**Interfaces:**
- `ButtonLink` props: `{ href: string; variant?: 'primary' | 'secondary' | 'quiet'; external?: boolean; fileMeta?: string }`.
- `StatusBadge` props: `{ status: PublicStatus; label?: string }`.
- `SectionIntro` props: `{ eyebrow: string; title: string; lead?: string; id?: string }`.
- Header navigation targets: `/#protocol`, `/#network`, `/#economy`, `/whitepaper`, and `/#roadmap`.

- [ ] **Step 1: Extend the browser test with failing shell expectations**

Add assertions for the official `IROA.AI 홈` wordmark, primary navigation, the `웹 백서 읽기` action, skip-link focus, and a mobile disclosure menu whose links remain keyboard reachable.

- [ ] **Step 2: Run the shell test and verify RED**

Run: `npm run test:e2e -- e2e/site-shell.spec.ts`

Expected: FAIL because the shared header, footer, and primitives are absent.

- [ ] **Step 3: Implement the primitives**

Use semantic anchors, visible text, `data-variant`, and status text. `ButtonLink` must add `target="_blank" rel="noreferrer"` and a Lucide external-link icon plus screen-reader text only when `external` is true. When `fileMeta` is provided, show the file format and build-time size next to the label. `StatusBadge` must render both a decorative shape and a Korean label from `getStatusLabel`.

- [ ] **Step 4: Implement the header and footer**

Use the official file `docs/brand/masters/wordmark/iroa-wordmark-color.svg` without altering its proportions. Use native `<details>` and `<summary>` for the mobile menu so the shell remains operable without client JavaScript. Use Lucide Astro icons for interface icons; do not create emoji or bespoke icon SVGs.

- [ ] **Step 5: Compose the shell in `SiteLayout`**

Render the skip link before `SiteHeader`, wrap the slot in the single main landmark, and render `SiteFooter` after main. Keep the document title and canonical metadata in the layout.

- [ ] **Step 6: Verify GREEN at desktop and mobile sizes**

Run:

```bash
npm run build
npm run test:e2e -- e2e/site-shell.spec.ts
```

Expected: the navigation, official wordmark, skip link, mobile disclosure, and footer are visible and keyboard operable.

- [ ] **Step 7: Commit the shared shell**

```bash
git add src/components/primitives src/components/SiteHeader.astro src/components/SiteFooter.astro src/layouts/SiteLayout.astro e2e/site-shell.spec.ts
git commit -m "feat: build IROA public site shell"
```

---

### Task 5: Build the reusable IROA protocol patterns

**Files:**
- Create: `src/components/patterns/ProtocolPath.astro`
- Create: `src/components/patterns/TaskCapsule.astro`
- Create: `src/components/patterns/VerifiedNode.astro`
- Create: `src/components/patterns/ProofReceipt.astro`
- Create: `src/components/patterns/SettlementRecord.astro`
- Create: `src/components/patterns/PrivacyBoundary.astro`
- Create: `e2e/home-web3.spec.ts`

**Interfaces:**
- `ProtocolPath` consumes `readonly ProtocolStage[]` and renders an ordered list.
- `TaskCapsule` consumes `{ purpose: string; permission: string; dataClass: 'D0' | 'D1' | 'D2' | 'D3' | 'D4'; duration: string; status: PublicStatus }`.
- `VerifiedNode` consumes `{ level: 'N0' | 'N1' | 'N2' | 'N3' | 'N4'; status: PublicStatus; description: string }`.
- `ProofReceipt` consumes `{ result: string; proofId: string; policyVersion: string; disputeState: string }`.
- `SettlementRecord` consumes `{ network: 'Base'; asset: 'Circle Native USDC'; status: PublicStatus }`.
- `PrivacyBoundary` consumes the exported `PRIVACY_BOUNDARY` object.

- [ ] **Step 1: Write the failing protocol-pattern browser test**

Create `e2e/home-web3.spec.ts` and assert that the homepage exposes a region named `IROA 프로토콜 경로`, five ordered stage labels, an N2 Node, a proof receipt, Base, Circle Native USDC, and the sentence `개인정보 원문은 오프체인에 머뭅니다.`.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test:e2e -- e2e/home-web3.spec.ts`

Expected: FAIL because the IROA protocol patterns are not rendered.

- [ ] **Step 3: Implement the six patterns**

Use ordered lists, definition lists, headings, and labels before visual connectors. Use CSS borders only for connection lines and Lucide icons for stage glyphs. Keep the same DOM order on desktop and mobile. Mark purely decorative lines `aria-hidden="true"`. Do not expose fake transaction hashes or partner identities.

- [ ] **Step 4: Add pattern state and responsive CSS**

Desktop renders the path across the Network Atlas surface. Mobile converts it into a vertical path without shrinking text below 16px. The text-list representation remains visible to assistive technology and is not replaced by a canvas-only diagram.

- [ ] **Step 5: Wire a minimal pattern sample into the homepage**

Import `PROTOCOL_STAGES` and `PRIVACY_BOUNDARY` in `src/pages/index.astro` and render `ProtocolPath` and `PrivacyBoundary` beneath the temporary H1 shell.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm run test:run -- src/lib/protocol/flow.test.ts
npm run build
npm run test:e2e -- e2e/home-web3.spec.ts
```

Expected: all protocol data and browser assertions pass.

- [ ] **Step 7: Commit the protocol patterns**

```bash
git add src/components/patterns src/pages/index.astro src/styles/components.css e2e/home-web3.spec.ts
git commit -m "feat: add IROA protocol patterns"
```

---

### Task 6: Compose the selected Network Atlas homepage

**Files:**
- Create: `src/components/sections/HomeHero.astro`
- Create: `src/components/sections/ProtocolPlanes.astro`
- Create: `src/components/sections/NetworkProof.astro`
- Create: `src/components/sections/SettlementOverview.astro`
- Create: `src/components/sections/EconomyStatus.astro`
- Create: `src/components/sections/WhitepaperEntry.astro`
- Create: `src/components/sections/RoadmapPreview.astro`
- Create: `src/components/sections/ParticipationContact.astro`
- Create: `tools/website/render-og-image.mjs`
- Create: `public/og/iroa-network-atlas.png`
- Modify: `package.json`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/pages.css`
- Modify: `e2e/home-web3.spec.ts`

**Interfaces:**
- Each section owns one `id`: `top`, `protocol`, `network`, `economy`, `whitepaper-entry`, `roadmap`, or `contact`.
- `HomeHero` consumes `homeKo.hero` and the shared protocol path.
- `WhitepaperEntry` links to `/whitepaper` as the primary document action and `docs/whitepaper/exports/IROA_WHITEPAPER_KO.pdf` as the secondary download.

- [ ] **Step 1: Extend the homepage test with failing section assertions**

Assert the exact hero H1, four plane headings, one main CTA `네트워크 살펴보기`, one secondary CTA `웹 백서 읽기`, status labels for Base, Native USDC, off-chain personal data, and IROA reward validation, plus all seven homepage section IDs. Assert that the contact section says `공식 문의 채널 준비 중`, links to the whitepaper, and contains no form, `mailto:`, or fake submit control.

- [ ] **Step 2: Run the homepage test and verify RED**

Run: `npm run test:e2e -- e2e/home-web3.spec.ts`

Expected: FAIL because only the pattern sample exists.

- [ ] **Step 3: Build the hero and protocol-plane sections**

Implement the selected Network Atlas composition: strong left-side message, restrained facts, and the execution path as the principal right-side product visualization. Do not use the previous documentary hero photograph. Render Interaction, Control, Execution, and Settlement as one connected system rather than a card grid.

- [ ] **Step 4: Build Network, settlement, and economy sections**

Use `VerifiedNode`, `ProofReceipt`, `SettlementRecord`, and `PrivacyBoundary`. State that consumer payment is KRW/card/bank transfer, B2B settlement uses Base and Native USDC, and IROA rewards remain in validation. Include no live balances, fictional usage numbers, or invented transaction IDs.

- [ ] **Step 5: Build whitepaper entry and roadmap sections**

Show document title, version, Korean master language, publication status, three representative chapter links, and the PDF as a secondary download. Render roadmap phases with status, entry criteria, and evidence rather than dates that are not supported.

Build `ParticipationContact.astro` as an institutional and pilot-contact readiness surface. Explain what an eventual inquiry should include and provide a whitepaper link, but do not invent an email address or render a form, success message, or submission state until an endpoint and privacy notice are approved.

- [ ] **Step 6: Compose `src/pages/index.astro`**

Use this order:

```astro
<HomeHero content={homeKo.hero} />
<ProtocolPlanes content={homeKo.protocol} />
<NetworkProof content={homeKo.network} />
<SettlementOverview content={homeKo.settlement} />
<EconomyStatus content={homeKo.economy} />
<WhitepaperEntry content={homeKo.whitepaper} />
<RoadmapPreview content={homeKo.roadmap} />
<ParticipationContact content={homeKo.contact} />
```

- [ ] **Step 7: Render the deterministic share image**

Create a standalone Playwright script that renders a 1200×630 light Network Atlas composition using the approved wordmark, Navy, Coral, Ivory, and Teal roles. It must show the execution path and the message `현실 세계를 위한 검증 가능한 실행 네트워크.` without photography, wallet balances, or speculative token imagery. The script writes `public/og/iroa-network-atlas.png`, exits nonzero if the dimensions differ, and is called through `npm run render:og` before Astro builds:

```json
{
  "scripts": {
    "render:og": "node tools/website/render-og-image.mjs",
    "build": "npm run sync:whitepaper-assets && npm run render:og && npm run typecheck && astro build"
  }
}
```

- [ ] **Step 8: Verify content, metadata, build, and responsive reflow**

Run:

```bash
npm run test:run -- src/content/home.ko.test.ts
npm run build
npm run test:e2e -- e2e/home-web3.spec.ts
```

Expected: all homepage sections, statuses, links, share metadata, and viewports pass; the share image is exactly 1200×630.

- [ ] **Step 9: Commit the homepage**

```bash
git add src/components/sections src/pages/index.astro src/styles/pages.css e2e/home-web3.spec.ts tools/website/render-og-image.mjs public/og/iroa-network-atlas.png package.json
git commit -m "feat: build IROA Network Atlas homepage"
```

---

### Task 7: Build the canonical whitepaper loader and asset pipeline

**Files:**
- Create: `docs/whitepaper/IROA_WHITEPAPER_KO.meta.json`
- Create: `src/lib/whitepaper/types.ts`
- Create: `src/lib/whitepaper/assets.ts`
- Create: `src/lib/whitepaper/load.ts`
- Create: `src/lib/whitepaper/load.test.ts`
- Create: `tools/website/sync-whitepaper-assets.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `loadWhitepaper(): Promise<WhitepaperPublication>`.
- Produces: `WhitepaperPublication` with `metadata`, `preambleHtml`, and exactly 22 `chapters`.
- Produces: `WhitepaperChapter` with `number`, `slug`, `title`, `html`, `headings`, `previous`, and `next`; every lower heading has a unique locked anchor.
- Produces: generated asset URLs rooted at `/generated/docs/`.

- [ ] **Step 1: Write the failing whitepaper source test**

Create `load.test.ts` with these assertions:

```ts
const publication = await loadWhitepaper();
expect(publication.metadata).toMatchObject({
  title: 'IROA.AI 백서',
  version: '1.0',
  language: 'ko-KR',
});
expect(publication.chapters).toHaveLength(22);
expect(publication.chapters[0]).toMatchObject({ number: 1, slug: 'core-declaration' });
expect(publication.chapters[21]).toMatchObject({ number: 22, slug: 'conclusion' });
expect(publication.chapters[15].html).toContain('10,000,000,000');
expect(new Set(publication.chapters.map(({ slug }) => slug)).size).toBe(22);
```

- [ ] **Step 2: Run the loader test and verify RED**

Run: `npm run test:run -- src/lib/whitepaper/load.test.ts`

Expected: FAIL because the metadata, loader, and chapter model do not exist.

- [ ] **Step 3: Add locked publication metadata and chapter slugs**

Create `IROA_WHITEPAPER_KO.meta.json` with title `IROA.AI 백서`, version `1.0`, date `2026-08-21`, language `ko-KR`, controlling language `Korean`, status `published`, the existing PDF path, and this exact ordered slug list:

```json
[
  "core-declaration", "daily-journeys", "problem-and-market", "product-system",
  "safe-execution", "mobile", "watch", "secure-execution-space", "ai-kiosk",
  "service-architecture", "ai-technology", "privacy-and-safety",
  "health-and-wearables", "data-contribution", "reward-economy", "token-economy",
  "business-model", "roadmap", "operations-and-accountability", "risks",
  "prelaunch-validation", "conclusion"
]
```

The publication status describes the document edition. Feature-level statements inside the document retain their own planned or validation language.

- [ ] **Step 4: Implement the typed loader**

Read the canonical Markdown from `docs/whitepaper/IROA_WHITEPAPER_KO.md`. Treat only headings matching `/^## (\d+)\.\s+(.+)$/` as chapters so the unnumbered subtitle remains in the preamble. Reject missing numbers, reordered chapters, duplicate slugs, duplicate heading IDs, broken repository-local links, unknown metadata status, missing navigation entries, and counts other than 22. Validate the token allocation rows sum to 100% and `10,000,000,000 IROA`. Render GFM Markdown with `marked`, assign stable IDs with `github-slugger`, sanitize the static HTML, and rewrite local image URLs through `assets.ts`. Use `image-size` during the build to add intrinsic `width` and `height`; emitted images keep alt text, use `loading="lazy"` below the first visible figure, and preserve a caption or adjacent source link.

- [ ] **Step 5: Implement deterministic asset synchronization**

The sync script must:

1. extract local Markdown image paths;
2. resolve each path under the repository root;
3. reject traversal outside the repository;
4. copy each file to `public/generated/<repository-relative-path>`;
5. preserve directories to avoid filename collisions;
6. remove only `public/generated/docs/whitepaper` and `public/generated/docs/brand` before rebuilding those generated copies.

Add `public/generated/` to `.gitignore`.

- [ ] **Step 6: Add failure-case tests**

Export a pure `parseWhitepaper(markdown, metadata)` helper. Test duplicate chapter numbers, missing chapter 22, duplicate slugs, duplicate lower-heading IDs, a broken internal Markdown link, missing previous/next navigation, allocation totals other than 100% or 10 billion IROA, a local image path outside the repository, and a broken local image. Each case must throw a message naming the failing chapter, heading, value, or path.

- [ ] **Step 7: Verify GREEN and generated assets**

Run:

```bash
npm run test:run -- src/lib/whitepaper/load.test.ts
npm run sync:whitepaper-assets
npm run typecheck
test -f public/generated/docs/whitepaper/analysis/iroa-token-allocation.png
```

Expected: all tests pass and the referenced whitepaper charts and brand photographs exist under generated public paths.

- [ ] **Step 8: Commit the whitepaper pipeline**

```bash
git add docs/whitepaper/IROA_WHITEPAPER_KO.meta.json src/lib/whitepaper tools/website/sync-whitepaper-assets.mjs .gitignore package.json package-lock.json
git commit -m "feat: add canonical whitepaper pipeline"
```

---

### Task 8: Publish the web whitepaper index and 22 chapter routes

**Files:**
- Create: `src/layouts/WhitepaperLayout.astro`
- Create: `src/components/whitepaper/DocumentControl.astro`
- Create: `src/components/whitepaper/ChapterIndex.astro`
- Create: `src/components/whitepaper/OnThisPage.astro`
- Create: `src/components/whitepaper/ChapterPager.astro`
- Create: `src/pages/whitepaper/index.astro`
- Create: `src/pages/whitepaper/[chapter].astro`
- Create: `src/pages/404.astro`
- Create: `e2e/whitepaper.spec.ts`
- Modify: `src/styles/pages.css`

**Interfaces:**
- `WhitepaperLayout` consumes `{ publication: WhitepaperPublication; current?: WhitepaperChapter }`.
- `ChapterIndex` consumes all chapters and optional current slug.
- `OnThisPage` consumes the current chapter's lower-level `headings` and links to every stable heading ID.
- `[chapter].astro` exports `getStaticPaths()` from `loadWhitepaper().chapters`.
- Every chapter page exposes one H1 for the publication and one H2 for the chapter title in the reader article.

- [ ] **Step 1: Write the failing reader browser tests**

Create tests that verify:

- `/whitepaper` shows version, date, publication status, Korean master, 22 chapter links, and PDF download;
- `/whitepaper/core-declaration` renders chapter 1 and links next to `daily-journeys`;
- `/whitepaper/token-economy` renders `10,000,000,000 IROA` and the allocation table;
- `/whitepaper/conclusion` links back to `prelaunch-validation` and has no next link;
- a direct chapter refresh returns 200 and preserves the page title;
- `/whitepaper/unknown-chapter` resolves to the branded 404 with links to `/` and `/whitepaper`;
- chapter subheadings have stable self-links whose targets survive direct refresh;
- all local whitepaper images have nonzero natural width.

- [ ] **Step 2: Run the reader test and verify RED**

Run: `npm run test:e2e -- e2e/whitepaper.spec.ts`

Expected: FAIL because `/whitepaper` and chapter routes do not exist.

- [ ] **Step 3: Implement document-control and navigation components**

Render title, version, date, primary language, status text, controlling-version sentence, PDF download, full chapter list, current chapter, the current chapter's local table of contents, and previous/next links. Compute the checked-in PDF size at build time and show it as `PDF · <size>` next to the download. The index and local table of contents use semantic navigation and lists; the reader does not rely on JavaScript for chapter navigation.

- [ ] **Step 4: Implement the whitepaper index**

Load the publication in the Astro frontmatter and render the preamble, document control, full 22-chapter index, privacy and status disclosure, and secondary PDF download. Set a unique title, description, canonical URL, and Korean language metadata.

- [ ] **Step 5: Implement static chapter generation**

Use:

```astro
---
import { loadWhitepaper } from '../../lib/whitepaper/load';

export async function getStaticPaths() {
  const publication = await loadWhitepaper();
  return publication.chapters.map((chapter) => ({
    params: { chapter: chapter.slug },
    props: { publication, chapter },
  }));
}
---
```

Render sanitized chapter HTML with `set:html`, inside an `<article>` whose accessible name is the chapter title. Keep tables inside responsive wrappers and figures paired with source alt text and captions.

- [ ] **Step 6: Add stable heading links and branded route recovery**

For every chapter subheading emitted by the loader, render the stable slug as the heading `id` and include a visible-on-focus permalink with an accessible label. Create `src/pages/404.astro` using the shared shell, `noindex,nofollow`, the heading `페이지를 찾을 수 없습니다.`, and actions to `홈으로` and `웹 백서 목차`. This single static recovery page is the fallback for unknown site and whitepaper routes.

- [ ] **Step 7: Implement reader responsive and print styles**

Desktop uses a sticky chapter index and 60–75-character article measure. Mobile replaces the sticky sidebar with a native disclosure containing the chapter index. Print hides navigation and controls, preserves headings and tables, and shows source URLs where meaningful.

- [ ] **Step 8: Verify GREEN**

Run:

```bash
npm run test:run -- src/lib/whitepaper/load.test.ts
npm run build
npm run test:e2e -- e2e/whitepaper.spec.ts
```

Expected: all 22 chapter pages build, direct routes return 200, navigation is complete, and assets load.

- [ ] **Step 9: Commit the web publication**

```bash
git add src/layouts/WhitepaperLayout.astro src/components/whitepaper src/pages/whitepaper src/pages/404.astro src/styles/pages.css e2e/whitepaper.spec.ts
git commit -m "feat: publish IROA web whitepaper"
```

---

### Task 9: Add the design-system inventory and complete quality gates

**Files:**
- Create: `src/pages/design-system.astro`
- Create: `e2e/accessibility.spec.ts`
- Modify: `e2e/site-shell.spec.ts`
- Modify: `e2e/home-web3.spec.ts`
- Modify: `e2e/whitepaper.spec.ts`
- Modify: `playwright.config.ts`
- Delete after all replacement checks pass: `index.html`
- Delete after all replacement checks pass: `vite.config.ts`
- Delete after all replacement checks pass: `src/main.tsx`
- Delete after all replacement checks pass: `src/App.tsx`
- Delete after all replacement checks pass: `src/App.test.tsx`
- Delete after all replacement checks pass: `src/components/EcosystemDiagram.tsx`
- Delete after all replacement checks pass: `src/components/Hero.tsx`
- Delete after all replacement checks pass: `src/components/InstitutionalModels.tsx`
- Delete after all replacement checks pass: `src/components/OrchestrationFlow.tsx`
- Delete after all replacement checks pass: `src/components/PilotContact.tsx`
- Delete after all replacement checks pass: `src/components/Roadmap.tsx`
- Delete after all replacement checks pass: `src/components/SafetyLayers.tsx`
- Delete after all replacement checks pass: `src/components/ScenarioStories.tsx`
- Delete after all replacement checks pass: `src/components/SectionIntro.tsx`
- Delete after all replacement checks pass: `src/components/SettlementNetwork.tsx`
- Delete after all replacement checks pass: `src/components/SiteFooter.tsx`
- Delete after all replacement checks pass: `src/components/SiteHeader.tsx`
- Delete after all replacement checks pass: `src/components/icons.tsx`
- Create: `docs/website/IROA_WEB3_SITE_VERIFICATION.md`

**Interfaces:**
- `/design-system` renders every primitive and IROA pattern in all supported states and uses `robots="noindex,nofollow"`.
- `accessibility.spec.ts` runs axe against `/`, `/whitepaper`, `/whitepaper/token-economy`, and `/design-system`.
- Public routes expose unique title, description, canonical URL, Open Graph image, and static core content.
- `robots.txt`, `sitemap-index.xml`, and the branded `404.html` exist in the static build.
- Final scripts `test:run`, `typecheck`, `build`, and `test:e2e` all exit 0.

- [ ] **Step 1: Write the failing design-system inventory test**

Add a browser assertion that `/design-system` contains headings for `Foundations`, `Primitives`, `Status`, `Protocol Patterns`, and `Whitepaper Reader`, includes primary/secondary/quiet actions and all five public statuses, and declares `noindex,nofollow`.

- [ ] **Step 2: Implement the inventory route**

Render the approved logo, color roles with contrast labels, type scale, spacing scale, icons, button states, status states, protocol patterns, privacy boundary, document control, and a reader sample. Use the real components; do not create separate demo-only copies.

- [ ] **Step 3: Add axe and keyboard tests**

Create `e2e/accessibility.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const path of ['/', '/whitepaper', '/whitepaper/token-economy', '/design-system']) {
  test(`${path} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
  });
}
```

Add keyboard checks for skip link, mobile navigation, chapter index, previous/next links, and visible focus.

- [ ] **Step 4: Add responsive, zoom, reduced-motion, and asset checks**

For 375, 768, 1024, and 1440px, assert `document.documentElement.scrollWidth <= window.innerWidth` on the homepage and whitepaper index. At 200% zoom-equivalent viewport, assert the article and controls remain visible. Emulate reduced motion and assert all nonessential animation durations become `0.01ms` or transitions are disabled. Assert every image is complete with nonzero natural width.

- [ ] **Step 5: Add metadata, static-fallback, and discovery checks**

For `/`, `/whitepaper`, one chapter, `/design-system`, and `/404.html`, assert unique page titles, nonempty descriptions, canonical links, robots directives, absolute Open Graph URLs, and the 1200×630 share image. Disable JavaScript and verify that the homepage protocol path, whitepaper chapter text, chapter links, and PDF download remain usable. After build, verify `dist/robots.txt`, `dist/sitemap-index.xml`, `dist/404.html`, and every sitemap-linked local route exist.

- [ ] **Step 6: Compare the browser result with the selected visual target**

Capture matching 1440px and 375px homepage screenshots plus representative whitepaper and design-system screenshots under `.superpowers/tmp/iroa-web3-site/`. Inspect the selected Network Atlas reference and implementation together. Fix visible hierarchy, typography, line connection, padding, radius, logo clear-space, cropping, and responsive differences before continuing.

- [ ] **Step 7: Remove the superseded SPA only after replacement verification passes**

Run the complete test suite first. If every command passes, delete the listed Vite entry files and superseded React homepage components. Keep shared approved content only if it is still imported by the Astro site; otherwise remove it in the same commit. Do not delete brand, whitepaper, presentation, or unrelated user files.

- [ ] **Step 8: Write the verification record**

Record:

- commit and branch;
- Node, npm, Astro, and browser-test versions;
- source test results;
- typecheck and build results;
- built route count;
- 22 whitepaper chapter count;
- browser viewport and accessibility results;
- screenshot paths;
- explicit deployment and live-operation non-claims.

- [ ] **Step 9: Run the final verification suite**

Run:

```bash
npm run test:run
npm run typecheck
npm run build
npm run test:e2e
python3 -m unittest tests.brand.test_brand_assets tests.brand.test_comparison_optical_parity
git diff --check
```

Expected: every command exits 0, the build contains `/`, `/whitepaper`, 22 chapter routes, `/design-system`, branded `404.html`, robots metadata, and sitemap output, and the worktree contains only intentional changes.

- [ ] **Step 10: Commit the verified delivery**

```bash
git add -A
git commit -m "test: verify IROA Web3 public site"
```

---

## Final Acceptance Checklist

- [ ] Astro static output replaces the old Vite SPA.
- [ ] The Track A wordmark and symbol remain unmodified.
- [ ] The reusable design system and `/design-system` inventory exist.
- [ ] The homepage matches the selected Network Atlas direction at 1440px and transforms intentionally at 375px.
- [ ] The homepage states Base, Circle Native USDC, off-chain personal data, and IROA reward validation truthfully.
- [ ] The canonical Korean Markdown produces one index and 22 stable chapter routes.
- [ ] Whitepaper images, charts, tables, headings, anchors, previous/next links, and PDF download work.
- [ ] Public routes expose complete canonical, Open Graph, robots, and sitemap metadata.
- [ ] Unknown routes recover through the branded 404 with homepage and whitepaper links.
- [ ] Homepage and whitepaper core content remain usable when JavaScript is disabled.
- [ ] No serious or critical axe violations remain on representative routes.
- [ ] Keyboard, reduced-motion, 200% zoom, and defined viewports pass.
- [ ] No unsupported partner, token-sale, yield, price, listing, live-settlement, or certification claim appears.
- [ ] The verification document distinguishes source, browser, deployment, and live-operation evidence.
