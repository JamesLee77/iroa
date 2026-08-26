import argparse
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
from xml.etree import ElementTree as ET

from PIL import Image

if __package__:
    from .brand_contract import OFFICIAL_PNG_SIZES
else:
    from brand_contract import OFFICIAL_PNG_SIZES


_RASTER_ELEMENT_NAMES = frozenset({"feimage", "foreignobject", "image", "img"})
_TEXT_ELEMENT_NAMES = frozenset({"text", "tspan", "textpath"})
_RASTER_FILE_SUFFIXES = (
    ".avif",
    ".bmp",
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    ".png",
    ".tif",
    ".tiff",
    ".webp",
)


def _linear(channel: int) -> float:
    value = channel / 255
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def _luminance(hex_color: str) -> float:
    raw = hex_color.lstrip("#")
    channels = [int(raw[index:index + 2], 16) for index in (0, 2, 4)]
    red, green, blue = (_linear(channel) for channel in channels)
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def contrast_ratio(foreground: str, background: str) -> float:
    lighter, darker = sorted(
        (_luminance(foreground), _luminance(background)), reverse=True
    )
    return (lighter + 0.05) / (darker + 0.05)


def _local_name(name: str) -> str:
    return name.rsplit("}", 1)[-1].lower()


def _contains_raster_reference(value: str) -> bool:
    reference = value.lower()
    return "data:image/" in reference or any(
        suffix in reference for suffix in _RASTER_FILE_SUFFIXES
    )


def audit_svg(path: Path) -> None:
    root = ET.parse(path).getroot()
    names = {_local_name(element.tag) for element in root}
    if not {"title", "desc"}.issubset(names):
        raise ValueError(f"{path} must include title and desc")
    if not root.attrib.get("viewBox"):
        raise ValueError(f"{path} must include viewBox")
    for element in root.iter():
        if _local_name(element.tag) in _TEXT_ELEMENT_NAMES:
            raise ValueError(f"{path} must not contain text elements")
        if _local_name(element.tag) in _RASTER_ELEMENT_NAMES:
            raise ValueError(f"{path} must not embed raster images")
        if any(_contains_raster_reference(value) for value in element.attrib.values()):
            raise ValueError(f"{path} must not embed raster images")
        if element.text and _contains_raster_reference(element.text):
            raise ValueError(f"{path} must not embed raster images")


def audit_png(path: Path, width: int, height: int) -> None:
    with Image.open(path) as image:
        if image.size != (width, height):
            raise ValueError(
                f"{path} must be {width}x{height}; found {image.width}x{image.height}"
            )
        if image.mode != "RGBA":
            raise ValueError(f"{path} must use RGBA mode; found {image.mode}")
        if image.getchannel("A").getextrema()[0] == 255:
            raise ValueError(f"{path} must include at least one transparent pixel")


def _audit_pdf(path: Path) -> None:
    info = subprocess.run(["pdfinfo", str(path)], check=True, capture_output=True, text=True)
    if "Pages:           1" not in info.stdout:
        raise ValueError(f"{path} must have exactly one page")
    fonts = subprocess.run(["pdffonts", str(path)], check=True, capture_output=True, text=True)
    if len(fonts.stdout.splitlines()) != 2 or "Type 3" in fonts.stdout:
        raise ValueError(f"{path} must not contain fonts or Type 3 resources")
    with TemporaryDirectory() as directory:
        destination = Path(directory) / "render"
        rendered = subprocess.run(
            ["pdftocairo", "-png", "-singlefile", str(path), str(destination)],
            capture_output=True,
            text=True,
        )
        if rendered.returncode or rendered.stderr:
            raise ValueError(f"{path} must render cleanly with Poppler: {rendered.stderr}")
        with Image.open(destination.with_suffix(".png")) as image:
            if image.getbbox() is None:
                raise ValueError(f"{path} rendered blank")


def audit_official_assets(root: Path) -> None:
    selection = (root / "docs/brand/candidates/SELECTION.md").read_text(encoding="utf-8")
    if "winner: track-a" not in selection:
        raise ValueError("official promotion requires SELECTION.md winner: track-a")
    brand = root / "docs/brand"
    masters = brand / "masters"
    for family in ("symbol", "wordmark", "lockup"):
        for variant in ("color", "mono", "reverse"):
            audit_svg(masters / family / f"iroa-{family}-{variant}.svg")
    for legacy, official in (
        (brand / "iroa-symbol.svg", masters / "symbol/iroa-symbol-color.svg"),
        (brand / "iroa-wordmark.svg", masters / "wordmark/iroa-wordmark-color.svg"),
        (brand / "iroa-wordmark-mono.svg", masters / "wordmark/iroa-wordmark-mono.svg"),
        (brand / "iroa-wordmark-reverse.svg", masters / "wordmark/iroa-wordmark-reverse.svg"),
    ):
        if legacy.read_bytes() != official.read_bytes():
            raise ValueError(f"{legacy} must be byte-identical to {official}")
    digital = brand / "exports/digital"
    icons = brand / "exports/icons"
    for size in OFFICIAL_PNG_SIZES:
        audit_png(digital / f"iroa-symbol-{size}.png", size, size)
        audit_png(digital / f"iroa-wordmark-{size}.png", round(size * 600 / 180), size)
    for size in (16, 32, 48):
        audit_png(icons / f"favicon-{size}.png", size, size)
    for size, name in ((180, "apple-touch-icon-180.png"), (192, "app-icon-192.png"), (512, "app-icon-512.png"), (192, "maskable-icon-192.png"), (512, "maskable-icon-512.png"), (48, "symbol-watch-48.png"), (1024, "symbol-kiosk-1024.png")):
        audit_png(icons / name, size, size)
    audit_svg(icons / "favicon.svg")
    for size in (192, 512):
        with Image.open(icons / f"maskable-icon-{size}.png").convert("RGBA") as image:
            bounds = image.getchannel("A").getbbox()
            if bounds is None or bounds[0] < size * .10 or bounds[1] < size * .10 or bounds[2] > size * .90 or bounds[3] > size * .90:
                raise ValueError(f"maskable icon {size} violates its 10% safe zone")
    print_root = brand / "exports/print"
    expected = {
        f"iroa-{role}-{variant}.pdf"
        for role in ("symbol", "wordmark", "lockup")
        for variant in ("color", "mono")
    }
    actual = {path.name for path in print_root.glob("*.pdf")}
    if actual != expected:
        raise ValueError(f"print exports must be exactly {sorted(expected)}; found {sorted(actual)}")
    for name in expected:
        _audit_pdf(print_root / name)


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit IROA brand assets")
    parser.add_argument("scope", choices=("official",))
    arguments = parser.parse_args()
    if arguments.scope == "official":
        audit_official_assets(Path(__file__).resolve().parents[2])
        print("official asset audit passed")


if __name__ == "__main__":
    main()
