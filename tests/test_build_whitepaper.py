from pathlib import Path
import hashlib

import fitz
from docx import Document
from docx.oxml.ns import qn

from scripts.build_whitepaper import build


def test_build_creates_matching_docx_and_pdf(tmp_path: Path) -> None:
    source = tmp_path / "sample.md"
    source.write_text(
        "# MODUA\n\n## 1. 핵심 선언\n\n모두의 일상을 돕는 AI\n\n| 항목 | 결정 |\n|---|---|\n| 브랜드 | MODUA |",
        encoding="utf-8",
    )
    docx_path, pdf_path = build(source, tmp_path / "exports")
    assert docx_path.stat().st_size > 0
    assert pdf_path.stat().st_size > 0
    docx_text = "\n".join(paragraph.text for paragraph in Document(docx_path).paragraphs)
    pdf = fitz.open(pdf_path)
    pdf_text = "\n".join(page.get_text() for page in pdf)
    assert "MODUA" in docx_text and "1. 핵심 선언" in docx_text
    assert "MODUA" in pdf_text and "1. 핵심 선언" in pdf_text


def test_separate_ordered_lists_restart_numbering(tmp_path: Path) -> None:
    source = tmp_path / "lists.md"
    source.write_text(
        "# 목록\n\n1. 첫째\n2. 둘째\n\n## 다음 목록\n\n1. 다시 첫째\n2. 다시 둘째",
        encoding="utf-8",
    )
    docx_path, _ = build(source, tmp_path / "exports")
    document = Document(docx_path)
    numbered = [paragraph for paragraph in document.paragraphs if paragraph.style.name == "MODUA Number"]
    num_ids = [
        paragraph._p.xpath("./w:pPr/w:numPr/w:numId")[0].get(qn("w:val"))
        for paragraph in numbered
    ]
    assert num_ids[:2] == [num_ids[0], num_ids[0]]
    assert num_ids[2:] == [num_ids[2], num_ids[2]]
    assert num_ids[0] != num_ids[2]


def test_two_column_table_reserves_width_for_korean_row_labels(tmp_path: Path) -> None:
    source = tmp_path / "table.md"
    source.write_text(
        "# 표\n\n| 위험 | 대응과 중단 경계 |\n|---|---|\n"
        "| 도움 제공자 담합 | " + "긴 대응 설명 " * 10 + "|",
        encoding="utf-8",
    )
    docx_path, _ = build(source, tmp_path / "exports")
    table = Document(docx_path).tables[0]
    widths = [
        int(column.get(qn("w:w")))
        for column in table._tbl.tblGrid.findall(qn("w:gridCol"))
    ]
    assert widths[0] >= 2924


def test_build_is_byte_reproducible(tmp_path: Path) -> None:
    source = Path(__file__).parents[1] / "docs/whitepaper/MODUA_WHITEPAPER_KO.md"
    first_docx, first_pdf = build(source, tmp_path / "first")
    second_docx, second_pdf = build(source, tmp_path / "second")
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest(first_docx) == digest(second_docx)
    assert digest(first_pdf) == digest(second_pdf)
