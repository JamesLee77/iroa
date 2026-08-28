# Task 8 Web Whitepaper Design QA

Source visual truth: `/Users/hyunsuklee/.codex/generated_images/01a03e4c-2d98-7120-8c44-5b95ee7aa4b6/exec-c7c13d32-0329-4a6f-b024-450e591ce091.png`

Implementation evidence:

- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-8-artifacts/whitepaper-index-1440-full.png`
- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-8-artifacts/whitepaper-token-1440-full.png`
- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-8-artifacts/whitepaper-token-375-viewport.png`
- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-8-artifacts/whitepaper-token-768-viewport.png`
- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-8-artifacts/whitepaper-token-1024-viewport.png`
- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-8-artifacts/whitepaper-token-1440-viewport.png`
- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-8-artifacts/whitepaper-core-375-no-js-index.png`
- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-8-artifacts/whitepaper-core-print-1440.png`
- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-8-artifacts/whitepaper-404-1440.png`

Combined comparison inputs:

- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-8-artifacts/comparison-whitepaper-desktop.png`
- `.superpowers/sdd/2026-08-28-iroa-design-system-homepage-whitepaper/task-8-artifacts/comparison-whitepaper-mobile.png`

## Viewport and normalization

- Source visual: `864 × 1821` px. The embedded whitepaper region was cropped to `864 × 976` from the exact source without resampling.
- Desktop implementation: CSS viewport `1440 × 1000`, `deviceScaleFactor: 1`. The current full index capture is `1440 × 3017`; its top document region was cropped and normalized to `864 × 976` for an equal-pixel side-by-side comparison.
- Chapter full page: CSS viewport `1440 × 1000`, `deviceScaleFactor: 1`; full-page output is `1440 × 7516`.
- Responsive captures: CSS widths `375`, `768`, `1024`, and `1440`, height `1000`, `deviceScaleFactor: 1`.
- Mobile combined input: the source has no prescribed mobile reader state. Its document crop was proportionally normalized to `375` px wide and placed beside the actual `375 × 1000` initial page state. This comparison judges retained information hierarchy rather than claiming pixel parity.

State: light theme; `/whitepaper` index and `/whitepaper/token-economy` chapter; initial load plus reader-title focus; no authenticated or live-operation state; no client-side enhancement required.

## Full-view comparison evidence

The combined desktop input preserves the selected reference's document character: a clear control surface, full left chapter index, white reading plane, restrained one-pixel borders, Navy hierarchy, Teal document location cues, and Coral action/document accents. The production reader replaces generated English/Korean microcopy with the canonical Task 7 publication, so chapter names, status, figures, tables, and disclosures are source-backed rather than copied from the concept board.

The chapter capture maintains a 68ch reading measure inside a broad engineering surface. The sticky chapter rail, local heading list, table wrappers, figures, and previous/next controls form one continuous document rather than generic blog cards. At `375` and `768`, the rail becomes one native disclosure; content and navigation remain usable with JavaScript disabled.

The responsive capture assertions reported document width equal to viewport width at all four target breakpoints, one publication H1, one chapter H2, zero broken images, and zero console or page errors. The unknown chapter capture is the actual HTTP 404 response, not a normal page styled as an error.

## Focused region evidence

- Document control: the reference and implementation both expose title/version/status/download as a precise bordered control. The implementation additionally exposes the canonical date, Korean-master authority, real hashed PDF URL, and build-time file size.
- Reader navigation: the desktop capture shows the entire 22-item index with the current chapter distinguished by text, background, and Teal border. The no-JS mobile capture shows the same content inside a native open disclosure.
- Canonical data: the full token chapter shows the exact allocation table and three checked-in analytical images at declared dimensions, with captions and responsive containment.
- Print: Chromium print media hid the site header, footer, full chapter index, local ToC, permalink controls, and pager. The generated A4 check rendered two pages through Poppler at `994 × 1405` per page with readable Korean text, clean page transitions, and no clipping or overlap.
- Focused region comparisons were necessary because the full concept board makes document labels too small to judge. The equal-pixel whitepaper crop verifies surface hierarchy; the full and reader captures verify real canonical content.

## Required fidelity surfaces

- Fonts and typography: local Noto Sans KR and Inter remain the only text families. Navy display headings, small uppercase Latin controls, tabular numbers, 68ch body measure, and readable line heights mirror the selected technical-document hierarchy. A first mobile capture split `토큰` across lines; the final capture keeps Korean title words intact.
- Spacing and layout rhythm: desktop uses a `17rem` sticky index plus a constrained reading column, large section whitespace, quiet dividers, and one continuous white document plane. Mobile removes the sidebar and preserves 16px-plus body type, 44px controls, and single-column flow.
- Colors and visual tokens: all styling consumes the approved semantic Navy, Ivory, Teal, Coral, White, muted text, and border tokens. Teal marks location/verified document cues; Coral marks the document icon and disclosure boundary. No gradient, neon, coin, or trading treatment appears.
- Image quality and asset fidelity: all 11 canonical local images load with nonzero natural width, source dimensions, alt text, and captions. No source image is replaced by a placeholder, CSS drawing, or handcrafted SVG. UI icons come from the existing Lucide Astro dependency.
- Copy and content: the reader consumes the sanitized Task 7 publication directly. `published` is explicitly scoped to the edition; token, NODE, Base, settlement, and institution references do not imply operating features. The controlling Korean edition and off-chain source-data boundary are explicit.
- Interaction, accessibility, and states: all navigation is semantic HTML and works without JavaScript. Focus-visible permalinks map to Task 7's exact IDs; tables are keyboard-scrollable regions; the current chapter uses `aria-current`; article naming, heading hierarchy, download metadata, canonical links, robots metadata, and 404 recovery are exposed.

## Comparison history

1. Initial implementation comparison found one P2 responsive typography defect: at `375` px the chapter title split the Korean word `토큰` between lines.
2. A focused browser regression measured the word's DOM range. It failed RED with two line boxes.
3. Fix: apply Korean `word-break: keep-all` to the chapter H2 without changing source content or desktop scale.
4. The focused test passed GREEN with one line box. All Task 8 captures were then regenerated from the post-fix build; no stale pre-fix screenshot is referenced above.
5. Post-fix combined inputs and focused captures were inspected together. No additional P0, P1, or P2 mismatch, clipping, overflow, missing asset, broken control, or generic-blog drift remains.

## Findings

No actionable P0, P1, or P2 visual findings remain.

## Follow-up polish

- P3: a future English edition can introduce an edition switch only after a canonical translation exists; the current control intentionally presents Korean as the sole master.

Primary interactions tested: desktop and mobile chapter navigation, native disclosure open/close, stable heading anchors and refresh, previous/next routes, PDF fetch/download, keyboard-reachable table regions, direct chapter refresh, unknown-route recovery, and print-media suppression.

Console errors checked: zero in final `375`, `768`, `1024`, and `1440` browser captures.

final result: passed
