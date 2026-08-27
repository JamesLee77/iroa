"""Promote the human-selected IROA candidate into deterministic brand masters."""

import argparse
import math
from pathlib import Path
import re
import shutil
from tempfile import TemporaryDirectory
import zlib
from xml.etree import ElementTree as ET

from PIL import Image

if __package__:
    from .brand_contract import (
        OFFICIAL_DIGITAL_FILES,
        OFFICIAL_ICON_FILES,
        OFFICIAL_MASTER_FILES,
        OFFICIAL_PNG_SIZES,
        OFFICIAL_PRINT_FILES,
    )
    from .render_assets import render_svg_png
else:
    from brand_contract import (
        OFFICIAL_DIGITAL_FILES,
        OFFICIAL_ICON_FILES,
        OFFICIAL_MASTER_FILES,
        OFFICIAL_PNG_SIZES,
        OFFICIAL_PRINT_FILES,
    )
    from render_assets import render_svg_png


ROOT = Path(__file__).resolve().parents[2]
SELECTION = ROOT / "docs/brand/candidates/SELECTION.md"
BRAND = ROOT / "docs/brand"
NAVY = "#16263D"
CORAL = "#F06D5E"
TEAL = "#3D8B83"
LIGHT_TEAL = "#83CDC4"
INK = "#19222E"
PDF_PAGE = (595.0, 842.0)
PLATFORM_ICON_BACKGROUND = (22, 38, 61, 255)


def _selection_winner() -> str:
    match = re.search(r"^\s*-\s*`?winner:?`?\s*:\s*`?([\w-]+)`?\s*$", SELECTION.read_text(encoding="utf-8"), re.M)
    if not match:
        raise ValueError("SELECTION.md must declare a winner")
    return match.group(1)


def _svg_circle_path(cx: str, cy: str, radius: str) -> str:
    return (
        f"M{float(cx) + float(radius):g} {cy} "
        f"A{radius} {radius} 0 1 0 {float(cx) - float(radius):g} {cy} "
        f"A{radius} {radius} 0 1 0 {float(cx) + float(radius):g} {cy} Z"
    )


def _rounded_rect_path(width: str, height: str, radius: str = "0") -> str:
    width_value, height_value, radius_value = float(width), float(height), float(radius)
    if radius_value == 0:
        return f"M0 0H{width_value:g}V{height_value:g}H0Z"
    return (
        f"M{radius_value:g} 0H{width_value - radius_value:g} "
        f"A{radius_value:g} {radius_value:g} 0 0 1 {width_value:g} {radius_value:g} "
        f"V{height_value - radius_value:g}A{radius_value:g} {radius_value:g} 0 0 1 {width_value - radius_value:g} {height_value:g} "
        f"H{radius_value:g}A{radius_value:g} {radius_value:g} 0 0 1 0 {height_value - radius_value:g} "
        f"V{radius_value:g}A{radius_value:g} {radius_value:g} 0 0 1 {radius_value:g} 0Z"
    )


def _path_only(content: str) -> str:
    def circle(match: re.Match[str]) -> str:
        attributes = dict(re.findall(r'([\w-]+)="([^"]*)"', match.group(1)))
        remainder = re.sub(r'\s+(?:cx|cy|r)="[^"]*"', "", match.group(1)).strip()
        return f'<path d="{_svg_circle_path(attributes["cx"], attributes["cy"], attributes["r"])}" {remainder}/>'

    def rect(match: re.Match[str]) -> str:
        attributes = dict(re.findall(r'([\w-]+)="([^"]*)"', match.group(1)))
        remainder = re.sub(r'\s+(?:width|height|rx)="[^"]*"', "", match.group(1)).strip()
        return f'<path d="{_rounded_rect_path(attributes["width"], attributes["height"], attributes.get("rx", "0"))}" {remainder}/>'

    content = re.sub(r"<circle\b([^>]*)/>", circle, content)
    return re.sub(r"<rect\b([^>]*)/>", rect, content)


def _recolor(source: Path, destination: Path, replacements: dict[str, str], background: str | None = None, description: str | None = None) -> None:
    content = source.read_text(encoding="utf-8")
    for old, new in replacements.items():
        content = content.replace(old, new)
    if background:
        viewbox = ET.parse(source).getroot().attrib["viewBox"].split()
        content = content.replace(
            "</desc>",
            f"</desc>\n  <path d=\"{_rounded_rect_path(viewbox[2], viewbox[3])}\" fill=\"{background}\"/>",
            1,
        )
    if description:
        content = re.sub(r"<desc[^>]*>.*?</desc>", f"<desc id=\"desc\">{description}</desc>", content, count=1, flags=re.S)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(_path_only(content), encoding="utf-8")


def _body(svg: Path, remove_context_background: bool = False) -> str:
    root = ET.parse(svg).getroot()
    pieces = []
    for child in root:
        tag = child.tag.rsplit("}", 1)[-1]
        if tag in {"title", "desc"}:
            continue
        if remove_context_background and tag == "path" and child.attrib.get("fill") == NAVY and "stroke" not in child.attrib:
            continue
        piece = ET.tostring(child, encoding="unicode")
        piece = re.sub(r'\s+xmlns:ns0="[^"]*"', "", piece).replace("ns0:", "")
        pieces.append(re.sub(r"[ \t]+(?=\n)", "", piece).strip())
    return "\n  ".join(pieces)


def _write_lockup(symbol: Path, wordmark: Path, destination: Path, variant: str) -> None:
    background = (
        f'\n  <path d="{_rounded_rect_path("760", "180", "24")}" fill="{NAVY}"/>'
        if variant == "reverse"
        else ""
    )
    contents = _body(symbol, remove_context_background=variant == "reverse")
    lettering = _body(wordmark, remove_context_background=variant == "reverse")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 180" role="img" aria-labelledby="title desc" shape-rendering="geometricPrecision">
  <title id="title">IROA horizontal {variant} lockup</title>
  <desc id="desc">The unchanged selected open-loop symbol and iroa.ai wordmark, separated by one 24-unit symbol-stroke clear space.</desc>{background}
  <g transform="translate(0 10)">{contents}</g>
  <g transform="translate(160 0)">{lettering}</g>
</svg>
''',
        encoding="utf-8",
    )


def _aspect_ratio(path: Path) -> float:
    values = ET.parse(path).getroot().attrib["viewBox"].replace(",", " ").split()
    return float(values[2]) / float(values[3])


def _remove_unexpected_files(directory: Path, expected: frozenset[str]) -> None:
    """Remove stale managed files only below one official output directory."""
    if not directory.exists():
        return
    for path in sorted((path for path in directory.rglob("*") if path.is_file()), reverse=True):
        if path.relative_to(directory).as_posix() not in expected:
            path.unlink()
    for path in sorted((path for path in directory.rglob("*") if path.is_dir()), reverse=True):
        if not any(path.iterdir()):
            path.rmdir()


def _render_platform_icon(source: Path, destination: Path, size: int, artwork_scale: float) -> None:
    """Render reverse artwork over a full-bleed official navy platform canvas."""
    artwork_size = round(size * artwork_scale)
    with TemporaryDirectory() as directory:
        artwork_path = Path(directory) / "artwork.png"
        render_svg_png(source, artwork_path, artwork_size, artwork_size)
        with Image.open(artwork_path).convert("RGBA") as artwork:
            canvas = Image.new("RGBA", (size, size), PLATFORM_ICON_BACKGROUND)
            offset = ((size - artwork_size) // 2, (size - artwork_size) // 2)
            canvas.alpha_composite(artwork, offset)
            destination.parent.mkdir(parents=True, exist_ok=True)
            canvas.save(destination, format="PNG", optimize=True)


def _render_exports(symbol: Path, wordmark: Path, reverse_symbol: Path) -> None:
    digital = BRAND / "exports/digital"
    icons = BRAND / "exports/icons"
    digital.mkdir(parents=True, exist_ok=True)
    icons.mkdir(parents=True, exist_ok=True)
    for size in OFFICIAL_PNG_SIZES:
        render_svg_png(symbol, digital / f"iroa-symbol-{size}.png", size, size)
        render_svg_png(
            wordmark,
            digital / f"iroa-wordmark-{size}.png",
            round(size * _aspect_ratio(wordmark)),
            size,
        )
    shutil.copyfile(symbol, icons / "favicon.svg")
    for size in (16, 32, 48):
        render_svg_png(symbol, icons / f"favicon-{size}.png", size, size)
    _render_platform_icon(reverse_symbol, icons / "apple-touch-icon-180.png", 180, .78)
    for size in (192, 512):
        _render_platform_icon(reverse_symbol, icons / f"app-icon-{size}.png", size, .78)
    for size in (192, 512):
        _render_platform_icon(reverse_symbol, icons / f"maskable-icon-{size}.png", size, .68)
    render_svg_png(symbol, icons / "symbol-watch-48.png", 48, 48)
    render_svg_png(symbol, icons / "symbol-kiosk-1024.png", 1024, 1024)
    render_svg_png(symbol, BRAND / "iroa-symbol.png", 512, 512)
    render_svg_png(wordmark, BRAND / "iroa-wordmark.png", 1200, 360)


def _matrix(transform: str | None) -> tuple[float, float, float, float, float, float]:
    matrix = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
    for command, values in re.findall(r"(translate|scale)\(([^)]*)\)", transform or ""):
        numbers = [float(value) for value in re.findall(r"[-+]?\d*\.?\d+", values)]
        if command == "translate":
            part = (1.0, 0.0, 0.0, 1.0, numbers[0], numbers[1] if len(numbers) > 1 else 0.0)
        else:
            part = (numbers[0], 0.0, 0.0, numbers[1] if len(numbers) > 1 else numbers[0], 0.0, 0.0)
        a, b, c, d, e, f = matrix
        g, h, i, j, k, l = part
        matrix = (a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f)
    return matrix


def _compose(left: tuple[float, float, float, float, float, float], right: tuple[float, float, float, float, float, float]) -> tuple[float, float, float, float, float, float]:
    a, b, c, d, e, f = left
    g, h, i, j, k, l = right
    return (a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f)


def _point(matrix: tuple[float, float, float, float, float, float], x: float, y: float) -> tuple[float, float]:
    a, b, c, d, e, f = matrix
    return a * x + c * y + e, b * x + d * y + f


def _arc_segments(x1: float, y1: float, rx: float, ry: float, rotation: float, large: int, sweep: int, x2: float, y2: float) -> list[tuple[tuple[float, float], tuple[float, float], tuple[float, float]]]:
    """Return cubic Bezier pieces for an SVG endpoint arc."""
    if not rx or not ry or (x1 == x2 and y1 == y2):
        return [((x1, y1), (x2, y2), (x2, y2))]
    angle = math.radians(rotation % 360)
    cos_a, sin_a = math.cos(angle), math.sin(angle)
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    xp, yp = cos_a * dx + sin_a * dy, -sin_a * dx + cos_a * dy
    rx, ry = abs(rx), abs(ry)
    scale = xp * xp / (rx * rx) + yp * yp / (ry * ry)
    if scale > 1:
        rx *= math.sqrt(scale)
        ry *= math.sqrt(scale)
    sign = -1 if large == sweep else 1
    numerator = max(0.0, rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp)
    denominator = rx * rx * yp * yp + ry * ry * xp * xp
    factor = sign * math.sqrt(numerator / denominator) if denominator else 0.0
    cxp, cyp = factor * rx * yp / ry, factor * -ry * xp / rx
    cx = cos_a * cxp - sin_a * cyp + (x1 + x2) / 2
    cy = sin_a * cxp + cos_a * cyp + (y1 + y2) / 2
    def theta(u: tuple[float, float], v: tuple[float, float]) -> float:
        cross = u[0] * v[1] - u[1] * v[0]
        return math.atan2(cross, u[0] * v[0] + u[1] * v[1])
    start = theta((1, 0), ((xp - cxp) / rx, (yp - cyp) / ry))
    delta = theta(((xp - cxp) / rx, (yp - cyp) / ry), ((-xp - cxp) / rx, (-yp - cyp) / ry))
    if not sweep and delta > 0:
        delta -= 2 * math.pi
    if sweep and delta < 0:
        delta += 2 * math.pi
    pieces = max(1, math.ceil(abs(delta) / (math.pi / 2)))
    delta /= pieces
    result = []
    for index in range(pieces):
        begin = start + index * delta
        end = begin + delta
        alpha = 4 / 3 * math.tan((end - begin) / 4)
        p1 = (math.cos(begin), math.sin(begin))
        p2 = (math.cos(end), math.sin(end))
        c1 = (p1[0] - alpha * p1[1], p1[1] + alpha * p1[0])
        c2 = (p2[0] + alpha * p2[1], p2[1] - alpha * p2[0])
        def unrotate(point: tuple[float, float]) -> tuple[float, float]:
            return (cx + rx * (cos_a * point[0] - sin_a * point[1]), cy + ry * (sin_a * point[0] + cos_a * point[1]))
        result.append((unrotate(c1), unrotate(c2), unrotate(p2)))
    return result


_TOKENS = re.compile(r"[AaCcHhLlMmVvZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")


def _path_commands(data: str, matrix: tuple[float, float, float, float, float, float], page_scale: float, page_height: float, offset_x: float, offset_y: float) -> list[str]:
    tokens = _TOKENS.findall(data)
    position = 0
    command = ""
    current = (0.0, 0.0)
    start = current
    output: list[str] = []
    def number() -> float:
        nonlocal position
        value = float(tokens[position]); position += 1; return value
    def emit(point: tuple[float, float]) -> str:
        x, y = _point(matrix, *point)
        return f"{offset_x + x * page_scale:.5f} {page_height - offset_y - y * page_scale:.5f}"
    while position < len(tokens):
        if tokens[position].isalpha():
            command = tokens[position]; position += 1
        if command == "M":
            current = (number(), number()); start = current; output.append(f"{emit(current)} m"); command = "L"
        elif command == "L":
            current = (number(), number()); output.append(f"{emit(current)} l")
        elif command == "H":
            current = (number(), current[1]); output.append(f"{emit(current)} l")
        elif command == "V":
            current = (current[0], number()); output.append(f"{emit(current)} l")
        elif command == "C":
            first, second, current = (number(), number()), (number(), number()), (number(), number())
            output.append(f"{emit(first)} {emit(second)} {emit(current)} c")
        elif command == "A":
            rx, ry, rotation = number(), number(), number()
            large, sweep = int(number()), int(number())
            target = (number(), number())
            for first, second, end in _arc_segments(*current, rx, ry, rotation, large, sweep, *target):
                output.append(f"{emit(first)} {emit(second)} {emit(end)} c")
            current = target
        elif command in {"Z", "z"}:
            output.append("h"); current = start; command = ""
        else:
            raise ValueError(f"unsupported SVG path command {command!r}")
    return output


def _circle_path(cx: float, cy: float, radius: float) -> str:
    k = radius * 0.552284749831
    return (f"M{cx + radius} {cy} C{cx + radius} {cy + k} {cx + k} {cy + radius} {cx} {cy + radius} "
            f"C{cx - k} {cy + radius} {cx - radius} {cy + k} {cx - radius} {cy} "
            f"C{cx - radius} {cy - k} {cx - k} {cy - radius} {cx} {cy - radius} "
            f"C{cx + k} {cy - radius} {cx + radius} {cy - k} {cx + radius} {cy} Z")


def _svg_ink_bounds(svg: Path, raw_width: float, raw_height: float) -> tuple[float, float, float, float]:
    supersample = 8
    with TemporaryDirectory() as directory:
        rendered = Path(directory) / "ink.png"
        render_svg_png(svg, rendered, round(raw_width * supersample), round(raw_height * supersample))
        with Image.open(rendered).convert("RGBA") as image:
            alpha = image.getchannel("A").point(lambda value: 255 if value else 0)
            bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError(f"{svg} contains no visible artwork")
    return tuple(value / supersample for value in bounds)


def _pdf_drawing(svg: Path) -> bytes:
    root = ET.parse(svg).getroot()
    _, _, raw_width, raw_height = (float(value) for value in root.attrib["viewBox"].split())
    width, height = PDF_PAGE
    margin = 72.0
    scale = min((width - 2 * margin) / raw_width, (height - 2 * margin) / raw_height)
    left, top, right, bottom = _svg_ink_bounds(svg, raw_width, raw_height)
    offset_x = width / 2 - (left + right) * scale / 2
    offset_y = height / 2 - (top + bottom) * scale / 2
    commands: list[str] = []
    def color(value: str) -> str:
        value = value.lstrip("#")
        return " ".join(f"{int(value[index:index + 2], 16) / 255:.5f}" for index in (0, 2, 4))
    def visit(element: ET.Element, inherited: dict[str, str], matrix: tuple[float, float, float, float, float, float]) -> None:
        tag = element.tag.rsplit("}", 1)[-1]
        style = dict(inherited); style.update(element.attrib)
        matrix = _compose(matrix, _matrix(element.attrib.get("transform")))
        if tag in {"svg", "g", "title", "desc"}:
            for child in element:
                visit(child, style, matrix)
            return
        if tag == "circle":
            data = _circle_path(float(element.attrib["cx"]), float(element.attrib["cy"]), float(element.attrib["r"]))
        elif tag == "path":
            data = element.attrib["d"]
        else:
            return
        fill = style.get("fill", "#000000")
        stroke = style.get("stroke", "none")
        if fill != "none": commands.append(f"{color(fill)} rg")
        if stroke != "none":
            commands.extend((f"{color(stroke)} RG", f"{float(style.get('stroke-width', '1')) * abs(matrix[0]) * scale:.5f} w"))
            if style.get("stroke-linecap") == "round": commands.append("1 J")
            if style.get("stroke-linejoin") == "round": commands.append("1 j")
        commands.extend(_path_commands(data, matrix, scale, height, offset_x, offset_y))
        commands.append("B" if fill != "none" and stroke != "none" else "f" if fill != "none" else "S")
    visit(root, {}, (1.0, 0.0, 0.0, 1.0, 0.0, 0.0))
    return ("\n".join(commands) + "\n").encode("ascii")


def _write_pdf(source: Path, destination: Path) -> None:
    content = _pdf_drawing(source)
    compressed = zlib.compress(content, level=9)
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(compressed)).encode() + b" /Filter /FlateDecode >>\nstream\n" + compressed + b"\nendstream",
    ]
    payload = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for index, object_ in enumerate(objects, 1):
        offsets.append(len(payload)); payload.extend(f"{index} 0 obj\n".encode()); payload.extend(object_); payload.extend(b"\nendobj\n")
    xref = len(payload)
    payload.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    payload.extend(b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:]))
    payload.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)


def _write_print_exports(masters: Path) -> None:
    print_root = BRAND / "exports/print"
    for role in ("symbol", "wordmark", "lockup"):
        for variant in ("color", "mono"):
            output = print_root / f"iroa-{role}-{variant}.pdf"
            _write_pdf(masters / role / f"iroa-{role}-{variant}.svg", output)


def promote(winner: str) -> None:
    if winner not in {"track-a", "track-b"}:
        raise ValueError("winner must be track-a or track-b")
    selected = _selection_winner()
    if winner != selected:
        raise ValueError(f"winner {winner!r} does not match selection {selected!r}")
    if winner != "track-a":
        raise ValueError("official IROA BI v1 promotion is restricted to track-a")
    candidate = BRAND / "candidates" / winner
    masters = BRAND / "masters"
    symbol = masters / "symbol"
    wordmark = masters / "wordmark"
    _remove_unexpected_files(masters, OFFICIAL_MASTER_FILES)
    _remove_unexpected_files(BRAND / "exports/digital", OFFICIAL_DIGITAL_FILES)
    _remove_unexpected_files(BRAND / "exports/icons", OFFICIAL_ICON_FILES)
    _remove_unexpected_files(BRAND / "exports/print", OFFICIAL_PRINT_FILES)
    symbol.mkdir(parents=True, exist_ok=True)
    wordmark.mkdir(parents=True, exist_ok=True)
    _recolor(candidate / "symbol.svg", symbol / "iroa-symbol-color.svg", {})
    _recolor(candidate / "symbol.svg", symbol / "iroa-symbol-mono.svg", {NAVY: INK, CORAL: INK, TEAL: INK}, description="A single-ink open loop with one action point centered in its opening.")
    _recolor(candidate / "symbol.svg", symbol / "iroa-symbol-reverse.svg", {NAVY: "#FFFFFF", TEAL: LIGHT_TEAL}, NAVY, description="A reverse open loop with one coral action point centered in its opening.")
    _recolor(candidate / "wordmark.svg", wordmark / "iroa-wordmark-color.svg", {})
    _recolor(candidate / "wordmark-mono.svg", wordmark / "iroa-wordmark-mono.svg", {})
    _recolor(candidate / "wordmark-reverse.svg", wordmark / "iroa-wordmark-reverse.svg", {})
    for variant in ("color", "mono", "reverse"):
        _write_lockup(symbol / f"iroa-symbol-{variant}.svg", wordmark / f"iroa-wordmark-{variant}.svg", masters / "lockup" / f"iroa-lockup-{variant}.svg", variant)
    shutil.copyfile(symbol / "iroa-symbol-color.svg", BRAND / "iroa-symbol.svg")
    shutil.copyfile(wordmark / "iroa-wordmark-color.svg", BRAND / "iroa-wordmark.svg")
    shutil.copyfile(wordmark / "iroa-wordmark-mono.svg", BRAND / "iroa-wordmark-mono.svg")
    shutil.copyfile(wordmark / "iroa-wordmark-reverse.svg", BRAND / "iroa-wordmark-reverse.svg")
    _render_exports(
        symbol / "iroa-symbol-color.svg",
        wordmark / "iroa-wordmark-color.svg",
        symbol / "iroa-symbol-reverse.svg",
    )
    _write_print_exports(masters)


def main() -> None:
    parser = argparse.ArgumentParser(description="Promote selected IROA BI candidate")
    parser.add_argument("--winner", required=True)
    arguments = parser.parse_args()
    try:
        promote(arguments.winner)
    except ValueError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
