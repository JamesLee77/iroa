import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
import time
import unittest
from urllib.parse import unquote, urlsplit
import zipfile
from xml.etree import ElementTree as ET

from PIL import Image, ImageChops, ImageFont

from tools.brand.audit_assets import _audit_pdf, audit_official_assets, audit_png, contrast_ratio, audit_svg
from tools.brand.brand_contract import (
    CandidatePaths,
    OFFICIAL_DIGITAL_FILES,
    OFFICIAL_ICON_FILES,
    OFFICIAL_MASTER_FILES,
    OFFICIAL_PNG_SIZES,
    OFFICIAL_PRINT_FILES,
)
from tools.brand.promote_candidate import _remove_unexpected_files
from tools.brand.render_assets import render_svg_png
from tools.brand.build_usage_overview import _font, _verified_font_paths


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _local_tag(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _geometry_signature(path: Path) -> tuple[str, tuple[tuple[str, str], ...]]:
    root = ET.parse(path).getroot()
    geometry = tuple(
        (_local_tag(element.tag), element.attrib.get("d", ""))
        for element in root.iter()
        if _local_tag(element.tag) == "path"
    )
    return root.attrib.get("viewBox", ""), geometry


def _svg_colors(path: Path) -> set[str]:
    colors = set()
    for element in ET.parse(path).iter():
        for value in element.attrib.values():
            colors.update(
                color.upper() for color in re.findall(r"#[0-9A-Fa-f]{6}\b", value)
            )
    return colors


def _svg_aspect_ratio(path: Path) -> float:
    values = ET.parse(path).getroot().attrib["viewBox"].split()
    return float(values[2]) / float(values[3])


def _render_rgba(source: Path, width: int, height: int) -> Image.Image:
    with TemporaryDirectory() as directory:
        destination = Path(directory) / "render.png"
        render_svg_png(source, destination, width, height)
        with Image.open(destination).convert("RGBA") as image:
            return image.copy()


def _render_normalized(source: Path, canvas_width: int, height: int) -> Image.Image:
    width = round(height * _svg_aspect_ratio(source))
    if width > canvas_width:
        raise ValueError(f"{source} is wider than the comparison canvas")
    rendered = _render_rgba(source, width, height)
    canvas = Image.new("RGBA", (canvas_width, height))
    canvas.alpha_composite(rendered, ((canvas_width - width) // 2, 0))
    return canvas


def _alpha_iou(left: Image.Image, right: Image.Image) -> float:
    left_ink = {
        (x, y)
        for y in range(left.height)
        for x in range(left.width)
        if left.getpixel((x, y))[3] >= 128
    }
    right_ink = {
        (x, y)
        for y in range(right.height)
        for x in range(right.width)
        if right.getpixel((x, y))[3] >= 128
    }
    return len(left_ink & right_ink) / len(left_ink | right_ink)


def _ink_components(image: Image.Image) -> list[int]:
    ink = {
        (x, y)
        for y in range(image.height)
        for x in range(image.width)
        if image.getpixel((x, y))[3] >= 128
    }
    sizes = []
    while ink:
        stack = [ink.pop()]
        size = 1
        while stack:
            x, y = stack.pop()
            for neighbor in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if neighbor in ink:
                    ink.remove(neighbor)
                    stack.append(neighbor)
                    size += 1
        sizes.append(size)
    return sorted(sizes, reverse=True)


def _horizontal_ink_runs(image: Image.Image) -> list[tuple[int, int]]:
    columns = [
        x
        for x in range(image.width)
        if any(image.getpixel((x, y))[3] >= 128 for y in range(image.height))
    ]
    if not columns:
        return []
    runs = []
    start = previous = columns[0]
    for column in columns[1:]:
        if column != previous + 1:
            runs.append((start, previous))
            start = column
        previous = column
    runs.append((start, previous))
    return runs


def _relative_markdown_links(path: Path) -> tuple[Path, ...]:
    destinations = []
    source = path.read_text(encoding="utf-8")
    for destination in re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", source):
        destination = destination.strip().split(maxsplit=1)[0].strip("<>")
        parsed = urlsplit(destination)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        destinations.append(path.parent / unquote(parsed.path))
    return tuple(destinations)


def _inline_asset_paths(path: Path) -> tuple[Path, ...]:
    destinations = []
    for value in re.findall(r"`([^`\n]+)`", path.read_text(encoding="utf-8")):
        if re.search(r"\.(?:svg|png|pdf|md|docx|json)$", value, re.I):
            destinations.append(Path(value))
    return tuple(destinations)


def _markdown_table(path: Path, heading: str) -> tuple[dict[str, str], ...]:
    lines = path.read_text(encoding="utf-8").splitlines()
    if heading not in lines:
        return ()
    start = lines.index(heading)
    table = []
    for line in lines[start + 1:]:
        if not line.startswith("|"):
            if table:
                break
            continue
        cells = [cell.strip().strip("`") for cell in line.strip("|").split("|")]
        if all(re.fullmatch(r":?-+:?", cell) for cell in cells):
            continue
        table.append(cells)
    if len(table) < 2:
        return ()
    headers = table[0]
    return tuple(dict(zip(headers, row)) for row in table[1:])


def _section_inline_asset_paths(
    path: Path,
    heading: str,
    next_heading: str,
) -> tuple[Path, ...]:
    source = path.read_text(encoding="utf-8")
    start = source.index(f"{heading}\n") + len(heading) + 1
    end = source.index(f"{next_heading}\n", start)
    destinations = []
    for value in re.findall(r"`([^`\n]+)`", source[start:end]):
        if re.search(r"\.(?:svg|png|pdf|md)$", value, re.I):
            destinations.append(Path(value))
    return tuple(destinations)


_WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
_CORE_NS = "http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
_DC_NS = "http://purl.org/dc/elements/1.1/"
_PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
_OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_W = f"{{{_WORD_NS}}}"

_EXPECTED_GUIDE_IMAGES = (
    (
        "exports/digital/iroa-wordmark-512.png · Track A 공식 컬러 워드마크",
        "media/image1.png",
        Path("docs/brand/exports/digital/iroa-wordmark-512.png"),
    ),
    (
        "examples/usage-overview.png · Track A 공식 자산 적용 예시 보드",
        "media/image2.png",
        Path("docs/brand/examples/usage-overview.png"),
    ),
    (
        "exports/digital/iroa-symbol-512.png · Track A 공식 컬러 심볼",
        "media/image3.png",
        Path("docs/brand/exports/digital/iroa-symbol-512.png"),
    ),
    (
        "exports/icons/app-icon-192.png · IROA 앱 아이콘",
        "media/image4.png",
        Path("docs/brand/exports/icons/app-icon-192.png"),
    ),
    (
        "exports/icons/symbol-kiosk-1024.png · IROA 키오스크 심볼",
        "media/image5.png",
        Path("docs/brand/exports/icons/symbol-kiosk-1024.png"),
    ),
)

_EXPECTED_PDF_FONTS = {
    "NotoSansKR-Bold": ("Type 1", "Builtin"),
    "NotoSansKR-Medium": ("Type 1", "Builtin"),
    "Helvetica": ("TrueType", "WinAnsi"),
}

_PDF_RENDER_DPI = 144
# Calibrated with the independent packaged DOCX renderer (observed maxima:
# NMAE 0.002273 and 1.243% of pixels above a 16/255 channel delta).
_PDF_COMPAT_MAX_NORMALIZED_MAE = 0.003
_PDF_COMPAT_MAX_MATERIAL_PIXEL_FRACTION = 0.015
_WORKSPACE_PYTHON = Path(
    "/Users/hyunsuklee/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
)
_AUTHORITATIVE_SOFFICE = Path("/opt/homebrew/bin/soffice")
_AUTHORITATIVE_PDF_PRODUCER = "LibreOffice 26.2.5.2 (AARCH64)"
_PACKAGED_DOCX_RENDERER = Path(
    "/Users/hyunsuklee/.codex/plugins/cache/openai-primary-runtime/documents/26.826.11250/skills/"
    "documents/render_docx.py"
)
_A11Y_AUDIT = Path(
    "/Users/hyunsuklee/.codex/plugins/cache/openai-primary-runtime/documents/26.826.11250/skills/"
    "documents/scripts/a11y_audit.py"
)
_A11Y_TOOL_SHA256 = "f79d0c4a9c95bee33c40a9cffffc2132ee8f040060c762e8d77b93b887307c5d"
_PLATFORM_ICON_BACKGROUND = (22, 38, 61)


def _docx_xml(path: Path, member: str) -> ET.Element:
    with zipfile.ZipFile(path) as archive:
        return ET.fromstring(archive.read(member))


def _word_text(element: ET.Element) -> str:
    return "".join(node.text or "" for node in element.iter(f"{_W}t"))


def _normalized_visible_text(value: str) -> str:
    return " ".join(value.split())


def _markdown_visible_units(path: Path) -> tuple[str, ...]:
    units = []
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("|"):
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            if all(re.fullmatch(r":?-+:?", cell) for cell in cells):
                continue
            candidates = cells
        else:
            is_heading = bool(re.match(r"^#{1,6}\s+", line))
            line = re.sub(r"^#{1,6}\s+", "", line)
            line = re.sub(r"^>\s?", "", line)
            if not is_heading:
                line = re.sub(r"^(?:[-+*]|\d+\.)\s+", "", line)
            candidates = [line]
        for candidate in candidates:
            candidate = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", candidate)
            candidate = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", candidate)
            candidate = candidate.replace("**", "").replace("__", "")
            candidate = candidate.replace("`", "").strip()
            normalized = _normalized_visible_text(candidate)
            if normalized:
                units.append(normalized)
    return tuple(units)


def _pdf_info(path: Path) -> dict[str, str]:
    result = subprocess.run(
        ["pdfinfo", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return {
        key.strip(): value.strip()
        for line in result.stdout.splitlines()
        if ":" in line
        for key, value in [line.split(":", 1)]
    }


def _guide_docx_media_bindings(
    path: Path,
) -> tuple[tuple[dict[str, str], ...], tuple[str, ...], dict[str, str]]:
    with zipfile.ZipFile(path) as archive:
        members = tuple(sorted(name for name in archive.namelist() if name.startswith("word/media/")))
        relationships = ET.fromstring(archive.read("word/_rels/document.xml.rels"))
        image_relationships = {
            node.get("Id"): node.get("Target")
            for node in relationships.findall(f"{{{_PACKAGE_REL_NS}}}Relationship")
            if (node.get("Type") or "").endswith("/image")
        }
        document = ET.fromstring(archive.read("word/document.xml"))
        bindings = []
        for inline in (node for node in document.iter() if node.tag.endswith("}inline")):
            drawing = next((node for node in inline.iter() if node.tag.endswith("}docPr")), None)
            blip = next((node for node in inline.iter() if node.tag.endswith("}blip")), None)
            if drawing is None or blip is None:
                continue
            relationship_id = blip.get(f"{{{_OFFICE_REL_NS}}}embed")
            target = image_relationships.get(relationship_id)
            member = f"word/{target}" if target else ""
            bindings.append(
                {
                    "alt": (drawing.get("descr") or "").strip(),
                    "relationship_id": relationship_id or "",
                    "target": target or "",
                    "member": member,
                    "sha256": hashlib.sha256(archive.read(member)).hexdigest() if member in members else "",
                }
            )
        return tuple(bindings), members, image_relationships


def _assert_guide_docx_media_contract(testcase: unittest.TestCase, path: Path) -> None:
    bindings, members, image_relationships = _guide_docx_media_bindings(path)
    testcase.assertEqual(len(bindings), len(_EXPECTED_GUIDE_IMAGES))
    testcase.assertEqual(tuple(item["alt"] for item in bindings), tuple(item[0] for item in _EXPECTED_GUIDE_IMAGES))
    testcase.assertEqual(tuple(item["target"] for item in bindings), tuple(item[1] for item in _EXPECTED_GUIDE_IMAGES))
    testcase.assertEqual(len({item["relationship_id"] for item in bindings}), len(_EXPECTED_GUIDE_IMAGES))
    testcase.assertEqual(
        image_relationships,
        {item["relationship_id"]: item["target"] for item in bindings},
    )
    testcase.assertEqual(members, tuple(f"word/{item[1]}" for item in _EXPECTED_GUIDE_IMAGES))
    with zipfile.ZipFile(path) as archive:
        for binding, (_, target, source) in zip(bindings, _EXPECTED_GUIDE_IMAGES):
            embedded = archive.read(f"word/{target}")
            source_bytes = source.read_bytes()
            testcase.assertEqual(binding["sha256"], _digest(source), source)
            testcase.assertTrue(embedded == source_bytes, source)


def _parse_pdffonts_output(stdout: str) -> tuple[dict[str, str], ...]:
    lines = stdout.splitlines()
    if len(lines) < 3:
        raise ValueError("pdffonts output has no font rows")
    spans = tuple((match.start(), match.end()) for match in re.finditer(r"-+", lines[1]))
    columns = ("name", "type", "encoding", "emb", "sub", "uni", "object_id")
    if len(spans) != len(columns):
        raise ValueError(f"unexpected pdffonts columns: {lines[:2]}")
    rows = []
    for line in lines[2:]:
        if not line.strip():
            continue
        values = [
            line[start : (end if index < len(spans) - 1 else None)].strip()
            for index, (start, end) in enumerate(spans)
        ]
        rows.append(dict(zip(columns, values)))
    if not rows:
        raise ValueError("pdffonts output has no font rows")
    return tuple(rows)


def _pdf_font_rows(path: Path) -> tuple[dict[str, str], ...]:
    result = subprocess.run(["pdffonts", str(path)], check=True, capture_output=True, text=True)
    return _parse_pdffonts_output(result.stdout)


def _assert_guide_pdf_font_contract(testcase: unittest.TestCase, rows: tuple[dict[str, str], ...]) -> None:
    families = []
    for row in rows:
        testcase.assertEqual(row["emb"], "yes", row)
        testcase.assertEqual(row["sub"], "yes", row)
        testcase.assertEqual(row["uni"], "yes", row)
        testcase.assertNotEqual(row["type"], "Type 3", row)
        match = re.fullmatch(r"[A-Z]{6}\+(.+)", row["name"])
        testcase.assertIsNotNone(match, row)
        family = match.group(1)
        families.append(family)
        testcase.assertIn(family, _EXPECTED_PDF_FONTS, row)
        testcase.assertEqual((row["type"], row["encoding"]), _EXPECTED_PDF_FONTS[family], row)
    testcase.assertEqual(set(families), set(_EXPECTED_PDF_FONTS))


def _pdf_page_texts(path: Path) -> tuple[str, ...]:
    page_count = int(_pdf_info(path)["Pages"])
    pages = []
    for page_number in range(1, page_count + 1):
        result = subprocess.run(
            ["pdftotext", "-layout", "-f", str(page_number), "-l", str(page_number), str(path), "-"],
            check=True,
            capture_output=True,
            text=True,
        )
        pages.append(_normalized_visible_text(result.stdout))
    return tuple(pages)


def _pdf_page_geometries(path: Path) -> tuple[dict[str, str], ...]:
    page_count = int(_pdf_info(path)["Pages"])
    result = subprocess.run(
        ["pdfinfo", "-box", "-f", "1", "-l", str(page_count), str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    geometries = [dict() for _ in range(page_count)]
    pattern = re.compile(r"^Page\s+(\d+)\s+(size|rot|MediaBox|CropBox|BleedBox|TrimBox|ArtBox):\s+(.+)$")
    for line in result.stdout.splitlines():
        match = pattern.match(line)
        if match:
            page_number, key, value = match.groups()
            geometries[int(page_number) - 1][key] = _normalized_visible_text(value)
    expected_keys = {"size", "rot", "MediaBox", "CropBox", "BleedBox", "TrimBox", "ArtBox"}
    if any(set(geometry) != expected_keys for geometry in geometries):
        raise ValueError(f"incomplete pdfinfo geometry: {geometries}")
    return tuple(geometries)


def _render_pdf_pages(path: Path, destination: Path) -> tuple[Path, ...]:
    destination.mkdir(parents=True)
    result = subprocess.run(
        ["pdftoppm", "-r", str(_PDF_RENDER_DPI), "-png", str(path), str(destination / "page")],
        capture_output=True,
        text=True,
    )
    if result.returncode or result.stderr:
        raise RuntimeError(result.stderr or f"pdftoppm exited {result.returncode}")
    return tuple(sorted(destination.glob("page-*.png")))


def _authoritative_docx_pdf_conversion(source: Path, root: Path) -> Path:
    home = root / "authoritative-home"
    temporary = root / "authoritative-tmp"
    profile = root / "authoritative-profile"
    output = root / "authoritative-output"
    for directory in (home, temporary, profile, output):
        directory.mkdir()
    environment = os.environ.copy()
    environment.update(
        {
            "HOME": str(home.resolve()),
            "TMPDIR": str(temporary.resolve()),
            "SAL_FONTPATH": str(Path("docs/brand/assets/fonts").resolve()),
            "LANG": "C.UTF-8",
            "LC_ALL": "C.UTF-8",
            "TZ": "Asia/Seoul",
        }
    )
    result = subprocess.run(
        [
            str(_AUTHORITATIVE_SOFFICE),
            "--headless",
            f"-env:UserInstallation={profile.resolve().as_uri()}",
            "--convert-to",
            "pdf",
            "--outdir",
            str(output),
            str(source),
        ],
        capture_output=True,
        text=True,
        env=environment,
    )
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    converted = output / f"{source.stem}.pdf"
    if not converted.is_file():
        raise RuntimeError(result.stderr or result.stdout or f"missing {converted}")
    return converted


def _create_graphics_only_pdf_mutation(source: Path, output: Path) -> None:
    script = """
from io import BytesIO
from pathlib import Path
import sys
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

source = Path(sys.argv[1])
output = Path(sys.argv[2])
reader = PdfReader(source)
overlay_buffer = BytesIO()
overlay = canvas.Canvas(overlay_buffer, pagesize=(595.304, 841.89), pageCompression=0)
overlay.setFillColorRGB(1, 1, 1)
overlay.rect(275, 367, 45, 35, stroke=0, fill=1)
overlay.save()
overlay_buffer.seek(0)
reader.pages[7].merge_page(PdfReader(overlay_buffer).pages[0], over=True)
writer = PdfWriter()
for page in reader.pages:
    writer.add_page(page)
with output.open("wb") as handle:
    writer.write(handle)
"""
    result = subprocess.run(
        [str(_WORKSPACE_PYTHON), "-c", script, str(source), str(output)],
        capture_output=True,
        text=True,
    )
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)


def _pdf_raster_parity(
    left: Path,
    right: Path,
) -> dict[str, float | int | tuple[int, int] | tuple[int, int, int, int] | None]:
    with Image.open(left).convert("RGB") as left_image, Image.open(right).convert("RGB") as right_image:
        if left_image.size != right_image.size:
            return {
                "size": left_image.size,
                "normalized_mae": 1.0,
                "material_pixel_fraction": 1.0,
                "difference_bbox": (0, 0, left_image.width, left_image.height),
                "nonzero_pixel_count": left_image.width * left_image.height,
            }
        difference = ImageChops.difference(left_image, right_image)
        pixels = left_image.width * left_image.height
        histogram = difference.histogram()
        absolute_channel_error = sum((index % 256) * count for index, count in enumerate(histogram))
        normalized_mae = absolute_channel_error / (pixels * 3 * 255)
        red, green, blue = difference.split()
        maximum_channel = ImageChops.lighter(ImageChops.lighter(red, green), blue)
        material_histogram = maximum_channel.histogram()
        material_pixel_fraction = sum(material_histogram[17:]) / pixels
        return {
            "size": left_image.size,
            "normalized_mae": normalized_mae,
            "material_pixel_fraction": material_pixel_fraction,
            "difference_bbox": difference.getbbox(),
            "nonzero_pixel_count": pixels - maximum_channel.histogram()[0],
        }


def _assert_pdf_text_and_geometry_parity(
    testcase: unittest.TestCase,
    left: Path,
    right: Path,
    *,
    require_text: bool,
) -> None:
    testcase.assertEqual(_pdf_info(left)["Pages"], _pdf_info(right)["Pages"])
    if require_text:
        testcase.assertEqual(_pdf_page_texts(left), _pdf_page_texts(right))
    left_geometry = _pdf_page_geometries(left)
    testcase.assertEqual(left_geometry, _pdf_page_geometries(right))
    for geometry in left_geometry:
        testcase.assertEqual(geometry["size"], "595.304 x 841.89 pts (A4)")
        testcase.assertEqual(geometry["rot"], "0")
        for key in ("MediaBox", "CropBox", "BleedBox", "TrimBox", "ArtBox"):
            testcase.assertEqual(geometry[key], "0.00 0.00 595.30 841.89")


def _render_pdf_parity_metrics(
    testcase: unittest.TestCase,
    left: Path,
    right: Path,
    render_root: Path,
) -> tuple[dict[str, float | int | tuple[int, int] | tuple[int, int, int, int] | None], ...]:
    left_pages = _render_pdf_pages(left, render_root / "left")
    right_pages = _render_pdf_pages(right, render_root / "right")
    testcase.assertEqual(len(left_pages), len(right_pages))
    return tuple(_pdf_raster_parity(left_page, right_page) for left_page, right_page in zip(left_pages, right_pages))


def _assert_authoritative_distribution_pdf_binding(
    testcase: unittest.TestCase,
    committed: Path,
    converted: Path,
    render_root: Path,
) -> tuple[dict[str, float | int | tuple[int, int] | tuple[int, int, int, int] | None], ...]:
    """Distribution gate: fixed conversion must be pixel-exact, not merely similar."""
    _assert_pdf_text_and_geometry_parity(testcase, committed, converted, require_text=True)
    metrics = _render_pdf_parity_metrics(testcase, committed, converted, render_root)
    for page_number, metric in enumerate(metrics, 1):
        testcase.assertEqual(metric["size"], (1191, 1684), page_number)
        testcase.assertIsNone(metric["difference_bbox"], (page_number, metric))
        testcase.assertEqual(metric["nonzero_pixel_count"], 0, (page_number, metric))
        testcase.assertEqual(metric["normalized_mae"], 0.0, (page_number, metric))
        testcase.assertEqual(metric["material_pixel_fraction"], 0.0, (page_number, metric))
    return metrics


def _assert_packaged_renderer_pdf_compatibility(
    testcase: unittest.TestCase,
    committed: Path,
    rendered: Path,
    render_root: Path,
) -> tuple[dict[str, float | int | tuple[int, int] | tuple[int, int, int, int] | None], ...]:
    """Compatibility diagnostic: independent renderer profiles may vary slightly."""
    _assert_pdf_text_and_geometry_parity(testcase, committed, rendered, require_text=False)
    metrics = _render_pdf_parity_metrics(testcase, committed, rendered, render_root)
    for page_number, metric in enumerate(metrics, 1):
        testcase.assertEqual(metric["size"], (1191, 1684), page_number)
        testcase.assertLessEqual(
            metric["normalized_mae"],
            _PDF_COMPAT_MAX_NORMALIZED_MAE,
            (page_number, metric),
        )
        testcase.assertLessEqual(
            metric["material_pixel_fraction"],
            _PDF_COMPAT_MAX_MATERIAL_PIXEL_FRACTION,
            (page_number, metric),
        )
    return metrics


class BrandContractTest(unittest.TestCase):
    def test_bi_guide_has_v1_contract(self):
        guide = Path("docs/brand/IROA_BI_GUIDE_KO.md").read_text(encoding="utf-8")
        for required in (
            "버전: 1.0",
            "iroa.ai 도메인은 확보 완료",
            "상표권 확보와는 별개의 문제",
            "공동 브랜딩",
            "접근성 대비",
            "파비콘",
            "마스크 가능 아이콘",
        ):
            self.assertIn(required, guide)

    def test_brand_document_relative_links_resolve(self):
        documents = (
            Path("docs/brand/IROA_BI_GUIDE_KO.md"),
            Path("docs/brand/README.md"),
        )
        for document in documents:
            self.assertTrue(document.is_file(), document)
            links = _relative_markdown_links(document)
            self.assertTrue(links, f"{document} must link to its referenced assets")
            for target in links:
                self.assertTrue(target.exists(), f"{document}: broken link to {target}")

    def test_documented_asset_paths_exist_and_match_the_managed_inventory(self):
        allowed = {
            *(Path("masters") / path for path in OFFICIAL_MASTER_FILES),
            *(Path("exports/digital") / path for path in OFFICIAL_DIGITAL_FILES),
            *(Path("exports/icons") / path for path in OFFICIAL_ICON_FILES),
            *(Path("exports/print") / path for path in OFFICIAL_PRINT_FILES),
            Path("iroa-symbol.svg"),
            Path("iroa-wordmark.svg"),
            Path("iroa-wordmark-mono.svg"),
            Path("iroa-wordmark-reverse.svg"),
            Path("iroa-symbol.png"),
            Path("iroa-wordmark.png"),
            Path("examples/usage-overview.png"),
            Path("examples/usage-overview-manifest.json"),
            Path("assets/fonts/SOURCE.md"),
            Path("assets/photos/PHOTO-MANIFEST.md"),
            Path("IROA_BI_GUIDE_KO.md"),
            Path("IROA_BI_GUIDE_KO.docx"),
            Path("IROA_BI_GUIDE_KO.pdf"),
            Path("IROA_BI_GUIDE_KO.a11y.json"),
        }
        for document in (
            Path("docs/brand/IROA_BI_GUIDE_KO.md"),
            Path("docs/brand/README.md"),
        ):
            for relative in _inline_asset_paths(document):
                self.assertNotRegex(str(relative), r"[*{}]", relative)
                self.assertIn(relative, allowed, (document, relative))
                self.assertTrue((Path("docs/brand") / relative).is_file(), relative)

    def test_guide_official_inventory_is_exactly_the_49_managed_files(self):
        expected = {
            *(Path("masters") / path for path in OFFICIAL_MASTER_FILES),
            *(Path("exports/digital") / path for path in OFFICIAL_DIGITAL_FILES),
            *(Path("exports/icons") / path for path in OFFICIAL_ICON_FILES),
            *(Path("exports/print") / path for path in OFFICIAL_PRINT_FILES),
        }
        documented = _section_inline_asset_paths(
            Path("docs/brand/IROA_BI_GUIDE_KO.md"),
            "## 11. 공식 관리 출력 인벤토리 (49개)",
            "## 12. 호환·기록·예시",
        )
        self.assertEqual(len(documented), 49)
        self.assertEqual(set(documented), expected)
        for relative in documented:
            self.assertTrue((Path("docs/brand") / relative).is_file(), relative)

    def test_readme_defines_one_editable_input_and_managed_outputs(self):
        rows = {
            row["경로"]: row
            for row in _markdown_table(
                Path("docs/brand/README.md"),
                "## 저장소 역할 계약",
            )
        }
        self.assertEqual(set(rows), {"candidates/track-a", "masters", "exports"})
        self.assertEqual(rows["candidates/track-a"]["역할"], "approved-editable-input")
        self.assertEqual(rows["candidates/track-a"]["직접 편집"], "예")
        for path in ("masters", "exports"):
            self.assertEqual(rows[path]["역할"], "managed-output")
            self.assertEqual(rows[path]["직접 편집"], "아니오")
        self.assertEqual(
            rows["candidates/track-a"]["다음 단계"],
            "promotion → masters/exports → verify",
        )

    def test_published_contrast_values_are_recomputed_from_the_palette(self):
        guide = Path("docs/brand/IROA_BI_GUIDE_KO.md")
        colors = {
            row["이름"]: row["HEX"]
            for row in _markdown_table(guide, "### 3.1 컬러 값")
        }
        rows = _markdown_table(guide, "### 3.3 허용 조합과 측정값")
        self.assertGreaterEqual(len(rows), 9)
        for row in rows:
            foreground, background = row["전경 / 배경"].split(" / ")
            published = float(row["대비"].removesuffix(":1"))
            recomputed = contrast_ratio(colors[foreground], colors[background])
            self.assertAlmostEqual(published, recomputed, places=2, msg=row)

    def test_guide_defines_precise_wcag_thresholds(self):
        rows = {
            row["대상"]: row
            for row in _markdown_table(
                Path("docs/brand/IROA_BI_GUIDE_KO.md"),
                "### 3.2 적용 기준",
            )
        }
        self.assertEqual(set(rows), {"일반 텍스트", "큰 텍스트", "비텍스트 UI·그래픽"})
        self.assertEqual(rows["일반 텍스트"]["최소 대비"], "4.5:1")
        self.assertEqual(rows["큰 텍스트"]["최소 대비"], "3:1")
        self.assertEqual(rows["큰 텍스트"]["정의"], "18pt 이상 일반 또는 14pt 이상 굵게")
        self.assertEqual(rows["비텍스트 UI·그래픽"]["최소 대비"], "3:1")

    def test_guide_exports_exist_and_are_nonempty(self):
        for path in (
            Path("docs/brand/IROA_BI_GUIDE_KO.docx"),
            Path("docs/brand/IROA_BI_GUIDE_KO.pdf"),
        ):
            self.assertTrue(path.is_file(), path)
            self.assertGreater(path.stat().st_size, 100_000, path)

    def test_guide_docx_rebuild_is_byte_deterministic_across_wall_clock_seconds(self):
        with TemporaryDirectory() as directory:
            first = Path(directory) / "first.docx"
            second = Path(directory) / "second.docx"
            command = [
                str(_WORKSPACE_PYTHON),
                "tools/brand/build_guide.py",
                "--source",
                "docs/brand/IROA_BI_GUIDE_KO.md",
            ]
            subprocess.run(command + ["--output", str(first)], check=True, capture_output=True, text=True)
            time.sleep(2.1)
            subprocess.run(command + ["--output", str(second)], check=True, capture_output=True, text=True)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with zipfile.ZipFile(first) as archive:
                self.assertEqual(archive.namelist(), sorted(archive.namelist()))
                self.assertEqual(
                    {member.date_time for member in archive.infolist()},
                    {(1980, 1, 1, 0, 0, 0)},
                )

    def test_guide_a11y_receipt_is_reproducible_and_bound_to_current_docx(self):
        receipt_path = Path("docs/brand/IROA_BI_GUIDE_KO.a11y.json")
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        guide = Path("docs/brand/IROA_BI_GUIDE_KO.docx")
        self.assertEqual(receipt["schema"], "iroa-docx-a11y-receipt-v1")
        self.assertEqual(receipt["bundle_version"], "26.826.11250")
        self.assertEqual(receipt["tool_sha256"], _A11Y_TOOL_SHA256)
        self.assertEqual(_digest(_A11Y_AUDIT), _A11Y_TOOL_SHA256)
        self.assertEqual(receipt["source"], guide.as_posix())
        self.assertEqual(receipt["source_sha256"], _digest(guide))
        self.assertEqual(receipt["counts"], {"high": 0, "medium": 0, "low": 0})
        self.assertEqual(receipt["findings"], [])
        with TemporaryDirectory() as directory:
            fresh = Path(directory) / "a11y.json"
            subprocess.run(
                [str(_WORKSPACE_PYTHON), str(_A11Y_AUDIT), str(guide), "--out_json", str(fresh)],
                check=True,
                capture_output=True,
                text=True,
            )
            report = json.loads(fresh.read_text(encoding="utf-8"))
        self.assertEqual(report["counts"], receipt["counts"])
        self.assertEqual(report["findings"], receipt["findings"])

    def test_guide_docx_metadata_identifies_the_v1_distribution_source(self):
        path = Path("docs/brand/IROA_BI_GUIDE_KO.docx")
        self.assertTrue(Path("tools/brand/build_guide.py").is_file())
        core = _docx_xml(path, "docProps/core.xml")
        self.assertEqual(core.findtext(f"{{{_DC_NS}}}title"), "IROA.AI Brand Identity Guide")
        self.assertEqual(
            core.findtext(f"{{{_DC_NS}}}subject"),
            "IROA.AI 브랜드 아이덴티티 가이드 · v1.0 · 2026-08-27",
        )
        self.assertEqual(core.findtext(f"{{{_CORE_NS}}}version"), "1.0")
        self.assertEqual(
            core.findtext(f"{{{_CORE_NS}}}category"),
            "compact_reference_guide / editorial_cover / A4 / IROA palette",
        )
        description = core.findtext(f"{{{_DC_NS}}}description") or ""
        self.assertIn("docs/brand/IROA_BI_GUIDE_KO.md", description)
        self.assertIn("Track A", description)

    def test_guide_docx_carries_the_named_a4_reference_tokens(self):
        path = Path("docs/brand/IROA_BI_GUIDE_KO.docx")
        document = _docx_xml(path, "word/document.xml")
        sections = tuple(document.iter(f"{_W}sectPr"))
        self.assertTrue(sections)
        for section in sections:
            page = section.find(f"{_W}pgSz")
            margins = section.find(f"{_W}pgMar")
            self.assertEqual((page.get(f"{_W}w"), page.get(f"{_W}h")), ("11906", "16838"))
            self.assertEqual(page.get(f"{_W}orient", "portrait"), "portrait")
            self.assertEqual(margins.get(f"{_W}top"), "1134")
            self.assertEqual(margins.get(f"{_W}right"), "1020")
            self.assertEqual(margins.get(f"{_W}bottom"), "1020")
            self.assertEqual(margins.get(f"{_W}left"), "1020")
            self.assertEqual(margins.get(f"{_W}header"), "567")
            self.assertEqual(margins.get(f"{_W}footer"), "567")

        styles = _docx_xml(path, "word/styles.xml")
        style_map = {
            style.get(f"{_W}styleId"): style
            for style in styles.findall(f"{_W}style")
        }
        expected = {
            "Normal": ("21", "19222E", "0", "120", "300"),
            "Title": ("56", "16263D", "0", "240", "300"),
            "Heading1": ("32", "16263D", "360", "200", "300"),
            "Heading2": ("26", "16263D", "280", "140", "300"),
            "Heading3": ("24", "19222E", "200", "100", "300"),
        }
        for style_id, tokens in expected.items():
            style = style_map[style_id]
            rpr = style.find(f"{_W}rPr")
            ppr = style.find(f"{_W}pPr")
            fonts = rpr.find(f"{_W}rFonts")
            spacing = ppr.find(f"{_W}spacing")
            self.assertEqual(fonts.get(f"{_W}ascii"), "Noto Sans KR")
            self.assertEqual(fonts.get(f"{_W}eastAsia"), "Noto Sans KR")
            self.assertEqual(rpr.find(f"{_W}sz").get(f"{_W}val"), tokens[0])
            self.assertEqual(rpr.find(f"{_W}color").get(f"{_W}val"), tokens[1])
            self.assertEqual(spacing.get(f"{_W}before"), tokens[2])
            self.assertEqual(spacing.get(f"{_W}after"), tokens[3])
            self.assertEqual(spacing.get(f"{_W}line"), tokens[4])
            self.assertEqual(spacing.get(f"{_W}lineRule"), "auto")
        self.assertIn("IROACaption", style_map)
        self.assertIn("IROANote", style_map)

    def test_guide_docx_uses_real_word_numbering(self):
        path = Path("docs/brand/IROA_BI_GUIDE_KO.docx")
        numbering = _docx_xml(path, "word/numbering.xml")
        formats = {
            node.get(f"{_W}val")
            for node in numbering.iter(f"{_W}numFmt")
        }
        self.assertIn("bullet", formats)
        self.assertIn("decimal", formats)

        document = _docx_xml(path, "word/document.xml")
        numbered = [
            paragraph
            for paragraph in document.iter(f"{_W}p")
            if paragraph.find(f"{_W}pPr/{_W}numPr") is not None
        ]
        self.assertGreaterEqual(len(numbered), 35)
        self.assertTrue(all(_word_text(paragraph).strip() for paragraph in numbered))
        for paragraph in document.iter(f"{_W}p"):
            text = _word_text(paragraph).lstrip()
            self.assertFalse(text.startswith(("- ", "• ", "● ")), text)

        footer_codes = []
        with zipfile.ZipFile(path) as archive:
            for member in archive.namelist():
                if re.fullmatch(r"word/footer\d+\.xml", member):
                    footer = ET.fromstring(archive.read(member))
                    footer_codes.extend(
                        (node.text or "").strip()
                        for node in footer.iter(f"{_W}instrText")
                    )
        self.assertIn("PAGE", footer_codes)
        self.assertIn("NUMPAGES", footer_codes)

    def test_guide_docx_tables_have_exact_fixed_geometry(self):
        path = Path("docs/brand/IROA_BI_GUIDE_KO.docx")
        document = _docx_xml(path, "word/document.xml")
        tables = tuple(document.iter(f"{_W}tbl"))
        self.assertGreaterEqual(len(tables), 15)
        for table in tables:
            properties = table.find(f"{_W}tblPr")
            self.assertEqual(properties.find(f"{_W}tblW").get(f"{_W}w"), "9866")
            self.assertEqual(properties.find(f"{_W}tblW").get(f"{_W}type"), "dxa")
            self.assertEqual(properties.find(f"{_W}tblInd").get(f"{_W}w"), "120")
            self.assertEqual(properties.find(f"{_W}tblInd").get(f"{_W}type"), "dxa")
            self.assertEqual(properties.find(f"{_W}tblLayout").get(f"{_W}type"), "fixed")
            margins = properties.find(f"{_W}tblCellMar")
            expected_margins = {"top": "80", "bottom": "80", "start": "120", "end": "120"}
            for name, expected in expected_margins.items():
                node = margins.find(f"{_W}{name}")
                self.assertEqual(node.get(f"{_W}w"), expected)
                self.assertEqual(node.get(f"{_W}type"), "dxa")

            grid = [
                int(column.get(f"{_W}w"))
                for column in table.find(f"{_W}tblGrid").findall(f"{_W}gridCol")
            ]
            self.assertEqual(sum(grid), 9866)
            rows = table.findall(f"{_W}tr")
            self.assertIsNotNone(rows[0].find(f"{_W}trPr/{_W}tblHeader"))
            for row in rows:
                self.assertIsNone(row.find(f"{_W}trPr/{_W}trHeight"))
                self.assertIsNotNone(row.find(f"{_W}trPr/{_W}cantSplit"))
                widths = [
                    int(cell.find(f"{_W}tcPr/{_W}tcW").get(f"{_W}w"))
                    for cell in row.findall(f"{_W}tc")
                ]
                self.assertEqual(widths, grid)
                self.assertTrue(
                    all(
                        cell.find(f"{_W}tcPr/{_W}vAlign").get(f"{_W}val") == "center"
                        for cell in row.findall(f"{_W}tc")
                    )
                )

    def test_guide_docx_images_are_official_and_have_alt_text(self):
        path = Path("docs/brand/IROA_BI_GUIDE_KO.docx")
        _assert_guide_docx_media_contract(self, path)

        with TemporaryDirectory() as directory:
            altered = Path(directory) / "copied-alt-unofficial-image.docx"
            with zipfile.ZipFile(path) as source, zipfile.ZipFile(altered, "w") as destination:
                for member in source.infolist():
                    payload = source.read(member.filename)
                    if member.filename == "word/media/image1.png":
                        payload = Path("docs/brand/exports/icons/app-icon-192.png").read_bytes()
                    destination.writestr(member, payload)
            with self.assertRaises(AssertionError):
                _assert_guide_docx_media_contract(self, altered)

    def test_guide_docx_plain_runs_inherit_their_paragraph_styles(self):
        document = _docx_xml(Path("docs/brand/IROA_BI_GUIDE_KO.docx"), "word/document.xml")
        font_only_runs = []
        for run in document.iter(f"{_W}r"):
            properties = run.find(f"{_W}rPr")
            if properties is None:
                continue
            children = tuple(properties)
            if len(children) == 1 and children[0].tag == f"{_W}rFonts":
                font_only_runs.append(_word_text(run))
        self.assertEqual(font_only_runs, [])

    def test_guide_docx_embeds_the_two_pinned_noto_fonts(self):
        path = Path("docs/brand/IROA_BI_GUIDE_KO.docx")
        relationship_ns = "http://schemas.openxmlformats.org/package/2006/relationships"
        office_relationship_ns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
        with zipfile.ZipFile(path) as archive:
            self.assertIn("word/_rels/fontTable.xml.rels", archive.namelist())
            font_table = ET.fromstring(archive.read("word/fontTable.xml"))
            rels = ET.fromstring(archive.read("word/_rels/fontTable.xml.rels"))
            relationships = {
                node.get("Id"): node.get("Target")
                for node in rels.findall(f"{{{relationship_ns}}}Relationship")
            }
            noto = next(
                node
                for node in font_table.findall(f"{_W}font")
                if node.get(f"{_W}name") == "Noto Sans KR"
            )
            embedded = {
                "embedRegular": Path("docs/brand/assets/fonts/NotoSansKR-Medium.otf"),
                "embedBold": Path("docs/brand/assets/fonts/NotoSansKR-Bold.otf"),
            }
            for role, source in embedded.items():
                node = noto.find(f"{_W}{role}")
                relationship_id = node.get(f"{{{office_relationship_ns}}}id")
                font_key = bytes.fromhex(node.get(f"{_W}fontKey").strip("{}").replace("-", ""))[::-1]
                payload = bytearray(archive.read(f"word/{relationships[relationship_id]}"))
                for index in range(32):
                    payload[index] ^= font_key[index % 16]
                self.assertEqual(hashlib.sha256(payload).hexdigest(), _digest(source))

    def test_guide_docx_preserves_every_markdown_content_unit(self):
        source = Path("docs/brand/IROA_BI_GUIDE_KO.md")
        output = Path("docs/brand/IROA_BI_GUIDE_KO.docx")
        document = _docx_xml(output, "word/document.xml")
        actual = {
            _normalized_visible_text(_word_text(paragraph))
            for paragraph in document.iter(f"{_W}p")
            if _normalized_visible_text(_word_text(paragraph))
        }
        missing = [unit for unit in _markdown_visible_units(source) if unit not in actual]
        self.assertEqual(missing, [])

        corpus = "\n".join(sorted(actual))
        for required in (
            "공식 관리 출력 인벤토리 (49개)",
            "iroa.ai 도메인은 확보 완료 상태다.",
            "그러나 도메인 보유는 상표권 확보와는 별개의 문제다.",
            "이 문서는 브랜드 운영 기준이지 법률 의견, 상표 등록 증명 또는 접근성 인증서가 아니다.",
            "1.0",
            "2026-08-27",
        ):
            self.assertIn(required, corpus)
        self.assertNotRegex(
            corpus,
            r"(?:TODO|TBD|FIXME|XXX|Lorem|Ipsum|placeholder|:codex-file-citation|turn\d+(?:search|fetch)\d+|【\d+†)",
        )

    def test_guide_pdf_is_a4_metadata_complete_and_poppler_clean(self):
        path = Path("docs/brand/IROA_BI_GUIDE_KO.pdf")
        info = _pdf_info(path)
        self.assertEqual(info["Title"], "IROA.AI Brand Identity Guide")
        self.assertEqual(
            info["Subject"],
            "IROA.AI 브랜드 아이덴티티 가이드 · v1.0 · 2026-08-27",
        )
        self.assertIn("595.304 x 841.89 pts (A4)", info["Page size"])
        self.assertGreaterEqual(int(info["Pages"]), 10)
        self.assertGreater(path.stat().st_size, 100_000)

        font_rows = _pdf_font_rows(path)
        _assert_guide_pdf_font_contract(self, font_rows)

        fallback_rows = tuple(dict(row) for row in font_rows)
        fallback_rows[0]["name"] = "BAAAAA+LiberationSans-Bold"
        with self.assertRaises(AssertionError):
            _assert_guide_pdf_font_contract(self, fallback_rows)
        unembedded_rows = tuple(dict(row) for row in font_rows)
        unembedded_rows[0]["emb"] = "no"
        with self.assertRaises(AssertionError):
            _assert_guide_pdf_font_contract(self, unembedded_rows)

        text_result = subprocess.run(
            ["pdftotext", "-layout", str(path), "-"],
            check=True,
            capture_output=True,
            text=True,
        )
        visible = _normalized_visible_text(text_result.stdout)
        self.assertIn("IROA.AI 브랜드 아이덴티티 가이드", visible)
        self.assertIn("공식 관리 출력 인벤토리 (49개)", visible)
        self.assertIn("iroa.ai 도메인은 확보 완료 상태다.", visible)
        self.assertNotRegex(visible, r"(?:TODO|TBD|FIXME|XXX|:codex-file-citation|【\d+†)")

        with TemporaryDirectory() as directory:
            prefix = Path(directory) / "page"
            render = subprocess.run(
                ["pdftoppm", "-r", "72", "-png", str(path), str(prefix)],
                capture_output=True,
                text=True,
            )
            self.assertEqual(render.returncode, 0, render.stderr)
            self.assertEqual(render.stderr, "", render.stderr)
            pages = sorted(Path(directory).glob("page-*.png"))
            self.assertEqual(len(pages), int(info["Pages"]))
            for page in pages:
                with Image.open(page) as image:
                    self.assertIn(image.size, {(596, 842), (595, 842)}, page)

    def test_guide_distribution_pdf_exactly_matches_authoritative_docx_conversion(self):
        committed = Path("docs/brand/IROA_BI_GUIDE_KO.pdf")
        with TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertTrue(_AUTHORITATIVE_SOFFICE.is_file())
            converted = _authoritative_docx_pdf_conversion(
                Path("docs/brand/IROA_BI_GUIDE_KO.docx").resolve(),
                root,
            )
            self.assertEqual(_pdf_info(converted)["Producer"], _AUTHORITATIVE_PDF_PRODUCER)
            _assert_guide_pdf_font_contract(self, _pdf_font_rows(converted))
            metrics = _assert_authoritative_distribution_pdf_binding(
                self,
                committed,
                converted,
                root / "authoritative-parity",
            )
            self.assertEqual(len(metrics), 15)
            self.assertTrue(all(metric["difference_bbox"] is None for metric in metrics))
            self.assertTrue(all(metric["nonzero_pixel_count"] == 0 for metric in metrics))

            altered = root / "graphics-only-page-8-app-icon-removed.pdf"
            _create_graphics_only_pdf_mutation(committed, altered)
            self.assertEqual(_pdf_info(altered)["Pages"], "15")
            self.assertEqual(_pdf_page_texts(altered), _pdf_page_texts(committed))
            self.assertEqual(_pdf_page_geometries(altered), _pdf_page_geometries(committed))

            committed_pages = _render_pdf_pages(committed, root / "mutation-proof-committed")
            altered_pages = _render_pdf_pages(altered, root / "mutation-proof-altered")
            metric = _pdf_raster_parity(committed_pages[7], altered_pages[7])
            self.assertLessEqual(metric["normalized_mae"], _PDF_COMPAT_MAX_NORMALIZED_MAE)
            self.assertLessEqual(
                metric["material_pixel_fraction"],
                _PDF_COMPAT_MAX_MATERIAL_PIXEL_FRACTION,
            )
            app_icon_region = (550, 880, 640, 950)
            with Image.open(committed_pages[7]).convert("RGB") as original_page:
                self.assertLess(min(value[0] for value in original_page.crop(app_icon_region).getextrema()), 100)
            with Image.open(altered_pages[7]).convert("RGB") as altered_page:
                self.assertEqual(altered_page.crop(app_icon_region).getextrema(), ((255, 255),) * 3)

            compatibility_metrics = _assert_packaged_renderer_pdf_compatibility(
                self,
                committed,
                altered,
                root / "mutation-compatibility-gate",
            )
            self.assertIsNotNone(compatibility_metrics[7]["difference_bbox"])
            with self.assertRaises(AssertionError):
                _assert_authoritative_distribution_pdf_binding(
                    self,
                    altered,
                    converted,
                    root / "mutation-authoritative-gate",
                )

    def test_guide_packaged_renderer_stays_within_compatibility_tolerances(self):
        committed = Path("docs/brand/IROA_BI_GUIDE_KO.pdf")
        with TemporaryDirectory() as directory:
            root = Path(directory)
            render_output = root / "packaged-renderer"
            environment = os.environ.copy()
            environment["TMPDIR"] = "/private/tmp"
            environment["SAL_FONTPATH"] = str(Path("docs/brand/assets/fonts").resolve())
            result = subprocess.run(
                [
                    str(_WORKSPACE_PYTHON),
                    str(_PACKAGED_DOCX_RENDERER),
                    "docs/brand/IROA_BI_GUIDE_KO.docx",
                    "--output_dir",
                    str(render_output),
                    "--dpi",
                    str(_PDF_RENDER_DPI),
                    "--emit_pdf",
                ],
                capture_output=True,
                text=True,
                env=environment,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            rendered = render_output / "IROA_BI_GUIDE_KO.pdf"
            self.assertTrue(rendered.is_file(), result.stdout)
            metrics = _assert_packaged_renderer_pdf_compatibility(
                self,
                committed,
                rendered,
                root / "packaged-compatibility-parity",
            )
            self.assertEqual(len(metrics), 15)

    def test_guide_pdf_has_no_blank_or_nearly_empty_interior_page(self):
        path = Path("docs/brand/IROA_BI_GUIDE_KO.pdf")
        page_count = int(_pdf_info(path)["Pages"])
        for page_number in range(2, page_count + 1):
            result = subprocess.run(
                [
                    "pdftotext",
                    "-f",
                    str(page_number),
                    "-l",
                    str(page_number),
                    str(path),
                    "-",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            visible = re.sub(r"\s+", "", result.stdout)
            minimum = 140 if page_number == page_count else 250
            self.assertGreaterEqual(len(visible), minimum, (page_number, visible))

    def test_usage_overview_builder_is_deterministic_and_rgb(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            isolated_home = root / "empty-home"
            isolated_home.mkdir()
            environment = os.environ.copy()
            environment["HOME"] = str(isolated_home)
            outputs = (root / "first.png", root / "second.png")
            manifests = (root / "first.json", root / "second.json")
            for output, manifest in zip(outputs, manifests):
                result = subprocess.run(
                    [
                        sys.executable,
                        "tools/brand/build_usage_overview.py",
                        "--output",
                        str(output),
                        "--manifest",
                        str(manifest),
                    ],
                    capture_output=True,
                    text=True,
                    env=environment,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(outputs[0].read_bytes(), outputs[1].read_bytes())
            self.assertEqual(manifests[0].read_bytes(), manifests[1].read_bytes())
            self.assertEqual(
                outputs[0].read_bytes(),
                Path("docs/brand/examples/usage-overview.png").read_bytes(),
            )
            self.assertEqual(
                manifests[0].read_bytes(),
                Path("docs/brand/examples/usage-overview-manifest.json").read_bytes(),
            )
            with Image.open(outputs[0]) as image:
                self.assertEqual(image.size, (2560, 1600))
                self.assertEqual(image.mode, "RGB")

    def test_usage_overview_pins_basic_text_layout_engine(self):
        font_paths = _verified_font_paths(Path("docs/brand/assets/fonts"))
        face = _font(font_paths, 20)
        self.assertEqual(face.layout_engine, ImageFont.Layout.BASIC)

    def test_usage_overview_builder_fails_closed_for_pinned_font_drift(self):
        source_fonts = Path("docs/brand/assets/fonts")
        self.assertTrue(source_fonts.is_dir())
        with TemporaryDirectory() as directory:
            root = Path(directory)
            missing_fonts = root / "missing"
            missing_fonts.mkdir()
            missing = subprocess.run(
                [
                    sys.executable,
                    "tools/brand/build_usage_overview.py",
                    "--output",
                    str(root / "missing.png"),
                    "--manifest",
                    str(root / "missing.json"),
                    "--font-root",
                    str(missing_fonts),
                ],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(missing.returncode, 0)
            self.assertIn("pinned font missing", missing.stderr)

            tampered_fonts = root / "tampered"
            shutil.copytree(source_fonts, tampered_fonts)
            medium = tampered_fonts / "NotoSansKR-Medium.otf"
            medium.write_bytes(medium.read_bytes() + b"tampered")
            tampered = subprocess.run(
                [
                    sys.executable,
                    "tools/brand/build_usage_overview.py",
                    "--output",
                    str(root / "tampered.png"),
                    "--manifest",
                    str(root / "tampered.json"),
                    "--font-root",
                    str(tampered_fonts),
                ],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(tampered.returncode, 0)
            self.assertIn("pinned font hash mismatch", tampered.stderr)

    def test_usage_overview_manifest_pins_fonts_and_distribution_evidence(self):
        manifest = json.loads(
            Path("docs/brand/examples/usage-overview-manifest.json").read_text(
                encoding="utf-8"
            )
        )
        expected_paths = {
            "assets/fonts/NotoSansKR-Medium.otf",
            "assets/fonts/NotoSansKR-Bold.otf",
        }
        self.assertEqual({entry["path"] for entry in manifest["fonts"]}, expected_paths)
        for entry in manifest["fonts"]:
            path = Path("docs/brand") / entry["path"]
            self.assertTrue(path.is_file(), path)
            self.assertEqual(entry["sha256"], _digest(path))

        font_root = Path("docs/brand/assets/fonts")
        license_path = font_root / "LICENSE.txt"
        source_path = font_root / "SOURCE.md"
        self.assertTrue(license_path.is_file())
        self.assertTrue(source_path.is_file())
        self.assertIn(
            "SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007",
            license_path.read_text(encoding="utf-8"),
        )
        source = source_path.read_text(encoding="utf-8")
        self.assertIn("https://github.com/notofonts/noto-cjk", source)
        self.assertRegex(source, r"\b[0-9a-f]{40}\b")
        for entry in manifest["fonts"]:
            self.assertIn(Path(entry["path"]).name, source)
            self.assertIn(entry["sha256"], source)

    def test_usage_overview_builder_uses_official_assets_in_each_scene(self):
        with TemporaryDirectory() as directory:
            output = Path(directory) / "overview.png"
            manifest_path = Path(directory) / "overview.json"
            result = subprocess.run(
                [
                    sys.executable,
                    "tools/brand/build_usage_overview.py",
                    "--output",
                    str(output),
                    "--manifest",
                    str(manifest_path),
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            expected_scenes = {
                "web": ([96, 292, 1256, 808], [
                    "exports/digital/iroa-wordmark-64.png",
                    "exports/digital/iroa-symbol-128.png",
                ]),
                "app": ([1300, 292, 1808, 808], ["exports/icons/app-icon-192.png"]),
                "watch": ([1852, 292, 2464, 808], ["exports/icons/symbol-watch-48.png"]),
                "kiosk": ([96, 854, 1112, 1504], ["exports/icons/symbol-kiosk-1024.png"]),
                "document": ([1156, 854, 1828, 1504], ["masters/lockup/iroa-lockup-color.svg"]),
            }
            self.assertEqual(set(manifest["scenes"]), set(expected_scenes))
            for name, (bounds, assets) in expected_scenes.items():
                self.assertEqual(manifest["scenes"][name]["bounds"], bounds)
                self.assertEqual(manifest["scenes"][name]["assets"], assets)
            for dependency in manifest["assets"]:
                self.assertTrue(dependency.startswith(("masters/", "exports/")), dependency)
                self.assertNotIn("track-b", dependency.lower())
                self.assertTrue((Path("docs/brand") / dependency).is_file(), dependency)
            with Image.open(output).convert("RGB") as image:
                for scene in manifest["scenes"].values():
                    self.assertTrue(scene["assets"], scene)
                    self.assertIsNotNone(image.crop(scene["bounds"]).getbbox(), scene)

    def test_usage_overview_text_contrast_and_app_status_bounds(self):
        with TemporaryDirectory() as directory:
            output = Path(directory) / "overview.png"
            manifest_path = Path(directory) / "overview.json"
            result = subprocess.run(
                [
                    sys.executable,
                    "tools/brand/build_usage_overview.py",
                    "--output",
                    str(output),
                    "--manifest",
                    str(manifest_path),
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            phone = manifest["scenes"]["app"]["phone_bounds"]
            status = next(run for run in manifest["text_runs"] if run["context"] == "app.status")
            self.assertGreaterEqual(status["bounds"][0], phone[0])
            self.assertGreaterEqual(status["bounds"][1], phone[1])
            self.assertLessEqual(status["bounds"][2], phone[2])
            self.assertLessEqual(status["bounds"][3], phone[3])
            for run in manifest["text_runs"]:
                recomputed = contrast_ratio(run["foreground"], run["background"])
                self.assertAlmostEqual(run["ratio"], recomputed, places=2, msg=run)
                self.assertGreaterEqual(recomputed, run["minimum"], run)

    def test_required_png_sizes_are_exact(self):
        self.assertEqual(
            OFFICIAL_PNG_SIZES,
            (16, 24, 32, 48, 64, 128, 180, 192, 256, 512, 1024),
        )

    def test_legacy_paths_match_official_masters(self):
        pairs = (
            (
                Path("docs/brand/iroa-symbol.svg"),
                Path("docs/brand/masters/symbol/iroa-symbol-color.svg"),
            ),
            (
                Path("docs/brand/iroa-wordmark.svg"),
                Path("docs/brand/masters/wordmark/iroa-wordmark-color.svg"),
            ),
            (
                Path("docs/brand/iroa-wordmark-reverse.svg"),
                Path("docs/brand/masters/wordmark/iroa-wordmark-reverse.svg"),
            ),
            (
                Path("docs/brand/iroa-wordmark-mono.svg"),
                Path("docs/brand/masters/wordmark/iroa-wordmark-mono.svg"),
            ),
        )
        for legacy, official in pairs:
            self.assertEqual(legacy.read_bytes(), official.read_bytes())

    def test_wcag_reference_values(self):
        self.assertGreaterEqual(contrast_ratio("#16263D", "#FFFFFF"), 4.5)
        self.assertLess(contrast_ratio("#F06D5E", "#FFFFFF"), 4.5)

    def test_svg_requires_accessible_metadata(self):
        fixture = Path("tests/brand/fixtures/missing-metadata.svg")
        with self.assertRaisesRegex(ValueError, "title and desc"):
            audit_svg(fixture)

    def test_svg_requires_viewbox(self):
        fixture = Path("tests/brand/fixtures/missing-viewbox.svg")
        with self.assertRaisesRegex(ValueError, "viewBox"):
            audit_svg(fixture)

    def test_svg_rejects_embedded_image_element(self):
        fixture = Path("tests/brand/fixtures/embedded-image.svg")
        with self.assertRaisesRegex(ValueError, "must not embed raster images"):
            audit_svg(fixture)

    def test_svg_rejects_feimage_data_uri(self):
        fixture = Path("tests/brand/fixtures/feimage-data-uri.svg")
        with self.assertRaisesRegex(ValueError, "must not embed raster images"):
            audit_svg(fixture)

    def test_svg_rejects_foreignobject_html_image(self):
        fixture = Path("tests/brand/fixtures/foreignobject-html-image.svg")
        with self.assertRaisesRegex(ValueError, "must not embed raster images"):
            audit_svg(fixture)

    def test_svg_rejects_text_elements(self):
        source = """<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" role=\"img\" aria-labelledby=\"title desc\">
  <title id=\"title\">Text fixture</title><desc id=\"desc\">Must not pass as a vector master.</desc>
  <text x=\"1\" y=\"12\">IROA</text>
</svg>\n"""
        with TemporaryDirectory() as directory:
            fixture = Path(directory) / "text.svg"
            fixture.write_text(source, encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "must not contain text"):
                audit_svg(fixture)

    def test_candidate_paths_use_canonical_filenames(self):
        candidates = CandidatePaths(Path("out/candidate"))
        self.assertEqual(candidates.symbol, Path("out/candidate/symbol.svg"))
        self.assertEqual(candidates.wordmark, Path("out/candidate/wordmark.svg"))
        self.assertEqual(
            candidates.wordmark_reverse,
            Path("out/candidate/wordmark-reverse.svg"),
        )
        self.assertEqual(
            candidates.wordmark_mono,
            Path("out/candidate/wordmark-mono.svg"),
        )

    def test_track_a_candidate_contract(self):
        paths = CandidatePaths(Path("docs/brand/candidates/track-a"))
        for path in (
            paths.symbol,
            paths.wordmark,
            paths.wordmark_reverse,
            paths.wordmark_mono,
        ):
            self.assertTrue(path.is_file(), path)
            audit_svg(path)

    def test_track_b_candidate_contract_and_independence(self):
        track_a = CandidatePaths(Path("docs/brand/candidates/track-a"))
        track_b = CandidatePaths(Path("docs/brand/candidates/track-b"))
        for path in (
            track_b.symbol,
            track_b.root / "symbol-reverse.svg",
            track_b.root / "symbol-mono.svg",
            track_b.wordmark,
            track_b.wordmark_reverse,
            track_b.wordmark_mono,
        ):
            self.assertTrue(path.is_file(), path)
            audit_svg(path)
        self.assertNotEqual(_digest(track_a.symbol), _digest(track_b.symbol))
        self.assertNotEqual(_digest(track_a.wordmark), _digest(track_b.wordmark))

    def test_track_b_masters_are_path_only(self):
        root = Path("docs/brand/candidates/track-b")
        allowed = {"svg", "title", "desc", "g", "path"}
        for path in sorted(root.glob("*.svg")):
            tags = {_local_tag(element.tag) for element in ET.parse(path).iter()}
            self.assertLessEqual(tags, allowed, (path, tags - allowed))

    def test_track_b_color_variants_share_exact_geometry(self):
        root = Path("docs/brand/candidates/track-b")
        families = (
            ("symbol.svg", "symbol-mono.svg", "symbol-reverse.svg"),
            ("wordmark.svg", "wordmark-mono.svg", "wordmark-reverse.svg"),
        )
        for names in families:
            paths = tuple(root / name for name in names)
            for path in paths:
                self.assertTrue(path.is_file(), path)
            signatures = {_geometry_signature(path) for path in paths}
            self.assertEqual(len(signatures), 1, paths)

    def test_track_b_palette_excludes_legacy_colors(self):
        neutral = {"#000000", "#111111", "#FFFFFF"}
        legacy_paths = tuple(Path("docs/brand/candidates/track-a").glob("*.svg"))
        legacy_paths += tuple(Path("docs/brand").glob("iroa-*.svg"))
        legacy_colors = set().union(*(_svg_colors(path) for path in legacy_paths))
        track_b_colors = set().union(
            *(
                _svg_colors(Path("docs/brand/candidates/track-b") / name)
                for name in ("symbol.svg", "wordmark.svg")
            )
        )
        chromatic_track_b = track_b_colors - neutral
        self.assertTrue(chromatic_track_b)
        self.assertTrue(
            chromatic_track_b.isdisjoint(legacy_colors - neutral),
            chromatic_track_b & legacy_colors,
        )

    def test_track_b_rendered_geometry_is_materially_independent(self):
        track_a = CandidatePaths(Path("docs/brand/candidates/track-a"))
        track_b = CandidatePaths(Path("docs/brand/candidates/track-b"))
        track_a_symbol = _render_normalized(track_a.symbol, 96, 96)
        track_b_symbol = _render_normalized(track_b.symbol, 96, 96)
        track_a_wordmark = _render_normalized(track_a.wordmark_mono, 436, 96)
        track_b_wordmark = _render_normalized(track_b.wordmark_mono, 436, 96)

        symbol_iou = _alpha_iou(track_a_symbol, track_b_symbol)
        wordmark_iou = _alpha_iou(track_a_wordmark, track_b_wordmark)
        self.assertLess(symbol_iou, 0.40, symbol_iou)
        self.assertLess(wordmark_iou, 0.18, wordmark_iou)
        self.assertNotEqual(
            len(_ink_components(track_a_symbol)),
            len(_ink_components(track_b_symbol)),
        )
        self.assertNotEqual(
            len(_ink_components(track_a_wordmark)),
            len(_ink_components(track_b_wordmark)),
        )

    def test_track_b_wordmark_integrates_i_and_has_even_native_spacing(self):
        source = Path("docs/brand/candidates/track-b/wordmark-mono.svg")
        aspect_ratio = _svg_aspect_ratio(source)
        reference = _render_rgba(source, round(96 * aspect_ratio), 96)
        self.assertEqual(len(_ink_components(reference)), 7)

        for height in (16, 24, 32, 64):
            image = _render_rgba(source, round(height * aspect_ratio), height)
            runs = _horizontal_ink_runs(image)
            self.assertEqual(len(runs), 7, (height, runs))
            gaps = [
                right[0] - left[1] - 1
                for left, right in zip(runs, runs[1:])
            ]
            self.assertGreaterEqual(min(gaps), 1, (height, gaps))
            self.assertLessEqual(max(gaps), min(gaps) * 2 + 1, (height, gaps))

    def test_track_b_review_proofs_cover_all_variants(self):
        root = Path("docs/brand/candidates/track-b")
        for stem in (
            "symbol",
            "symbol-mono",
            "symbol-reverse",
            "wordmark",
            "wordmark-mono",
            "wordmark-reverse",
        ):
            source = root / f"{stem}.svg"
            self.assertTrue(source.is_file(), source)
            aspect_ratio = _svg_aspect_ratio(source)
            for height in (16, 24, 32, 64):
                proof = root / "renders" / f"{stem}-{height}.png"
                self.assertTrue(proof.is_file(), proof)
                audit_png(proof, round(height * aspect_ratio), height)

    def test_track_b_masters_render_deterministically(self):
        root = Path("docs/brand/candidates/track-b")
        for source in sorted(root.glob("*.svg")):
            aspect_ratio = _svg_aspect_ratio(source)
            width = round(32 * aspect_ratio)
            first = _render_rgba(source, width, 32)
            second = _render_rgba(source, width, 32)
            self.assertEqual(first.tobytes(), second.tobytes(), source)

    def test_track_a_mono_o_renders_with_a_distinct_action_point(self):
        source = Path("docs/brand/candidates/track-a/wordmark-mono.svg")
        with TemporaryDirectory() as directory:
            destination = Path(directory) / "wordmark-mono-64.png"
            render_svg_png(source, destination, 213, 64)
            with Image.open(destination).convert("RGBA") as image:
                alpha = image.getchannel("A")
                ink_rows = [
                    y for y in range(12, 55) if alpha.getpixel((93, y)) >= 128
                ]

            runs = []
            run_start = previous = ink_rows[0]
            for y in ink_rows[1:]:
                if y != previous + 1:
                    runs.append((run_start, previous))
                    run_start = y
                previous = y
            runs.append((run_start, previous))

            self.assertEqual(len(runs), 3, runs)
            open_gaps = [
                right[0] - left[1] - 1 for left, right in zip(runs, runs[1:])
            ]
            self.assertTrue(all(1 <= gap <= 4 for gap in open_gaps), open_gaps)

    def test_audit_png_requires_exact_rgba_size_with_transparency(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "opaque.png"
            Image.new("RGBA", (32, 32), "#16263D").save(path)
            with self.assertRaisesRegex(ValueError, "transparent pixel"):
                audit_png(path, 32, 32)
            audit_png(path, 32, 32, alpha_policy="opaque")

            transparent = Path(directory) / "transparent.png"
            Image.new("RGBA", (32, 32), (22, 38, 61, 0)).save(transparent)
            with self.assertRaisesRegex(ValueError, "fully opaque"):
                audit_png(transparent, 32, 32, alpha_policy="opaque")

    def test_render_svg_png_creates_auditable_rgba_png(self):
        source = Path("tests/brand/fixtures/accessible-symbol.svg")
        with TemporaryDirectory() as directory:
            destination = Path(directory) / "symbol.png"
            render_svg_png(source, destination, 32, 24)
            audit_png(destination, 32, 24)

    def test_render_svg_png_matches_direct_target_resolution_svg_rendering(self):
        source = Path("docs/brand/candidates/track-a/symbol.svg")
        with TemporaryDirectory() as directory:
            target = Path(directory) / "target.png"
            direct = Path(directory) / "direct.png"
            render_svg_png(source, target, 1024, 1024)
            subprocess.run(
                ["sips", "-s", "format", "png", "-z", "1024", "1024", str(source), "--out", str(direct)],
                check=True,
                capture_output=True,
                text=True,
            )
            with Image.open(target).convert("RGBA") as rendered, Image.open(direct).convert("RGBA") as expected:
                self.assertEqual(rendered.tobytes(), expected.tobytes())

    def test_candidate_cli_renders_each_variant_at_review_sizes(self):
        square_source = Path("tests/brand/fixtures/accessible-symbol.svg")
        wide_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 20" role="img" aria-labelledby="title desc">
  <title id="title">Wide test mark</title>
  <desc id="desc">Three-to-one test artwork for candidate preview rendering.</desc>
  <path d="M4 10H56" fill="none" stroke="#16263D" stroke-width="4" stroke-linecap="round"/>
</svg>
"""
        with TemporaryDirectory() as directory:
            candidate = Path(directory) / "candidate"
            candidate.mkdir()
            shutil.copyfile(square_source, candidate / "symbol.svg")
            for name in (
                "wordmark.svg",
                "wordmark-reverse.svg",
                "wordmark-mono.svg",
            ):
                (candidate / name).write_text(wide_svg, encoding="utf-8")

            subprocess.run(
                [
                    sys.executable,
                    "tools/brand/render_assets.py",
                    "candidate",
                    str(candidate),
                ],
                check=True,
                capture_output=True,
                text=True,
            )

            expected_dimensions = {
                "symbol": ((16, 16), (24, 24), (32, 32), (64, 64)),
                "wordmark": ((48, 16), (72, 24), (96, 32), (192, 64)),
                "wordmark-reverse": (
                    (48, 16),
                    (72, 24),
                    (96, 32),
                    (192, 64),
                ),
                "wordmark-mono": (
                    (48, 16),
                    (72, 24),
                    (96, 32),
                    (192, 64),
                ),
            }
            for stem, dimensions in expected_dimensions.items():
                for size, expected in zip((16, 24, 32, 64), dimensions):
                    path = candidate / "renders" / f"{stem}-{size}.png"
                    self.assertTrue(path.is_file(), path)
                    with Image.open(path) as image:
                        self.assertEqual(image.size, expected, path)

    def test_promotion_rejects_a_winner_that_disagrees_with_selection(self):
        result = subprocess.run(
            [sys.executable, "tools/brand/promote_candidate.py", "--winner", "track-b"],
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("does not match selection", result.stderr)

    def test_official_audit_cli_checks_the_promoted_asset_set(self):
        result = subprocess.run(
            [sys.executable, "tools/brand/audit_assets.py", "official"],
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.stdout.strip(), "official asset audit passed")

    def test_official_color_masters_preserve_the_selected_track_a_geometry(self):
        pairs = (
            (
                Path("docs/brand/candidates/track-a/symbol.svg"),
                Path("docs/brand/masters/symbol/iroa-symbol-color.svg"),
            ),
            (
                Path("docs/brand/candidates/track-a/wordmark.svg"),
                Path("docs/brand/masters/wordmark/iroa-wordmark-color.svg"),
            ),
        )
        for selected, official in pairs:
            ratio = _svg_aspect_ratio(selected)
            width, height = round(1024 * ratio), 1024
            selected_render = _render_rgba(selected, width, height)
            official_render = _render_rgba(official, width, height)
            self.assertIsNone(ImageChops.difference(selected_render, official_render).getbbox(), official)

    def test_official_svg_masters_are_accessible_vector_only_artwork(self):
        root = Path("docs/brand/masters")
        expected = {
            "symbol": ("color", "mono", "reverse"),
            "wordmark": ("color", "mono", "reverse"),
            "lockup": ("color", "mono", "reverse"),
        }
        for family, variants in expected.items():
            for variant in variants:
                path = root / family / f"iroa-{family}-{variant}.svg"
                self.assertTrue(path.is_file(), path)
                audit_svg(path)
                tags = {_local_tag(element.tag) for element in ET.parse(path).iter()}
                self.assertLessEqual(tags, {"svg", "title", "desc", "g", "path"}, (path, tags))

    def test_official_audit_rejects_extraneous_managed_asset_in_a_temp_tree(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree("docs/brand", root / "docs/brand")
            (root / "docs/brand/exports/digital/track-b-leak.png").write_bytes(b"not an asset")
            with self.assertRaisesRegex(ValueError, "unexpected files"):
                audit_official_assets(root)

    def test_promotion_cleanup_removes_only_stale_managed_files(self):
        with TemporaryDirectory() as directory:
            managed = Path(directory) / "managed"
            outside = Path(directory) / "outside.txt"
            managed.mkdir()
            (managed / "keep.png").write_bytes(b"keep")
            (managed / "track-b-leak.png").write_bytes(b"stale")
            outside.write_bytes(b"preserve")
            _remove_unexpected_files(managed, frozenset({"keep.png"}))
            self.assertTrue((managed / "keep.png").is_file())
            self.assertFalse((managed / "track-b-leak.png").exists())
            self.assertEqual(outside.read_bytes(), b"preserve")

    def test_official_png_exports_have_exact_dimensions_alpha_and_safe_area(self):
        digital = Path("docs/brand/exports/digital")
        icons = Path("docs/brand/exports/icons")
        for size in OFFICIAL_PNG_SIZES:
            audit_png(digital / f"iroa-symbol-{size}.png", size, size)
            wordmark = digital / f"iroa-wordmark-{size}.png"
            audit_png(wordmark, round(size * 600 / 180), size)
        for size in (16, 32, 48):
            audit_png(icons / f"favicon-{size}.png", size, size)
        for size, name in (
            (180, "apple-touch-icon-180.png"),
            (192, "app-icon-192.png"),
            (512, "app-icon-512.png"),
            (192, "maskable-icon-192.png"),
            (512, "maskable-icon-512.png"),
        ):
            audit_png(icons / name, size, size, alpha_policy="opaque")
        for size, name in ((48, "symbol-watch-48.png"), (1024, "symbol-kiosk-1024.png")):
            audit_png(icons / name, size, size)
        audit_svg(icons / "favicon.svg")

    def test_platform_icons_have_opaque_brand_backgrounds_and_maskable_safe_zone(self):
        digital = Path("docs/brand/exports/digital")
        icons = Path("docs/brand/exports/icons")
        platform_files = (
            (180, "apple-touch-icon-180.png"),
            (192, "app-icon-192.png"),
            (512, "app-icon-512.png"),
            (192, "maskable-icon-192.png"),
            (512, "maskable-icon-512.png"),
        )
        for size, name in platform_files:
            path = icons / name
            with Image.open(path).convert("RGBA") as image:
                self.assertEqual(image.getchannel("A").getextrema(), (255, 255), path)
                self.assertEqual(image.getpixel((0, 0))[:3], _PLATFORM_ICON_BACKGROUND, path)
            generic = digital / f"iroa-symbol-{size}.png"
            self.assertNotEqual(path.read_bytes(), generic.read_bytes(), path)

        for size in (192, 512):
            app = icons / f"app-icon-{size}.png"
            maskable = icons / f"maskable-icon-{size}.png"
            self.assertNotEqual(app.read_bytes(), maskable.read_bytes())
            with Image.open(maskable).convert("RGBA") as image:
                center = (size - 1) / 2
                radius = size * 0.40 + 1
                foreground = [
                    (x, y)
                    for y in range(size)
                    for x in range(size)
                    if image.getpixel((x, y))[:3] != _PLATFORM_ICON_BACKGROUND
                ]
                self.assertTrue(foreground, maskable)
                self.assertTrue(
                    all((x - center) ** 2 + (y - center) ** 2 <= radius**2 for x, y in foreground),
                    maskable,
                )

        for path in (
            digital / "iroa-symbol-192.png",
            icons / "favicon-32.png",
            icons / "symbol-watch-48.png",
            icons / "symbol-kiosk-1024.png",
        ):
            with Image.open(path).convert("RGBA") as image:
                self.assertLess(image.getchannel("A").getextrema()[0], 255, path)

    def test_promotion_is_deterministic_and_compatibility_pngs_are_regenerated(self):
        command = [sys.executable, "tools/brand/promote_candidate.py", "--winner", "track-a"]
        subprocess.run(command, check=True, capture_output=True, text=True)
        outputs = sorted(
            path
            for path in Path("docs/brand").glob("**/*")
            if path.is_file() and ("masters" in path.parts or "exports" in path.parts or path.name.startswith("iroa-"))
        )
        before = {path: _digest(path) for path in outputs}
        subprocess.run(command, check=True, capture_output=True, text=True)
        self.assertEqual(before, {path: _digest(path) for path in outputs})
        audit_png(Path("docs/brand/iroa-symbol.png"), 512, 512)
        audit_png(Path("docs/brand/iroa-wordmark.png"), 1200, 360)

    def test_six_print_pdfs_are_fontless_vector_documents_that_render_cleanly(self):
        print_root = Path("docs/brand/exports/print")
        expected = {
            f"iroa-{role}-{variant}.pdf"
            for role in ("symbol", "wordmark", "lockup")
            for variant in ("color", "mono")
        }
        self.assertEqual({path.name for path in print_root.glob("*.pdf")}, expected)
        with TemporaryDirectory() as directory:
            rendered = Path(directory) / "page"
            for name in expected:
                path = print_root / name
                info = subprocess.run(["pdfinfo", str(path)], check=True, capture_output=True, text=True)
                self.assertIn("Pages:           1", info.stdout)
                fonts = subprocess.run(["pdffonts", str(path)], check=True, capture_output=True, text=True)
                self.assertNotIn("Type 3", fonts.stdout)
                self.assertEqual(len(fonts.stdout.splitlines()), 2, fonts.stdout)
                render = subprocess.run(
                    ["pdftocairo", "-png", "-singlefile", str(path), str(rendered)],
                    capture_output=True,
                    text=True,
                )
                self.assertEqual(render.returncode, 0, render.stderr)
                self.assertEqual(render.stderr, "", render.stderr)
                with Image.open(rendered.with_suffix(".png")) as image:
                    self.assertGreater(image.getbbox()[2], 0)

    def test_pdf_audit_rejects_blank_text_and_jpeg_backed_documents(self):
        def write_pdf(path: Path, content: bytes, resources: bytes = b"<< >>", jpeg: bool = False) -> None:
            objects = [
                b"<< /Type /Catalog /Pages 2 0 R >>",
                b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources " + resources + b" /Contents 4 0 R >>",
                b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
            ]
            if jpeg:
                objects.append(b"<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length 1 >>\nstream\n0\nendstream")
            payload = bytearray(b"%PDF-1.4\n")
            offsets = [0]
            for index, object_ in enumerate(objects, 1):
                offsets.append(len(payload)); payload.extend(f"{index} 0 obj\n".encode()); payload.extend(object_); payload.extend(b"\nendobj\n")
            xref = len(payload)
            payload.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
            payload.extend(b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:]))
            payload.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
            path.write_bytes(payload)

        with TemporaryDirectory() as directory:
            blank = Path(directory) / "blank.pdf"
            text = Path(directory) / "text.pdf"
            image = Path(directory) / "image.pdf"
            write_pdf(blank, b"\n")
            write_pdf(text, b"BT ET\n")
            write_pdf(image, b"q /Im1 Do Q\n", b"<< /XObject << /Im1 5 0 R >> >>", jpeg=True)
            for path in (blank, text, image):
                with self.assertRaises(ValueError):
                    _audit_pdf(path)

    def test_print_pdf_foreground_ink_is_centered_on_a4(self):
        with TemporaryDirectory() as directory:
            output = Path(directory) / "page"
            for path in sorted(Path("docs/brand/exports/print").glob("*.pdf")):
                subprocess.run(["pdftocairo", "-r", "150", "-png", "-singlefile", str(path), str(output)], check=True, capture_output=True, text=True)
                with Image.open(output.with_suffix(".png")).convert("RGB") as image:
                    ink = Image.eval(image.convert("L"), lambda channel: 255 if channel < 245 else 0)
                    bounds = ink.getbbox()
                    self.assertIsNotNone(bounds, path)
                    center_x = (bounds[0] + bounds[2]) / 2
                    center_y = (bounds[1] + bounds[3]) / 2
                    self.assertLessEqual(abs(center_x - image.width / 2), 3, (path, bounds))
                    self.assertLessEqual(abs(center_y - image.height / 2), 3, (path, bounds))


if __name__ == "__main__":
    unittest.main()
