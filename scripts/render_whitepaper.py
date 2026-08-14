from __future__ import annotations

import math
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw, PngImagePlugin


PAGES_PER_SHEET = 12
PAGE_SCALE = 2
THUMBNAIL_SIZE = (380, 540)
TILE_SIZE = (400, 580)
SHEET_SIZE = (1600, 1740)


def _remove_previous_outputs(output_dir: Path, pages_dir: Path) -> None:
    for path in pages_dir.glob("page-*.png"):
        path.unlink()
    for path in output_dir.glob("contact-sheet-*.png"):
        path.unlink()


def _make_contact_sheet(
    page_paths: list[Path], *, first_page_number: int, output_path: Path
) -> None:
    sheet = Image.new("RGB", SHEET_SIZE, "#d9dee7")
    labels: list[str] = []

    for position, path in enumerate(page_paths):
        page_number = first_page_number + position
        label = f"Page {page_number}"
        labels.append(label)
        with Image.open(path) as source:
            thumbnail = source.convert("RGB")
        thumbnail.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
        tile = Image.new("RGB", TILE_SIZE, "white")
        tile.paste(thumbnail, ((TILE_SIZE[0] - thumbnail.width) // 2, 25))
        ImageDraw.Draw(tile).text((12, 552), label, fill="black")
        sheet.paste(
            tile,
            ((position % 4) * TILE_SIZE[0], (position // 4) * TILE_SIZE[1]),
        )

    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("modua_page_labels", ",".join(labels))
    sheet.save(output_path, pnginfo=metadata)


def render(pdf_path: Path, output_dir: Path) -> list[Path]:
    pdf_path = Path(pdf_path)
    output_dir = Path(output_dir)
    pages_dir = output_dir / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)
    _remove_previous_outputs(output_dir, pages_dir)

    page_paths: list[Path] = []
    with pymupdf.open(pdf_path) as document:
        for index, page in enumerate(document):
            pixmap = page.get_pixmap(
                matrix=pymupdf.Matrix(PAGE_SCALE, PAGE_SCALE), alpha=False
            )
            path = pages_dir / f"page-{index + 1:03d}.png"
            pixmap.save(path)
            page_paths.append(path)

    for sheet_index in range(math.ceil(len(page_paths) / PAGES_PER_SHEET)):
        start = sheet_index * PAGES_PER_SHEET
        batch = page_paths[start : start + PAGES_PER_SHEET]
        _make_contact_sheet(
            batch,
            first_page_number=start + 1,
            output_path=output_dir / f"contact-sheet-{sheet_index + 1:02d}.png",
        )

    return page_paths


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    rendered = render(
        root / "docs/whitepaper/exports/MODUA_WHITEPAPER_KO.pdf",
        root / "artifacts/whitepaper-qa",
    )
    print(f"rendered-pages: {len(rendered)}")
