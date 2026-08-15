# IROA.AI BI and Whitepaper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an original IROA.AI brand identity and a substantive Korean whitepaper that explains the daily-life Agent, managed Node, agentic kiosk, wearable, companion, robot, privacy, and reward ecosystem.

**Architecture:** Keep Markdown as the editorial source of truth, deterministic SVG as the brand source of truth, and Pexels assets with a human-readable provenance manifest. Create DOCX and PDF as direct document artifacts using the approved BI; do not add a reusable whitepaper generator or production application.

**Tech Stack:** Markdown, SVG, PNG, Pexels API, DOCX/OOXML document tooling, PDF rendering and visual inspection.

## Global Constraints

- Official brand is `IROA.AI`; the Korean pronunciation is `이로아`.
- User promise is `일상을 이롭게.` and primary message is `곁에서 함께, 필요한 일을 끝까지.`
- Do not create or commit a whitepaper-generation system.
- Do not copy, print, or commit `PEXELS_API_KEY` or the SIPASS `.env` file.
- Do not portray older or disabled people through pity, helplessness, surveillance, or medicalized stereotypes.
- Do not claim official partnerships with Samsung, hospitals, public agencies, Pexels, or payment providers.
- Do not issue or promise a stablecoin; initial rewards use KRW and non-transferable points.
- Do not store personal data, health data, conversation transcripts, passwords, or OTPs on a blockchain.
- Consequential actions require explicit user confirmation and must be explainable and cancelable where feasible.
- The PDF and DOCX remain publication-blocked until legal, accessibility-user, medical, privacy, and business reviewers complete their human gates.

---

### Task 1: Pexels photo research and provenance

**Files:**
- Create: `docs/brand/assets/photos/PHOTO-MANIFEST.md`
- Create: `docs/brand/assets/photos/*.jpg`
- Modify: `docs/whitepaper/sources.json`

- [ ] Search Pexels with the approved API key for independent living, wearable assistance, accessible service, community support, companion, and secure-computing scenes.
- [ ] Review every candidate for subject dignity, visible third-party brands, factual fit, crop suitability, and resolution.
- [ ] Download only the selected images at document-appropriate resolution.
- [ ] Record photo ID, photographer, Pexels page URL, API search phrase, local filename, alt text, and intended whitepaper location.
- [ ] Confirm no secret value or `.env` path appears in tracked files.
- [ ] Commit with message `assets: curate IROA whitepaper photography`.

### Task 2: IROA.AI brand identity assets

**Files:**
- Create: `docs/brand/iroa-wordmark.svg`
- Create: `docs/brand/iroa-symbol.svg`
- Create: `docs/brand/iroa-wordmark-reverse.svg`
- Create: `docs/brand/iroa-wordmark.png`
- Create: `docs/brand/iroa-symbol.png`
- Create: `docs/brand/IROA_BI_GUIDE_KO.md`
- Create: `docs/brand/IROA_BI_GUIDE_KO.pdf`

- [ ] Draw a deterministic lowercase `iroa` wordmark and open-ring node symbol using the approved Navy, Coral, Ivory, and Teal palette.
- [ ] Produce light, dark, and monochrome-safe variants without using coins, robot faces, brains, or blockchain hexagons.
- [ ] Export transparent PNGs and verify small-size legibility at 32 px, 64 px, and 160 px.
- [ ] Write the BI guide covering meaning, naming, colors, typography, clear space, minimum sizes, image principles, and prohibited uses.
- [ ] Render and inspect the BI guide PDF at full page size.
- [ ] Commit with message `brand: create IROA visual identity`.

### Task 3: Rewrite the Korean whitepaper around IROA services

**Files:**
- Rename: `docs/whitepaper/MODUA_WHITEPAPER_KO.md` to `docs/whitepaper/IROA_WHITEPAPER_KO.md`
- Modify: `docs/whitepaper/claims.json`
- Modify: `docs/whitepaper/sources.json`
- Modify: `docs/whitepaper/legal-review-checklist.md`
- Modify: `README.md`

- [ ] Replace the old brand with IROA product-family terminology while keeping HEFI and MODUA only in a clearly labeled reference-history note.
- [ ] Rewrite the executive opening around completed daily-life outcomes, not camera document reading or feature lists.
- [ ] Expand realistic user journeys for hospital booking and travel, kiosk ordering and payment, long-running Computer Use, isolated elder companionship, volunteer escalation, and robot expansion.
- [ ] Explain the complete device model: phone and telephone, mobile, watch, managed Node, kiosk Node, Companion, and Robot.
- [ ] Explain privacy-preserving identity, one-time authorization, isolated execution, audit evidence, deletion, and blockchain boundaries.
- [ ] Explain Node-provider and kiosk-owner rewards without promising token value or issuing a stablecoin.
- [ ] Reconcile every external claim with a source entry and preserve explicit claim ceilings for partnerships, health functions, emergency response, and future token plans.
- [ ] Run literal checks for stale brand names, prohibited partnership claims, stablecoin issuance, and sensitive-data-on-chain claims.
- [ ] Commit with message `docs: rewrite whitepaper for IROA AI`.

### Task 4: Create the branded DOCX and PDF

**Files:**
- Create: `docs/whitepaper/exports/IROA_WHITEPAPER_KO.docx`
- Create: `docs/whitepaper/exports/IROA_WHITEPAPER_KO.pdf`
- Create: `docs/brand/IROA_BI_GUIDE_KO.docx`

- [ ] Create an accessible A4 DOCX directly from the approved source, BI tokens, logo, and selected Pexels assets without adding a persistent generator.
- [ ] Apply Korean language metadata, heading hierarchy, meaningful image alt text, repeating table headers, readable body type, page numbers, and running headers.
- [ ] Export the final PDF from the verified DOCX.
- [ ] Run DOCX accessibility and structural audits.
- [ ] Render every DOCX and PDF page to images and inspect at readable scale for clipping, overlap, broken tables, glyph loss, contrast, and image crop errors.
- [ ] Remove the obsolete MODUA DOCX/PDF exports from the new-brand branch after the IROA artifacts pass.
- [ ] Commit with message `docs: publish IROA branded whitepaper`.

### Task 5: Final content, asset, and publication-readiness review

**Files:**
- Create: `docs/whitepaper/IROA_RELEASE_REVIEW.md`
- Modify: `docs/whitepaper/legal-review-checklist.md`

- [ ] Compare Markdown, DOCX, and PDF headings, key figures, disclaimers, reward statements, and roadmap for semantic parity.
- [ ] Verify every embedded photo and logo against the manifest and inspect all final pages again.
- [ ] Verify tracked files contain no API key, `.env` content, temporary render, or production-tool residue.
- [ ] Record automated results separately from the still-required human publication gates.
- [ ] Run `git diff --check`, inspect the final diff, and confirm the worktree is clean after the final commit.
- [ ] Commit with message `docs: record IROA release review`.
