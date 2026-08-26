# Track B — Relay Step

Track B is a zero-base identity family built from IROA.AI's role in carrying a real-life request through user-controlled decisions to a verified result and human handoff. It does not inherit the legacy or Track A symbol, wordmark skeleton, palette, open-ring motif, or action-dot construction.

## Shared construction feature

The ownable feature is the **relay step**: a counter or crossbar runs horizontally, drops by `5` units, then releases into the next diagonal or vertical mass. It is visible in the symbol's enclosed `r`, the wordmark's `r` counter, the stressed `o` counter, and both structural `a` counters. The step remains geometry in color, mono, and reverse; it is never dependent on an accent color or explanation.

The symbol is an `ir` ligature, not a service pictogram. Its fused flag head comes directly from the wordmark's `i`; its enclosed counter, relay step, and diagonal release come directly from the wordmark's `r`. This keeps symbol and lettering in one construction language while avoiding an eye, heart, shield, robot, medical cross, link, infinity sign, coin, or generic AI spark.

## Master grids and lettering

- Symbol grid: `96 × 96`, filled silhouette, one enclosed stepped counter, no detached elements.
- Wordmark grid: `436 × 96`, optical cap zone `y=6–78`, baseline `y=76`.
- The exact name `iroa.ai` is rendered as custom unicase geometry. The `i` uses a fused flag head rather than a detached tittle; `r` uses an enclosed counter and diagonal leg; `o` is vertically stressed with an offset counter floor; `a` uses a structural two-level counter rather than a single-storey round bowl.
- The domain suffix uses the same color, weight, rhythm, and counter grammar as the name. The period is a square punctuation stop, not a brand action dot.
- Optical ink gaps at the master grid are `12–14` units. They quantize to distinct `2–3 px` gaps at `16 px` and remain within a `2:1` range at every review size.

## Color

- Default: deep mulberry `#4A3652` on white (`10.82:1`).
- Monochrome: near-black `#111111`.
- Reverse: white `#FFFFFF` on dark fields; use a background of `#4A3652` or darker for review and production.

Color is applied only after the silhouette passes mono review. Track B does not use the legacy navy, coral, or teal values and does not split `.ai` into a decorative color suffix.

## Clear space and small sizes

Use `U = 10/96` of the symbol width as minimum clear space on all sides. For the wordmark, use `U = 10/96` of rendered height around the entire lockup.

- `64 px`: use the master unchanged.
- `32 px`: the relay steps, `r/o/a` counters, and punctuation must remain distinct.
- `24 px`: retain the fused `i` heads and all seven optical word/punctuation groups.
- `16 px`: prefer the symbol for icon use; the wordmark remains approved only at its native proportional width (`73 × 16 px`) or wider.
- Never remove the relay step, detach the `i` head, round the unicase forms into a monoline lowercase, recolor `.ai` separately, or close the symbol into a ring.

## Deterministic file roles

- `symbol.svg`: default-color symbol.
- `symbol-mono.svg`: near-black symbol.
- `symbol-reverse.svg`: white symbol for dark fields.
- `wordmark.svg`: default-color exact `iroa.ai` wordmark.
- `wordmark-mono.svg`: near-black wordmark.
- `wordmark-reverse.svg`: white wordmark for dark fields.

All six masters contain only SVG/group/path geometry plus accessible title/description metadata. They contain no `<text>`, embedded font, raster, image, `foreignObject`, or filter content.
