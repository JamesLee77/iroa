import hashlib
from itertools import groupby
from pathlib import Path
import re

from docx import Document
from docx.document import Document as DocumentObject
from docx.oxml.ns import qn
import pymupdf
import pytest

from scripts.build_whitepaper import build


ROOT = Path(__file__).parents[1]
OFFICIAL_SOURCE = ROOT / "docs/whitepaper/MODUA_WHITEPAPER_KO.md"
LIST_GROUP_SIZES = [
    5,
    5,
    3,
    3,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    5,
    3,
    4,
    3,
    5,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    4,
    6,
    2,
    3,
    2,
    1,
    2,
]


@pytest.fixture(scope="module")
def official_artifacts(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path, Path]:
    output_dir = tmp_path_factory.mktemp("official-whitepaper")
    docx_path, pdf_path = build(OFFICIAL_SOURCE, output_dir)
    return OFFICIAL_SOURCE, docx_path, pdf_path


def _compact(text: str) -> str:
    return re.sub(r"\s+", "", text)


def _assert_in_order(expected: list[str], actual: str) -> None:
    cursor = 0
    for value in expected:
        cursor = actual.find(value, cursor)
        assert cursor >= 0, f"missing or out of order: {value}"
        cursor += len(value)


def _source_headings(source: str) -> list[tuple[int, str]]:
    headings: list[tuple[int, str]] = []
    for line in source.splitlines():
        match = re.match(r"^(#{1,3})\s+(.+)$", line)
        if match:
            headings.append((len(match.group(1)), match.group(2).strip()))
    return headings


def _source_table_cells(source: str) -> list[str]:
    cells: list[str] = []
    for line in source.splitlines():
        if not line.startswith("|"):
            continue
        values = [value.strip() for value in line.strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", value) for value in values):
            continue
        cells.extend(re.sub(r"[*_`]", "", value) for value in values)
    return cells


def _docx_text(document: DocumentObject) -> str:
    paragraphs = [paragraph.text for paragraph in document.paragraphs]
    cells = [cell.text for table in document.tables for row in table.rows for cell in row.cells]
    return "\n".join(paragraphs + cells)


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
    with pymupdf.open(pdf_path) as pdf:
        pdf_text = "\n".join(page.get_text() for page in pdf)
    assert "MODUA" in docx_text and "1. 핵심 선언" in docx_text
    assert "MODUA" in pdf_text and "1. 핵심 선언" in pdf_text


def test_official_source_content_survives_in_both_outputs(
    official_artifacts: tuple[Path, Path, Path],
) -> None:
    source_path, docx_path, pdf_path = official_artifacts
    source = source_path.read_text(encoding="utf-8")
    headings = [text for _, text in _source_headings(source)]
    table_cells = _source_table_cells(source)
    representative_values = [
        "MODUA(모두아)는 노인, 장애인, 그리고 곁에서 돕는 사람을 위한 "
        "새로운 생활지원 프로젝트다.",
        "공공 안내문과 복지 문서를 쉬운 말로 설명한다.",
    ]

    document = Document(docx_path)
    docx_text = _compact(_docx_text(document))
    docx_headings = [
        _compact(paragraph.text)
        for paragraph in document.paragraphs
        if paragraph.style.name in {"Heading 1", "Heading 2", "Heading 3"}
    ]
    with pymupdf.open(pdf_path) as pdf:
        pdf_text = _compact("\n".join(page.get_text() for page in pdf))

    assert docx_headings == [_compact(text) for text in headings]
    _assert_in_order([_compact(text) for text in headings], pdf_text)
    for value in representative_values + table_cells:
        expected = _compact(value)
        assert expected in docx_text
        assert expected in pdf_text


def test_official_docx_uses_accessible_a4_publication_structure(
    official_artifacts: tuple[Path, Path, Path],
) -> None:
    source_path, docx_path, _ = official_artifacts
    document = Document(docx_path)
    section = document.sections[0]
    expected_headings = _source_headings(source_path.read_text(encoding="utf-8"))
    actual_headings = [
        (int(paragraph.style.name[-1]), paragraph.text)
        for paragraph in document.paragraphs
        if paragraph.style.name in {"Heading 1", "Heading 2", "Heading 3"}
    ]

    assert actual_headings == expected_headings
    for actual, expected in [
        (section.page_width.mm, 210),
        (section.page_height.mm, 297),
        (section.top_margin.mm, 20),
        (section.left_margin.mm, 18),
        (section.right_margin.mm, 18),
        (section.bottom_margin.mm, 22),
        (section.header_distance.mm, 12.5),
        (section.footer_distance.mm, 12.5),
    ]:
        assert actual == pytest.approx(expected, abs=0.02)

    list_paragraphs = [
        paragraph
        for paragraph in document.paragraphs
        if paragraph.style.name in {"MODUA Bullet", "MODUA Number"}
    ]
    num_ids = [
        paragraph._p.xpath("./w:pPr/w:numPr/w:numId")[0].get(qn("w:val"))
        for paragraph in list_paragraphs
    ]
    groups = [(num_id, len(list(items))) for num_id, items in groupby(num_ids)]
    assert [size for _, size in groups] == LIST_GROUP_SIZES
    assert len({num_id for num_id, _ in groups}) == len(groups)

    assert section.different_first_page_header_footer
    assert section.first_page_header.paragraphs[0].text == ""
    assert section.first_page_footer.paragraphs[0].text == ""
    assert section.header.paragraphs[0].text == "MODUA WHITEPAPER · KOREAN REVIEW EDITION"
    page_fields = section.footer._element.xpath(".//w:instrText")
    assert [field.text.strip() for field in page_fields] == ["PAGE"]

    assert len(document.tables) == 5
    for table in document.tables:
        grid_widths = [
            int(column.get(qn("w:w")))
            for column in table._tbl.tblGrid.findall(qn("w:gridCol"))
        ]
        assert sum(grid_widths) == 9745
        table_properties = table._tbl.tblPr
        assert table_properties.find(qn("w:tblW")).get(qn("w:w")) == "9745"
        assert table_properties.find(qn("w:tblInd")).get(qn("w:w")) == "120"
        assert table_properties.find(qn("w:tblLayout")).get(qn("w:type")) == "fixed"
        assert table.rows[0]._tr.xpath("./w:trPr/w:tblHeader")
        assert all(not row._tr.xpath("./w:trPr/w:trHeight") for row in table.rows)
        for row in table.rows:
            for cell, expected_width in zip(row.cells, grid_widths, strict=True):
                properties = cell._tc.get_or_add_tcPr()
                assert int(properties.find(qn("w:tcW")).get(qn("w:w"))) == expected_width
                assert properties.find(qn("w:vAlign")).get(qn("w:val")) == "center"
                margins = properties.find(qn("w:tcMar"))
                for side, expected_margin in {
                    "top": "80",
                    "bottom": "80",
                    "start": "120",
                    "end": "120",
                }.items():
                    assert margins.find(qn(f"w:{side}")).get(qn("w:w")) == expected_margin


def test_official_pdf_has_complete_table_header_tag_graph(
    official_artifacts: tuple[Path, Path, Path],
) -> None:
    _, _, pdf_path = official_artifacts
    with pymupdf.open(pdf_path) as pdf:
        catalog = pdf.pdf_catalog()
        mark_kind, mark_info = pdf.xref_get_key(catalog, "MarkInfo")
        tree_kind, tree_reference = pdf.xref_get_key(catalog, "StructTreeRoot")
        assert mark_kind == "dict" and "/Marked true" in mark_info
        assert tree_kind == "xref" and tree_reference.endswith(" R")

        table_header_ids: list[str] = []
        header_references: list[str] = []
        for xref in range(1, pdf.xref_length()):
            if pdf.xref_get_key(xref, "S") == ("name", "/TH"):
                id_kind, header_id = pdf.xref_get_key(xref, "ID")
                assert id_kind == "string" and header_id.startswith("modua-")
                table_header_ids.append(header_id)
            reference_kind, references = pdf.xref_get_key(xref, "A/Headers")
            if reference_kind == "array":
                values = re.findall(r"\(([^()]*)\)", references)
                assert values
                header_references.extend(values)

        assert table_header_ids
        assert len(table_header_ids) == len(set(table_header_ids))
        assert header_references
        assert set(header_references) == set(table_header_ids)
        assert len(pdf) == 30
        for page in pdf:
            assert page.rect.width == pytest.approx(595.276, abs=0.02)
            assert page.rect.height == pytest.approx(841.89, abs=0.02)
            for x0, y0, x1, y1, *_ in page.get_text("words"):
                assert 0 <= x0 <= x1 <= page.rect.width
                assert 0 <= y0 <= y1 <= page.rect.height


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


def test_unsupported_top_level_markdown_fails_before_artifacts(tmp_path: Path) -> None:
    source = tmp_path / "unsupported.md"
    source.write_text("# 지원 범위\n\n---\n\n누락되면 안 되는 내용", encoding="utf-8")
    output_dir = tmp_path / "exports"

    with pytest.raises(ValueError, match=r"unsupported top-level Markdown/HTML node: hr"):
        build(source, output_dir)

    assert not list(output_dir.glob("MODUA_WHITEPAPER_KO.*"))


def test_build_is_byte_reproducible(tmp_path: Path) -> None:
    first_docx, first_pdf = build(OFFICIAL_SOURCE, tmp_path / "first")
    second_docx, second_pdf = build(OFFICIAL_SOURCE, tmp_path / "second")
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest(first_docx) == digest(second_docx)
    assert digest(first_pdf) == digest(second_pdf)
