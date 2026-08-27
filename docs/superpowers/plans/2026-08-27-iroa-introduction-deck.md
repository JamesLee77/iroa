# IROA.AI Introduction Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, editable 14-slide Korean IROA.AI introduction PPTX using the approved Track A identity, whitepaper claims, and Pexels photography.

**Architecture:** Keep the production builder and downloaded source assets in a writable temporary build directory, while committing only the approved final deck and durable source manifest under `docs/presentations/`. Author the deck with `@oai/artifact-tool`, render every slide, and gate delivery on visual inspection, overflow checks, source-note coverage, and final PPTX export.

**Tech Stack:** `@oai/artifact-tool` JavaScript ES modules, bundled presentation runtime, Pexels REST API, official IROA SVG/PNG masters, Noto Sans KR, bundled presentation rendering and QA helpers.

**Spec:** `docs/superpowers/specs/2026-08-27-iroa-introduction-deck-design.md`

## Global Constraints

- Output is one editable 1280×720 Korean PPTX at `docs/presentations/IROA_INTRODUCTION_KO.pptx`.
- Use only approved Track A masters and palette values from `docs/brand/IROA_BI_GUIDE_KO.md`.
- Use Pexels API photography without exposing `PEXELS_API_KEY`.
- Use the bundled dependency loader; do not substitute system/global runtimes.
- Every slide must contain a `[Sources]` block in speaker notes.
- Do not invent metrics, partnerships, users, products, deployments, or outcomes.
- Minimum type sizes are 50pt title-slide title, 35pt slide titles, 24pt subheads, and 16pt body.
- Render and visually inspect all 14 slides before delivery.

---

### Task 1: Source Map and Pexels Asset Intake

**Files:**
- Create: `docs/presentations/IROA_INTRODUCTION_KO_SOURCES.md`
- Read: `docs/whitepaper/IROA_WHITEPAPER_KO.md`
- Read: `docs/brand/assets/photos/PHOTO-MANIFEST.md`

**Interfaces:**
- Consumes: whitepaper sections 1–5, 8–12, 15–18 and approved Pexels photo IDs.
- Produces: a 14-slide source map with exact Pexels IDs, photographer URLs, whitepaper section anchors, and local image paths.

- [ ] **Step 1: Validate secret availability without printing it**

Run a shell check that sources `/Users/hyunsuklee/Developer/dta/sipass/.env`, asserts `PEXELS_API_KEY` is non-empty, and prints only `PEXELS_API_KEY available`.

- [ ] **Step 2: Fetch Pexels metadata for the selected IDs**

Call `GET https://api.pexels.com/v1/photos/{id}` for IDs `6248760`, `6646818`, `8899538`, `1181335`, `8295026`, `4064023`, `8376171`, and `6647066`; save JSON only in the temporary build directory.

- [ ] **Step 3: Download the selected landscape sources**

Download the `large2x` or best landscape source returned by the API into the temporary asset directory. Reject any image below 1600×900 and preserve the API photo-page and photographer URLs.

- [ ] **Step 4: Write the durable source map**

Record one row per slide with the local embedded asset name, Pexels photo URL, photographer name/profile URL, Korean alt text, whitepaper section, and disclaimer.

- [ ] **Step 5: Verify source completeness**

Run a check that all photo files exist, all eight Pexels IDs appear in the source map, and every slide number 1–14 has at least one whitepaper or Pexels source entry.

### Task 2: Artifact-Tool Deck Builder

**Files:**
- Create: temporary `build_iroa_intro.mjs`
- Create: `docs/presentations/IROA_INTRODUCTION_KO.pptx`
- Read: `docs/brand/masters/wordmark/iroa-wordmark-reverse.svg`
- Read: `docs/brand/masters/wordmark/iroa-wordmark-color.svg`
- Read: `docs/brand/masters/symbol/iroa-symbol-color.svg`

**Interfaces:**
- Consumes: Task 1 source map and downloaded photos.
- Produces: editable 14-slide `Presentation` object and exported PPTX.

- [ ] **Step 1: Load the bundled presentation runtime**

Call `load_workspace_dependencies` and set command-scoped `RUNTIME_NODE`, `RUNTIME_NODE_MODULES`, and `RUNTIME_BIN_DIR` to the exact returned paths. Create a `node_modules` symlink in the temporary directory pointing to `RUNTIME_NODE_MODULES`.

- [ ] **Step 2: Mark artifact creation once**

From the presentations skill directory run `node container_tools/mark_artifact_operation_started.mjs --operation-kind create --expected-output-count 1 --output-format pptx` as a standalone command.

- [ ] **Step 3: Build the shared visual system**

In `build_iroa_intro.mjs`, define the exact official palette, 1280×720 slide size, Noto Sans KR typography, equal 72px horizontal margins, page numbering, photo overlay treatment, and reusable title/body/source-note helpers.

- [ ] **Step 4: Implement slides 1–5**

Create the minimal cover, problem, cross-channel request, hospital-and-mobility scenario, and kiosk scenario using the exact copy and narrative jobs in the design spec. Use one main photograph per photo slide.

- [ ] **Step 5: Implement slides 6–10**

Create the service system, request lifecycle, secure execution space, human handoff, and minimum-data slides. Use native PowerPoint shapes only for the two simple explanatory diagrams; create connectors before nodes.

- [ ] **Step 6: Implement slides 11–14**

Create stakeholder value, business model, roadmap, and partnership close. Keep token language secondary and state that everyday service payment uses regulated existing payment methods.

- [ ] **Step 7: Add speaker-note sources**

Add a `[Sources]` block to all 14 slides listing the applicable whitepaper path/section and Pexels photo-page URL. Note that photographs are illustrative and do not establish real users, facilities, products, or partnerships.

- [ ] **Step 8: Export the PPTX and previews**

Export `docs/presentations/IROA_INTRODUCTION_KO.pptx`; export all slide PNGs, layout JSON, and a montage into the temporary QA directory.

### Task 3: Render, Inspect, and Repair

**Files:**
- Modify: temporary `build_iroa_intro.mjs`
- Replace: `docs/presentations/IROA_INTRODUCTION_KO.pptx`

**Interfaces:**
- Consumes: Task 2 PPTX and rendered slide PNGs.
- Produces: visually approved final PPTX with no unresolved layout defects.

- [ ] **Step 1: Run automated overflow testing**

Run `container_tools/slides_test.py docs/presentations/IROA_INTRODUCTION_KO.pptx`. Any overflow or canvas escape is a blocking failure.

- [ ] **Step 2: Inspect the deck montage**

View the montage for narrative rhythm, palette consistency, repeated silhouettes, and abrupt density shifts.

- [ ] **Step 3: Inspect all 14 slides individually**

View each full-size rendered slide. Record and fix title wrapping, body clipping, weak photo crops, low-resolution images, accidental overlap, connector crossings, inconsistent page numbers, and unreadable contrast.

- [ ] **Step 4: Regenerate and repeat QA**

Re-run the builder, overflow test, montage, and all-slide visual inspection until no blocking or visible defects remain.

- [ ] **Step 5: Verify source-note coverage**

Inspect the exported deck and assert 14 slides, 14 `[Sources]` blocks, eight Pexels IDs, and no unresolved placeholder text such as `TODO`, `TBD`, or `Lorem`.

### Task 4: Final Verification and Commit

**Files:**
- Create: `docs/presentations/IROA_INTRODUCTION_KO_VERIFICATION.md`
- Commit: final PPTX, durable sources, and verification receipt.

**Interfaces:**
- Consumes: Task 3 final deck and QA evidence.
- Produces: reviewable committed presentation package.

- [ ] **Step 1: Re-render the committed PPTX**

Render all 14 slides from the final file into a fresh temporary directory and compare them to the approved QA renders.

- [ ] **Step 2: Write the verification receipt**

Record the PPTX SHA-256, slide count, canvas size, overflow-test result, source-note count, unresolved-placeholder count, Pexels IDs, official logo files, and the local-vs-live limitations.

- [ ] **Step 3: Run final checks**

Run the presentation overflow test, source-note verifier, `git diff --check`, and `git status --short`; verify the main checkout's two pre-existing untracked agreement DOCX files remain untouched.

- [ ] **Step 4: Commit atomically**

Commit only the presentation design/spec, plan, durable source manifest, final PPTX, and verification receipt with message `docs: add IROA introduction presentation`.
