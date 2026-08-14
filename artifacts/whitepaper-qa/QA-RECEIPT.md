# MODUA Whitepaper QA Receipt

Date: 2026-08-14

Final fix wave start baseline: `efe9812e13d23e4b9868ff1ad487e99fe57a1baa`

Overall artifact review: `PASS`

Publication status: `BLOCKED`

This receipt covers automated artifact checks and an AI-assisted visual review of the
Korean review edition. It does not record any external human, expert, partner, or
executive approval. The authoritative Markdown and official PDF bytes were not
changed during this fix wave. The official DOCX was rebuilt solely to harden its
Korean language metadata; its content and publication structure remain in parity.

## Exact source and artifact hashes

All hashes use SHA-256.

| File | Bytes | SHA-256 |
|---|---:|---|
| `docs/whitepaper/MODUA_WHITEPAPER_KO.md` | 50,535 | `cd6d46692e9074fd1e3280420b6d61bcc4d6b1667f774ac6a035c99682658245` |
| `docs/whitepaper/claims.json` | 3,724 | `1d256c5338fb03544b69eb63a65ed0800b2bceb275e79b15011d42c58c1c6150` |
| `docs/whitepaper/sources.json` | 3,001 | `30e293c867807a68d6c444d0098ca4c2d6ec782685e5f7ca1d2fb0e84d9dfa46` |
| `docs/whitepaper/legal-review-checklist.md` | 12,300 | `4f8ca46bb796ec9b41cd83ff2b04ba6bb34c81b1ce5f11ecaec3c9020a2098b6` |
| `docs/whitepaper/exports/MODUA_WHITEPAPER_KO.docx` | 61,151 | `bdf524d5e4266fef53f6a3559003d9c98141e33c0656e45d1193c691937eef13` |
| `docs/whitepaper/exports/MODUA_WHITEPAPER_KO.pdf` | 394,060 | `fa9c3251abc65d5c39d5a1a7fc7963f5d4fcb868f10b3baf47b13e4112f254e4` |
| `artifacts/whitepaper-qa/contact-sheet-01.png` | 1,358,508 | `0c80e8064f61aa19b63294c2ade8e3b62a1c792665051cad4ab9dfc281ff169c` |
| `artifacts/whitepaper-qa/contact-sheet-02.png` | 1,512,760 | `b520920f41dc4e26ad160ceac71be432446458f94125cbadcca02c13e141a62a` |
| `artifacts/whitepaper-qa/contact-sheet-03.png` | 603,600 | `c6804e9d9464e2fca2536be7b07d1edb94c7d24cc2431120a6a9d8c1cd1132ac` |

The previous DOCX was 60,714 bytes with SHA-256
`29be8eef4fece0e1cdc5c2126097ec0f0a5953bacb8e033a158599a7050bd151`.
The official PDF is byte-identical to that baseline. All three regenerated contact
sheets are also byte-identical to the previously inspected artifacts.

## Command receipts

| Check | Exit | Result |
|---|---:|---|
| `python scripts/render_whitepaper.py` | 0 | `rendered-pages: 30` |
| Renderer structure audit | 0 | `PASS`; PDF pages 30, page PNGs 30, contact sheets 3, labels `Page 1` through `Page 30` exactly once |
| Renderer dimensions | 0 | Page PNGs `1191×1684`; contact sheets `1600×1740`; 2× PDF render scale |
| Official render determinism | 0 | `PASS`; official PDF and all three regenerated contact sheets are byte-identical to the previously inspected baseline |
| `python -m pytest tests/test_render_whitepaper.py -v` | 0 | `3 passed`; exact page count/2× dimensions, 12-page cap/labels, stale-output replacement and determinism |
| `python -m pytest tests/test_validate_whitepaper.py -v` | 0 | `35 passed in 0.08s`; deterministic prohibited-claim, disclaimer, and local-approval policy |
| `python -m pytest tests/test_build_whitepaper.py -v` | 0 | `12 passed in 7.89s`; parity, accessibility structure, Korean OOXML metadata, tagged PDF, geometry, and byte reproducibility |
| `python -m pytest -v` | 0 | `50 passed in 11.05s`; zero warnings |
| `python scripts/validate_whitepaper.py` | 0 | `whitepaper-validation: PASS` |
| DOCX accessibility audit | 0 | `high: 0`, `medium: 0`, `low: 0` |
| DOCX Korean-language OOXML audit | 0 | `PASS`; defaults/theme/styles and all 458 text-bearing runs use `ko-KR` for default and East Asian language; no `en-US` or `ja-JP` language defaults remain |
| Deterministic A/B rebuild | 0 | `PASS`; both independent rebuilds and official DOCX/PDF match byte-for-byte |
| Markdown/DOCX/PDF parity audit | 0 | `PASS`; all checks listed below matched the current official files |

The Python commands used the task-local Python 3.12 runtime. WeasyPrint-related test
commands used `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib`.

## Three-representation parity

The authoritative Markdown, current official DOCX, and current official PDF matched
on all required release-review fields:

- The same 19 numbered chapter headings, in the same order.
- The same 210 non-heading body blocks and 116 list items, in the same order.
- The same five tables, table cells, header rows, and independent ordered-list
  restart semantics.
- The same `100억 개` maximum-supply wording.
- The same allocation rows and percentages: `40%`, `10%`, `15%`, `15%`, `8%`,
  `7%`, `5%`, and total `100%`.
- The same six roadmap ranges: `0–2개월`, `3–5개월`, `6–9개월`, `10–15개월`,
  `16–21개월`, and `22–24개월`.
- The same conditional stablecoin disclaimer: “외부 스테이블코인 결제는 신고
  사업자 계약·법률검토·보안시험 후에만 실증한다. 이 실증의 각 결제도 사용자
  최종 승인을 전제로 한다.”

Automated source and claim validation: `PASS`. This is an automated result, not the
human source-and-claim review gate below.

## Visual review

Visual gate: `PASS`.

DOCX coverage at the current official DOCX hash:

- The corrected DOCX was rendered with LibreOffice under one fixed fontconfig that
  exposed the installed Korean fonts for both baseline and current comparisons.
- The baseline rendered as 26 A4 pages; the corrected DOCX rendered as 27 A4 pages.
  This is an expected accessibility correction, not an unreviewed layout drift:
  `ko-KR` East Asian run metadata makes LibreOffice apply the document's existing
  `Noto Sans KR` East Asian font assignment to Korean text. The baseline mixed
  Google Sans/Pretendard fallbacks for some Korean runs; the corrected render uses
  Noto Sans KR for those runs and therefore recalculates line wrapping.
- All 27 corrected DOCX pages were inspected at full rendered resolution. No
  clipping, overlap, missing Korean glyphs, broken or unreadable tables, missing
  running headers, or page-number problems were found. Page 27 contains the final
  two HEFI references with intentional remaining whitespace.
- Page size, margins, styles, headings, numbering, table structure, and manuscript
  content remain unchanged and passed the automated A4/structure/parity gates.

PDF coverage at the current official PDF hash:

- Contact sheets inspected: pages 1–12, 13–24, and 25–30; every PDF page is covered.
- Full-size pages inspected: 1, 12, 13, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28,
  29, and 30.
- Table pages inspected: 12, 13, 18, 20, 21, 22, 23, 26, 27, and 28.
- Token-allocation page inspected: 18.
- Roadmap pages inspected: 23–25.
- Risk pages inspected: 26–28.
- Final-reference pages inspected: 28–30.

Every page, all three contact sheets, and every designated full-size page were
inspected. No clipping, overlap, missing Korean glyphs, broken or unreadable tables,
missing running headers, or page-number problems were found.

The PDF has 30 pages and is byte-identical to the previously inspected artifact;
the contact sheets are also byte-identical. The three regenerated contact sheets
were inspected again, along with full-size sanity checks of pages 1, 12, 18, 23,
26, and 30.

The top area of pages 18, 21, 23, 25, 27, and 29 was also measured directly at the
current official PDF hash:

- Each rendered page's `y=0–100 px` strip has the same SHA-256,
  `97c15aeb2422dd73f6e77af28c9fc6dc912cf92cd01676d756d013202ea4716c`, and every
  pairwise pixel-difference bounding box is `None`.
- The running-header text bounding box is `(207.1, 23.2)–(388.2, 33.4)` points.
- First content begins at `y=65.6 pt` on pages 18, 21, 23, and 27, and at
  `y=59.5 pt` on pages 25 and 29. This leaves at least about `26 pt` between the
  header bottom and the first content, so no top-margin or running-header collision
  is present.

## Required human review gates

These outcomes are deliberately separate from the automated checks.

| Required gate | Status | Evidence / next requirement |
|---|---|---|
| Source and claim review | `NOT_RUN` | Independent human source/claim reviewer required |
| Korean copyediting | `NOT_RUN` | Korean copyeditor review required |
| Accessibility review by older and disabled reviewers | `NOT_RUN` | Representative older and disabled reviewers required |
| Privacy and research-consent review | `NOT_RUN` | Privacy/research-consent expert review required |
| Hospital/medical boundary review | `NOT_RUN` | Medical, hospital-integration, and clinical-boundary review required |
| Financial/stablecoin boundary review | `NOT_RUN` | Independent finance/virtual-asset legal and operations review required |
| Token/legal review | `NOT_RUN` | Token, securities, tax, accounting, and consumer-protection review required |
| Executive publication approval | `NOT_RUN` | Executive approval may occur only after every prior required gate is `PASS` |

No `NOT_RUN` gate is approval. Publication remains blocked solely until every
required human gate records `PASS` with evidence.

This receipt proves artifact checks only; it is not publication, legal, medical, financial, Samsung, hospital, or partner approval.
