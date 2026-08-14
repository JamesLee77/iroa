from __future__ import annotations

import hashlib
from pathlib import Path

import pymupdf
from PIL import Image

from scripts.render_whitepaper import render


def _make_pdf(path: Path, *, pages: int) -> None:
    document = pymupdf.open()
    for page_number in range(1, pages + 1):
        page = document.new_page(width=200, height=300)
        page.insert_text((20, 40), f"Fixture page {page_number}")
    document.save(path)
    document.close()


def _hashes(paths: list[Path]) -> dict[str, str]:
    return {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(paths)
    }


def test_render_outputs_one_2x_png_per_pdf_page(tmp_path: Path) -> None:
    pdf_path = tmp_path / "fixture.pdf"
    output_dir = tmp_path / "qa"
    _make_pdf(pdf_path, pages=3)

    page_paths = render(pdf_path, output_dir)

    assert [path.name for path in page_paths] == [
        "page-001.png",
        "page-002.png",
        "page-003.png",
    ]
    assert len(page_paths) == 3
    for page_path in page_paths:
        with Image.open(page_path) as image:
            assert image.size == (400, 600)
            assert image.mode == "RGB"


def test_render_caps_each_contact_sheet_at_twelve_labeled_pages(tmp_path: Path) -> None:
    pdf_path = tmp_path / "fixture.pdf"
    output_dir = tmp_path / "qa"
    _make_pdf(pdf_path, pages=13)

    render(pdf_path, output_dir)

    sheets = sorted(output_dir.glob("contact-sheet-*.png"))
    assert [path.name for path in sheets] == [
        "contact-sheet-01.png",
        "contact-sheet-02.png",
    ]
    expected_labels = [
        ",".join(f"Page {page_number}" for page_number in range(1, 13)),
        "Page 13",
    ]
    for sheet_path, labels in zip(sheets, expected_labels, strict=True):
        with Image.open(sheet_path) as image:
            assert image.size == (1600, 1740)
            assert image.mode == "RGB"
            assert image.info["modua_page_labels"] == labels
            assert len(labels.split(",")) <= 12


def test_render_replaces_stale_files_with_current_deterministic_outputs(
    tmp_path: Path,
) -> None:
    pdf_path = tmp_path / "fixture.pdf"
    output_dir = tmp_path / "qa"
    pages_dir = output_dir / "pages"
    pages_dir.mkdir(parents=True)
    (pages_dir / "page-999.png").write_bytes(b"stale")
    (output_dir / "contact-sheet-99.png").write_bytes(b"stale")
    _make_pdf(pdf_path, pages=13)

    first_pages = render(pdf_path, output_dir)
    first_outputs = first_pages + sorted(output_dir.glob("contact-sheet-*.png"))
    first_hashes = _hashes(first_outputs)
    second_pages = render(pdf_path, output_dir)
    second_outputs = second_pages + sorted(output_dir.glob("contact-sheet-*.png"))

    assert not (pages_dir / "page-999.png").exists()
    assert not (output_dir / "contact-sheet-99.png").exists()
    assert _hashes(second_outputs) == first_hashes
