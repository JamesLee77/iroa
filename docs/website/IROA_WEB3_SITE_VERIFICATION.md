# IROA Web3 Public Site Verification

## Delivery identity

- Branch: `codex/iroa-homepage-v1`
- BASE: `d0509382910b5b778b9ac1804556f7831338d439`
- Initial Task 9 commit: `6036d18b0f5d7e4042efff7237482dd347f37e74` (`test: verify IROA Web3 public site`).
- Fix Round 1 commit: the commit containing the reviewed contract corrections with subject `fix: harden Task 9 verification contracts`; its immutable hash is recorded in the Task 9 SDD report after commit creation.
- Runtime: macOS `26.5.1` (`25F80`), Node.js `v25.8.2`, npm `11.11.1`, Python `3.14.7`.
- Site tooling: Astro `7.2.9`, TypeScript `6.0.3`, Vitest `4.1.11`, Playwright `1.62.1`, `@axe-core/playwright` `4.13.0`.

## Delivered static surface

The Astro build emits 26 HTML pages:

- `/`
- `/404.html`
- `/design-system` — internal inventory, `noindex,nofollow`, excluded from sitemap
- `/whitepaper`
- 22 stable `/whitepaper/*` chapter routes

The sitemap advertises 24 public canonical URLs: the homepage, whitepaper index, and 22 chapters. It intentionally omits the 404 page and internal design-system route. The Korean whitepaper remains exactly 22 chapters.

Discovery output includes `robots.txt`, `sitemap-index.xml`, `sitemap-0.xml`, a branded 404 page, an ICO favicon, SVG favicon, Apple touch icon, and a `1200 × 630` Open Graph image. Canonical and Open Graph URLs are absolute. The exact approved Track A wordmark remains the source asset. The SVG favicon declares `sizes="any"`; the ICO declares `16x16 32x32 48x48`.

## Final verification commands and results

The final acceptance gate runs `npm run test:run`, `npm run typecheck`, `npm run build`, `npm run test:e2e`, `python3 -m unittest tests.brand.test_brand_assets tests.brand.test_comparison_optical_parity`, and `git diff --check` from the repository root. Every command exits `0`.

- Unit: 11 files, 56 tests passed after the superseded six-test React suite was removed and the token-derived contrast contract was added. The pre-cleanup replacement gate passed 11 files and 61 tests.
- Typecheck: 58 Astro files, 0 errors, 0 warnings, 0 hints.
- Build: 26 pages, including exactly 22 chapter outputs; sitemap emitted.
- Browser E2E: 47 tests passed.
- Brand/optical parity: 69 tests passed.
- Diff integrity: clean.

The brand suite discovers the currently installed packaged document runtime deterministically, requires exactly one supported `documents/*/skills/documents` match, and verifies the pinned accessibility-auditor SHA before use. No compatibility path or tool-cache mutation is required.

## Accessibility and resilient operation

- Axe WCAG 2.2 AA representative routes: `/`, `/whitepaper`, `/whitepaper/token-economy`, and `/design-system`; zero serious or critical violations.
- Keyboard: the skip link receives focus and transfers it to `main`. In a no-JavaScript 1440-pixel reader, real `Tab` presses traverse the desktop chapter index in DOM order, continue through the remaining focusable document controls, then reach previous and next chapter links in order. Each asserted target passes `toBeFocused()` and exposes a visible solid outline at least 3 CSS pixels wide. The native mobile disclosure remains keyboard reachable without client JavaScript.
- Responsive: homepage and whitepaper geometry at `375`, `768`, `1024`, and `1440` CSS pixels has no horizontal overflow.
- Zoom: `720` CSS-pixel viewport provides the 200%-zoom equivalent of a 1440-pixel desktop; core article and controls remain visible.
- Reduced motion: nonessential transition and animation durations collapse to at most `0.01ms`; document scroll behavior is `auto`.
- No JavaScript: homepage protocol content, whitepaper index/chapter text, chapter links, and PDF download remain usable.
- Images: canonical homepage and whitepaper images complete with nonzero natural dimensions. The build contains the approved `1200 × 630` PNG share image.
- PDF: source and emitted publication remain byte-identical at `3,586,280` bytes with source SHA-256 `2dd9285e2ee0b4a79399a696371d4d28dc6cbe97336740a66ddbadc0631d7ffb`.

## Token contrast and favicon authority

The design-system inventory reports contrast from one calculation path: it imports the actual production `tokens.css`, resolves semantic-token aliases, applies the WCAG 2.x sRGB relative-luminance formula, and formats the result to two decimals. The resulting pairs are Navy/Background `14.57:1`, Navy/White `15.23:1`, Navy/Coral `5.12:1`, Teal/White `4.02:1`, and White/Settlement `4.88:1`.

The site semantic tokens are the inventory authority because the inventory describes the deployed site system. The BI guide remains authoritative for brand palette values, but the site intentionally uses `--color-bg: #F9FAFB` rather than BI Ivory `#F7F3EA`, and its settlement Blue `#246FD4` is a site semantic color not defined in the BI palette. The focused unit contract fails if either production token values or published calculated evidence drift.

The ICO is built without resampling by embedding the three approved slot-specific PNG byte streams directly:

- `docs/brand/exports/icons/favicon-16.png` — `16 × 16`, SHA-256 `fa0961cda6540e93eb285c2f29c138932fce1e326cf23fb989afb2ba0b0c1458`
- `docs/brand/exports/icons/favicon-32.png` — `32 × 32`, SHA-256 `634bbdc7b4cb2d6937ddace8f3387b0db2c3bdfa44aa38a6a6c93287ae26cdfd`
- `docs/brand/exports/icons/favicon-48.png` — `48 × 48`, SHA-256 `367131165bda091100878b8be4cd7c0ae0051ff53d9f2b3858569761701fd01e`

The generated `public/favicon.ico` SHA-256 is `2c04646d2fe6150b1d0484bc0f4e9d756df33ef74e405c63af0d47248670455c`. The brand test decodes each embedded ICO frame and compares its RGBA pixels with the approved same-size PNG.

## Visual evidence

The durable clean-checkout package is [Task 9 Final Visual QA](./evidence/task-9-final/QA.md). It contains the exact selected reference, direct final captures, and paired comparison inputs for:

- homepage at 1440 CSS pixels;
- homepage at 375 CSS pixels;
- representative token-economy reader;
- internal design-system inventory.

The final dedicated-port capture pass asserted route identity before every screenshot and reported no horizontal overflow or page errors. Favicon requests returned HTTP 200.

## Legacy replacement boundary

The full replacement suite passed before cleanup. The removed Vite entry points and superseded React homepage components were referenced only by the old React graph. Their still-relevant behavioral contracts are covered by the Astro unit and browser suites: homepage hierarchy/actions, protocol truth boundaries, mobile navigation, public statuses, roadmap semantics, and the no-contact-collection rule. Canonical content, brand, whitepaper, presentations, Astro components, and unrelated files were preserved.

`.astro/` was verified as generated declarations and preview state only, added to `.gitignore`, and removed as generated output after verification.

## Evidence boundaries

- Source evidence: repository code, unit tests, type diagnostics, brand checks, generated static artifacts, and this tracked verification record.
- Browser evidence: local Playwright/Chromium behavior, axe results, keyboard/no-JS checks, responsive geometry, and screenshot comparisons against the selected reference.
- Deployment evidence: none. No hosting target, CDN, DNS, production redirect, or deployed URL was exercised.
- Live-operation evidence: none. The site does not prove live NODE availability, Base settlement, Native USDC settlement, reward issuance, token sale, partner certification, or institutional operation. Public status labels remain the authority for planned, validating, and research states.
