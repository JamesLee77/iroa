# Task 5 - Track A official promotion report

## Result

`docs/brand/candidates/SELECTION.md` declares `winner: track-a`; the promotion CLI rejects a disagreement and is additionally restricted to Track A for BI v1.  The selected Track A color masters are copied byte-for-byte into the official symbol and wordmark masters.  All compatibility SVGs are byte-identical to their corresponding official master.

## RED/GREEN evidence

1. RED - `python3 -m unittest tests.brand.test_brand_assets.BrandContractTest.test_legacy_paths_match_official_masters -v` failed with `FileNotFoundError` for `docs/brand/masters/symbol/iroa-symbol-color.svg`.  This proved the required promotion/legacy parity did not yet exist.
2. RED - `python3 -m unittest tests.brand.test_brand_assets.BrandContractTest.test_svg_rejects_text_elements -v` failed because `audit_svg()` accepted an SVG containing `<text>`.
3. GREEN - updated `audit_svg()` to reject text elements; the same focused test passed.
4. RED - `python3 -m unittest tests.brand.test_brand_assets.BrandContractTest.test_official_audit_cli_checks_the_promoted_asset_set -v` failed because the official audit CLI emitted no result.
5. GREEN - added the deterministic promotion command, official audit command, selected-master/legacy parity checks, exact PNG/RGBA/safe-area checks, deterministic rebuild proof, and six-PDF structure/render checks.  The focused audit CLI test passed, followed by the full brand suite.

## Implementation and manifest

- `tools/brand/promote_candidate.py`
  - Parses the winner from `SELECTION.md`, rejects winner-selection mismatches, and restricts the v1 promotion to `track-a`.
  - Creates color, mono, and reverse vector SVG masters for `symbol`, `wordmark`, and horizontal `lockup`.
  - Builds lockups from the selected source geometry with the documented 24-unit symbol-stroke clear space; no alternative mark is introduced.
  - Generates 22 transparent digital PNGs (symbol and wordmark at every `OFFICIAL_PNG_SIZES` value), 11 icon outputs plus favicon SVG, regenerates root PNG compatibility files, and writes deterministic vector print PDFs.
- `docs/brand/masters/`
  - 9 SVG masters: 3 each for `symbol`, `wordmark`, and `lockup` (`color`, `mono`, `reverse`).
- `docs/brand/exports/digital/`
  - 22 RGBA PNGs: `iroa-symbol-{16,24,32,48,64,128,180,192,256,512,1024}.png` and matching `iroa-wordmark-*` files.
- `docs/brand/exports/icons/`
  - `favicon.svg`, favicon 16/32/48, Apple touch 180, app 192/512, maskable 192/512, watch 48, and kiosk 1024.
- `docs/brand/exports/print/`
  - Exactly six A4 PDFs: color and mono for symbol, wordmark, and lockup.
- `docs/brand/iroa-symbol.svg`, `iroa-wordmark.svg`, `iroa-wordmark-mono.svg`, and `iroa-wordmark-reverse.svg`
  - Exact-byte compatibility copies of their official counterparts.
- `docs/brand/iroa-symbol.png` and `iroa-wordmark.png`
  - Regenerated directly from the official masters at 512x512 and 1200x360 respectively.

## PDF creation and QA

Immediately before the first promotion/export authoring command, the required operation marker was run exactly once:

```text
node .../pdf/container_tools/mark_artifact_operation_started.mjs --operation-kind create --expected-output-count 6 --output-format pdf
```

The PDF writer emits only SVG-derived path/circle geometry in a deterministic compressed content stream.  It creates no text operators, font resources, Type 3 glyphs, or image XObjects.  Native inspection found every file to be one unencrypted standard A4 page; `pdffonts` listed no fonts, and `pdftocairo` returned exit 0 with empty stderr for every page.  The six Poppler page renders were visually reviewed in a single 150dpi contact sheet: all six marks were fully visible, unclipped, centered with consistent white space, and showed no rendering artifacts.

## Commands and results

```text
python3 -m unittest discover -s tests/brand -p 'test_*.py' -v
# 33 tests, OK

python3 tools/brand/audit_assets.py official
# official asset audit passed

python3 tools/brand/promote_candidate.py --winner track-a
# exit 0

# hash every official master/export, promote again, compare hashes
# deterministic=0 files=48

pdfinfo docs/brand/exports/print/*.pdf
# six files, one A4 page each, Encrypted: no

pdffonts docs/brand/exports/print/*.pdf
# no font rows for all six PDFs

pdftocairo -png -singlefile ...
# all six: exit 0, stderr empty

sips -g pixelWidth -g pixelHeight ...
# root symbol 512x512; root wordmark 1200x360; maskables 192x192 and 512x512

git diff --check
# exit 0
```

## Concerns

None for the scoped Task 5 promotion.  Legal trademark clearance and later deployment/consumer integration remain outside this source-and-export validation scope.

## Review fix round 1

All five Important findings and the three output-affecting Minor findings were corrected in the same managed promotion path.

### RED/GREEN evidence

1. RED - direct-target render proof failed because the old renderer rasterized the intrinsic SVG first and then enlarged it with Pillow/Lanczos.  GREEN - `render_svg_png()` now invokes the SVG renderer once with the requested `-z height width` target; the 1024px result is pixel-identical to an independent direct target render.
2. RED - an added `track-b-leak.png` in a temporary copied official tree was accepted by the audit.  GREEN - exact recursive inventories now cover masters, digital exports, icons, and print; the temp leak is rejected, while promotion removes stale files only inside those four managed directories.
3. RED - official masters included `circle` and `rect` primitives.  GREEN - every official/favicons graphic primitive is now an SVG path; 1024px Track A source-vs-official color renders are pixel-identical, and strict path-only SVG auditing passes.
4. RED - blank and image-backed PDFs were accepted by the earlier audit.  GREEN - a blank page, a `BT ET` text page, and a temporary DCT/JPEG XObject PDF are each rejected; official PDFs must be one-page A4, fontless, image-XObject-free, text-operator-free, vector-path-bearing, nonblank, and Poppler-clean.
5. RED - the prior lockup foreground was 13px off the A4 horizontal center at 150dpi.  GREEN - SVG-derived ink bounds center every PDF foreground within the 3px test tolerance on both axes.

### Regeneration and visual QA

The PDF edit operation marker was invoked once immediately before the corrected six-PDF regeneration command:

```text
node .../pdf/container_tools/mark_artifact_operation_started.mjs --operation-kind edit --expected-output-count 6 --output-format pdf
```

All official/root PNGs and icons were regenerated from direct target SVG rendering. Native 512px and 1024px symbol inspection found crisp continuous round edges, correct transparent margins, and no upscaled softness. The six corrected A4 PDF pages were rendered with Poppler at 150dpi and reviewed as one contact sheet: color/mono symbol, wordmark, and lockup are each centered, unclipped, and free of visual artifacts.

### Minor corrections

- Track A symbol, official color/reverse/mono symbol masters, and favicon now describe the action point as centered in the opening; monochrome text does not claim a color.
- `SELECTION.md` now states that Track A promotion is complete and excludes Track B from official use.
- Lockup serialization strips trailing whitespace; the final range check is run against `77b6c64..HEAD` after the fix-round commit.

### Fix-round verification commands

```text
python3 -m unittest discover -s tests/brand -p 'test_*.py' -v
# 38 tests, OK

python3 tools/brand/audit_assets.py official
# official asset audit passed

# SHA-256 manifest -> promote -> SHA-256 manifest -> cmp
# deterministic=0 files=49

# every official PDF content stream
# BT=False ET=False Do=False paths=True

pdfinfo + pdffonts + pdftocairo (all six)
# one unencrypted A4 page, no font rows, exit 0 and empty renderer stderr

git diff --check
# exit 0
```
