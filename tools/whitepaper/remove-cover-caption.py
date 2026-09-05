#!/usr/bin/env python3
"""Drop the cover caption left behind when the cover illustration was replaced.

The exported PDF is a headless-Chrome print, so every glyph is a Type 3 drawing
procedure rather than a character in an embedded font. Rewriting the caption to
describe the illustration now on the cover is therefore impossible — the glyphs
for the replacement wording are simply not in the file. Removing the line is,
and the caption is redundant: the alt text in the markdown and the DOCX already
describes the illustration correctly for readers who need it.

The caption's text object is identified by its font size and position, then the
removal is verified against the extracted text: the caption must be gone and
the other four cover lines must survive untouched. A tool that guessed the
wrong block would fail here rather than ship a damaged cover.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from pypdf import PdfReader, PdfWriter

STALE_CAPTION = "밝은 실내에서 차를 마시며 편안하게 이야기하는 두 명의 고령자"

# The four lines the cover must still carry after the caption is dropped.
COVER_LINES = (
    "IROA.AI 백서",
    "일상을 이롭게. 필요한 일을 끝까지.",
    "노인과 장애인의 일상을 끝까지 돕는 AI 지원망",
    "최종본 · v1.0 · 2026-08-21 · 대한민국 우선",
)

TEXT_OBJECT = re.compile(rb"BT.*?ET", re.S)
FONT_SIZE = re.compile(rb"/F\d+\s+([\d.]+)\s+Tf")


def caption_block_index(content: bytes) -> int:
    """Index of the smallest-type text object, which is the caption."""
    sizes: list[tuple[float, int]] = []
    for index, match in enumerate(TEXT_OBJECT.finditer(content)):
        found = FONT_SIZE.search(match.group(0))
        if found:
            sizes.append((float(found.group(1)), index))
    if not sizes:
        raise RuntimeError("no sized text objects on the cover page")
    return min(sizes)[1]


def remove_caption(source: Path, destination: Path) -> None:
    reader = PdfReader(source)
    before = reader.pages[0].extract_text()
    if STALE_CAPTION not in before:
        raise RuntimeError("the cover carries no stale caption; nothing to remove")

    writer = PdfWriter(clone_from=reader)
    # The cover carries a single Flate-compressed content stream; editing that
    # object in place keeps the page's resources and structure untouched.
    stream = writer.pages[0]["/Contents"].get_object()
    content = stream.get_data()
    target = caption_block_index(content)

    kept: list[bytes] = []
    cursor = 0
    for index, match in enumerate(TEXT_OBJECT.finditer(content)):
        if index != target:
            continue
        kept.append(content[cursor:match.start()])
        cursor = match.end()
    kept.append(content[cursor:])
    stream.set_data(b"".join(kept))

    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as handle:
        writer.write(handle)

    after = PdfReader(destination).pages[0].extract_text()
    if STALE_CAPTION in after:
        raise RuntimeError("the caption survived the edit")
    for line in COVER_LINES:
        if line not in after:
            raise RuntimeError(f"the edit removed cover text it should have kept: {line}")
    print(f"Removed the cover caption from {destination}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_pdf", type=Path)
    parser.add_argument("output_pdf", type=Path)
    arguments = parser.parse_args()
    remove_caption(arguments.input_pdf, arguments.output_pdf)


if __name__ == "__main__":
    main()
