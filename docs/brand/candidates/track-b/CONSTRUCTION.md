# Track B — Switchline

Track B is a zero-base identity family built from the service role: IROA.AI keeps a real-life request moving while the user can pause, choose, and hand the work to a person. It does not inherit the existing symbol, wordmark geometry, or palette.

## Construction language

- The symbol uses a `96 × 96` grid and one asymmetric switchback route. It enters at the lower left, turns through a protected counter, then exits horizontally as a handoff segment.
- The master stroke is `12` units in the symbol and `11` units in the wordmark. Outer turns use smooth `9–11` unit transitions; exposed terminals are cut flat so every route has a visible beginning and end.
- The lowercase wordmark uses an `96`-unit em, a `44`-unit x-height (`y=30` to `y=74`), and a shared baseline at `y=74`. Every letter is custom vector geometry rather than converted or live font text.
- The `r`, `o`, and single-storey `a` reuse the symbol's straight-to-radius-to-straight sequence. The closed `o` counter is deliberately not an open ring, and the `a` carries the horizontal exit behavior of the symbol.
- The two `i` tittles and the period are rounded control tiles, required for exact reading of `iroa.ai`. They are not detached from the name as a freestanding action-dot motif and never appear inside the symbol.
- Default color divides the route only once: core name/route in deep mulberry `#4A3652`, handoff domain/segment in grounded amber `#9A531F`. Both pass 4.5:1 against white (`10.82:1` and `5.78:1`). Reverse is white; mono is `#111111`.

## Clear space

Use one master stroke (`S`) as the minimum clear space on all sides. For the symbol, `S = 12/96` of its rendered width. For the wordmark, `S = 11/96` of its rendered height. No container edge, copy, photograph focal point, or interface control may enter this area.

## Small-size rules

- Use the master SVG unchanged at `32 px` and above.
- At `24 px`, preserve the two flat endpoints and the symbol's central counter; do not add outline, shadow, or interior fill.
- At `16 px`, use only the symbol or the supplied wordmark master. Do not tighten tracking, round the cut terminals, or recolor individual tittles.
- Never redraw the amber handoff as a circle or separate dot. Never close the switchback into a ring, infinity sign, chain link, shield, heart, or eye.

## File roles

- `symbol.svg`: two-color standalone switchline symbol.
- `wordmark.svg`: deterministic two-color `iroa.ai` wordmark.
- `wordmark-reverse.svg`: white wordmark for dark fields.
- `wordmark-mono.svg`: one-color wordmark for constrained production.

All masters are pure SVG vectors with accessible title/description metadata, no `<text>` nodes, embedded fonts, or raster content.
