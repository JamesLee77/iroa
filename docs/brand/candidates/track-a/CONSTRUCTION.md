# IROA Track A construction

Track A redraws the recognizable lowercase `iroa.ai`, open loop, and navy/coral/teal palette as one coordinated vector system. These are candidate masters, not promoted official assets.

## Coordinate system and baseline

- Symbol master: `160 x 160` units on a 10-unit base grid with 2-unit optical subdivisions.
- Wordmark masters: `600 x 180` units. Main-letter visual baseline is `y = 143`; `.ai` aligns within `0.5` unit at `y = 142.5`.
- Main-letter stroke: `22` units with round caps and joins. The small `.ai` stroke is `14` units (`63.64%` of the main stroke).
- The main `a` bowl has a 36-unit path radius and a 25-unit inner counter. The `.ai` `a` has a 25.5-unit path radius and an 18.5-unit inner counter.
- The `i` dot diameter is `21` units, exactly `95.45%` of the main stroke. The `.ai` `i` dot and period are both 15-unit diameter lettering marks; neither is an action point.

## Shared open-loop geometry

- Symbol loop center: `(80, 80)`. Path radius: `48` units. Stroke: `24` units.
- The opening is centered on the right axis. Terminal centerlines sit at `-32 degrees` and `+32 degrees`, producing a `64-degree` opening and a `296-degree` drawn arc.
- The upper terminal carries the only coral action point. Its radius is `12.5` units, `104.17%` of the 12-unit round terminal radius, so coral fully replaces the navy cap without a dark fringe.
- The wordmark `o` reuses the exact symbol path and terminal coordinates under `translate(166 29.5) scale(.8)`. Its effective center is `(230, 93.5)`, path radius `38.4`, stroke `22`, and action-point radius `11.458` units. The larger pre-scale stroke is the optical correction that keeps the smaller loop equal in weight to the main letters.
- The lower terminal remains the base stroke color. No second teal endpoint or coral punctuation is used.

## Spacing and clear space

- Built-in symbol margin is 20 units at the loop extrema. External clear space is at least one symbol stroke (`24` units, or `0.15 x` the symbol viewBox).
- Wordmark external clear space is at least one main stroke (`22` units) on all sides. The viewBox includes 37.5 units to the left, 31 units above the `i` dot, 40.5 units to the right, and 37 units below the baseline terminals.
- Key horizontal optical gaps are 12.6 units between the `r` terminal and `o`, 30 units between the visible `o` action point and `a`, 32.5 units between the main `a` and period, and 8 units between the period and `.ai` bowl.

## Small-size optical behavior

The master contains the small-size compensation: a 4.17% oversized action point, a 64-degree opening, a 20-unit internal symbol margin, and round terminals. Candidate PNGs use Lanczos downsampling without per-export shape changes.

| Symbol output | Scale | Effective stroke | Action-point diameter | Clear opening between terminal silhouettes | Built-in edge margin |
|---:|---:|---:|---:|---:|---:|
| 16 px | 0.10 | 2.40 px | 2.50 px | 2.64 px | 2.00 px |
| 24 px | 0.15 | 3.60 px | 3.75 px | 3.96 px | 3.00 px |
| 32 px | 0.20 | 4.80 px | 5.00 px | 5.27 px | 4.00 px |
| 64 px | 0.40 | 9.60 px | 10.00 px | 10.55 px | 8.00 px |

At 16 px the open gap remains larger than the combined stroke width and survives antialiasing. At 24 px the upper coral terminal and lower navy terminal remain directionally distinct. At 32 px and above the 24:22:14 stroke hierarchy resolves without counter closure.

## Color variants

- Default: IROA Navy `#16263D`, IROA Coral `#F06D5E`, IROA Teal `#3D8B83`.
- Reverse: White `#FFFFFF`, IROA Coral `#F06D5E`, IROA Light Teal `#83CDC4` on IROA Navy `#16263D`.
- Monochrome: Ink `#19222E` for every element; geometry and spacing are unchanged.

All lettering is deterministic vector geometry. No `<text>`, embedded font, linked image, raster trace, filter, mask, or generated lettering is present.
