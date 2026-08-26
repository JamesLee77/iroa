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
