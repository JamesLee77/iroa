# Task 6 Report — IROA Network Atlas Homepage

## Delivery

- BASE commit: `e32019364c3b2bc254f251e00b2b88ad32788ff4`
- Task commit: `466fd5e`
- Commit message: `feat: build IROA Network Atlas homepage`
- Selected visual target: `/Users/hyunsuklee/.codex/generated_images/01a03e4c-2d98-7120-8c44-5b95ee7aa4b6/exec-c7c13d32-0329-4a6f-b024-450e591ce091.png` (`864 × 1821`)

## Implemented Scope

- Replaced the sample homepage with the approved light Network Atlas composition.
- Added all eight Task 6 section components:
  - `HomeHero`
  - `ProtocolPlanes`
  - `NetworkProof`
  - `SettlementOverview`
  - `EconomyStatus`
  - `WhitepaperEntry`
  - `RoadmapPreview`
  - `ParticipationContact`
- Composed all seven required section anchors exactly once: `top`, `protocol`, `network`, `economy`, `whitepaper-entry`, `roadmap`, `contact`.
- Reused the shared typed `homeKo` content, shared protocol stages, and existing Task Capsule, Verified Node, Proof Receipt, Settlement Record, Privacy Boundary, status, button, and section-intro patterns.
- Added a deterministic Playwright renderer for `public/og/iroa-network-atlas.png`; the script exits nonzero unless the generated PNG is exactly `1200 × 630`.
- Added `render:og` and placed it before typecheck/build without adding or calling the Task 7-owned `sync:whitepaper-assets` command.
- Exposed `/whitepaper` as the primary document action and intentionally omitted the PDF secondary action until Tasks 7–8 create a validated public asset.
- Scoped the retained shell CTA assertion to the header after the completed homepage introduced additional truthful `웹 백서 읽기` actions.

## RED Evidence

Command:

`npm run test:e2e -- e2e/home-web3.spec.ts`

Result before implementation: failed as expected.

- The complete homepage test failed because `Interaction Plane` and the other plane headings did not exist.
- The contact honesty test failed because `#contact` and `공식 문의 채널 준비 중` did not exist.
- The pre-implementation Astro build was otherwise green, proving the RED came from the missing Task 6 behavior rather than a broken baseline.

## GREEN and Validation Evidence

Focused content:

- `npm run test:run -- src/content/home.ko.test.ts`
- Result: `1` file passed, `2` tests passed.

Build and deterministic OG:

- `npm run build`
- Result: `render:og` wrote `public/og/iroa-network-atlas.png (1200x630)`; Astro check reported `0 errors`, `0 warnings`, `0 hints`; static build completed with `1 page`.

Focused browser suite:

- `npm run test:e2e -- e2e/home-web3.spec.ts`
- Result: `8 passed`.

Current unit/component suite:

- `npm run test:run`
- Result: `6` files passed, `21` tests passed.

Current full browser suite:

- `npm run test:e2e`
- Initial run exposed one retained shell test with an ambiguous global CTA locator after Task 6 correctly added more whitepaper links.
- Fix: scoped the assertion to `banner` without changing product behavior.
- Final result: `11 passed`.

Patch integrity:

- `git diff --check`
- `git diff --cached --check`
- Result: clean.

## Visual QA

The previous `.superpowers/tmp/iroa-homepage-v1/home-1440.png` and `home-375.png` were stale photo-led captures from a different server and were rejected as evidence.

Root-cause control:

- Rebuilt current HEAD.
- Served the built `dist` directory on unique port `4396`.
- Before every final capture, asserted the exact H1 `현실 세계를 위한 검증 가능한 실행 네트워크.`, zero hero images, absence of legacy photo copy, no horizontal overflow, and zero console errors.

Final actual captures:

- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-6-artifacts/home-1440.png` — `1440 × 8774`, viewport `1440 × 1000`, DPR 1.
- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-6-artifacts/home-375.png` — `375 × 14276`, viewport `375 × 1000`, DPR 1.
- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-6-artifacts/hero-1440.png` — focused hero evidence.
- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-6-artifacts/whitepaper-entry-1440.png` — focused document-composition evidence.
- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-6-artifacts/comparison-desktop.png` — source and normalized desktop implementation in one image.
- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-6-artifacts/comparison-mobile.png` — source and responsive mobile implementation in one image.

Visual comparison findings and fixes:

- P1 found in first capture: the 1440 Korean hero title wrapped into four awkward lines and split words, changing the selected reference hierarchy.
- Fix: widened the hero copy share, reduced the optical display scale, expanded its measure, and applied Korean `word-break: keep-all`.
- Post-fix: desktop and mobile both preserve a strong three-line title hierarchy; the Coral path, four plane labels, Base/Native USDC terminal, compact facts, and whitepaper composition match the selected direction.
- The 375 layout intentionally uses full-width CTAs, a vertical atlas path, single-column sections, and keep-all Korean wrapping. The full page remains long because all eight required evidence-rich sections remain visible rather than being hidden or collapsed.
- `task-6-design-qa.md` records `final result: passed`; no actionable P0, P1, or P2 findings remain.

## Truth and Scope Checks

- No photo-led hero.
- No gradients.
- No wallet balances, fictional transaction IDs, unsupported metrics, or speculative token imagery.
- Consumer payment remains KRW/card/bank transfer/existing channels.
- Base and Circle Native USDC are labeled as planned B2B settlement direction, not current operation.
- IROA rewards remain validation-stage.
- Personal and sensitive source data remain explicitly off-chain.
- Contact surface has no form, submit button, `mailto:`, or fake success state.
- PDF link is deferred; no broken repository path is emitted.
- `.astro/` remained pre-existing, untracked, unstaged, and untouched.

## Concerns / Follow-up

- `/whitepaper` and chapter routes are intentionally future Task 8 consumers; Task 6 exposes their approved navigation contract before those routes are built.
- The mobile page is dense because the public evidence is intentionally not hidden. A later whitepaper implementation may introduce native disclosures for document navigation without removing content.
- The faint global mesh in the generated concept is reduced to the approved CSS-border protocol connectors, avoiding decorative raster/CSS art and keeping the diagram semantic.

## Fix Round 1/5 — Truth, Accessibility, Durable Evidence, Semantic Color

Fix commit: `0a3172b`; the original `466fd5e` commit was not amended.

### RED

- `npm run test:run -- src/lib/design-system/tokens.test.ts` failed `defines --color-settlement` because the semantic token was absent.
- `npm run test:e2e -- e2e/home-web3.spec.ts` failed because Base and Native USDC facts did not expose visible `계획`, and the computed settlement token was empty.
- The dedicated atlas accessibility test returned zero ordered list items because `role="img"` flattened its descendants.
- The dedicated 375 × 1000 first-viewport test found the planned Base status at viewport ratio `0` because the fact strip followed the complete atlas on mobile.

### GREEN changes

- Base Primary Network and Native USDC Settlement each expose a separate visible `계획` label in the hero fact strip.
- Mobile source order and responsive grid placement put the fact strip before the atlas while preserving the desktop two-column hero, keeping both planned labels in the 375 × 1000 first viewport.
- The Base terminal now reads `Native USDC · 계획`; the deterministic OG reads `Base Settlement · 계획` and `Native USDC · 계획`.
- The atlas is a named region with named ordered stage and plane lists; it retains Voice Request, Task Capsule, Verified Node, Proof Receipt, Base Settlement, Native USDC, and all four planes in accessibility APIs.
- `--color-settlement` owns the Base blue value, and the homepage uses the semantic token instead of a raw page color.
- The settlement blue is `#246fd4`: 4.88:1 against White, so it works for the small OG settlement label and exceeds the 3:1 graphical-object requirement for the homepage marker. The current light theme consumes it; no unevidenced dark-theme settlement color is added.
- The QA record moved from untracked root `design-qa.md` to durable `task-6-design-qa.md` in this task evidence package. The root artifact was removed.

### Fresh visual evidence

- `task-6-artifacts/fix-round-1-home-1440.png` — 1440 × 8797 full page; viewport capture alongside it.
- `task-6-artifacts/fix-round-1-home-375.png` — 375 × 14324 full page; viewport capture alongside it.
- Both capture runs asserted visible planned facts, five accessible atlas stages, no horizontal overflow, and zero console errors before writing screenshots.
- `public/og/iroa-network-atlas.png` — regenerated at exactly 1200 × 630 and visually inspected with both planned qualifiers visible.

### Final validation

- Focused content/token tests: 2 files, 12 tests passed.
- Focused homepage E2E: 11 tests passed.
- Full unit/component suite: 6 files, 22 tests passed.
- Full E2E suite: 14 tests passed.
- Build/typecheck: `0 errors`, `0 warnings`, `0 hints`; one static route built.
- OG dimension assertion: 1200 × 630.
- `git diff --check`: clean.

## Fix Round 2/5 — Mobile Hero Hierarchy

Fix commit: recorded in the handoff after validation; neither `466fd5e` nor `0a3172b` is amended.

### RED

- Added a focused 375 × 1000 browser regression requiring both compact Base/Native USDC textual `계획` qualification and at least 10% of the named Network Atlas region in the first viewport.
- `npm run test:e2e -- e2e/home-web3.spec.ts -g "keeps planned settlement qualifiers and the atlas"` failed because the compact mobile settlement plan did not exist. The pre-test build/typecheck remained green, isolating the failure to the missing responsive hierarchy.

### GREEN changes

- Returned the complete four-item fact strip after the Network Atlas in source order. Explicit desktop grid placement keeps the selected reference's copy/atlas/facts composition unchanged.
- Added a compact mobile-only settlement summary near the primary actions: `Base · 계획` and `Native USDC · 계획`.
- The compact labels are derived from the same typed planned facts and use real text in a named list; status truth is neither generated by CSS nor hidden from accessibility APIs.
- The existing ordered atlas stage/plane lists and the OG planned qualifiers remain intact.
- The focused test passes with the atlas beginning at 822 px and 27.5% of the atlas visible in the 375 × 1000 first viewport.

### Fresh visual evidence

- `task-6-artifacts/fix-round-2-home-1440.png` — 1440 × 8797 full page; viewport capture alongside it.
- `task-6-artifacts/fix-round-2-home-375.png` — 375 × 14360 full page; viewport capture alongside it.
- `task-6-artifacts/fix-round-2-comparison-1440.png` and `fix-round-2-comparison-375.png` place the exact selected reference hero crop and implementation first viewport in a single comparison input.
- Capture assertions verified the exact Task 6 H1, absence of legacy photo content, five accessible atlas stages, no horizontal overflow, zero console errors, both compact mobile planned qualifiers, and at least 10% atlas intersection before writing the images.

### Visual comparison

- Desktop remains aligned to the selected light Network Atlas: large left message, Coral path, Base/Native USDC terminal, compact trust strip, and the facts row below the two-column hero.
- Mobile now preserves the approved message + atlas hierarchy. Both planned qualifiers fit above the trust strip, and the atlas visibly begins within the first viewport instead of following four full-width fact rows.
- The selected source has no mobile frame; the responsive comparison therefore assesses preserved hierarchy and content truth rather than claiming pixel parity.

### Final validation

- Focused content/token tests: 2 files, 12 tests passed.
- Focused homepage E2E: 11 tests passed.
- Full unit/component suite: 6 files, 22 tests passed.
- Full E2E suite: 14 tests passed.
- Build/typecheck: `0 errors`, `0 warnings`, `0 hints`; one static route built.
- OG dimension assertion: 1200 × 630.
- `git diff --check`: clean.
