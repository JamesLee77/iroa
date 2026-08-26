from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image


_RASTER_ELEMENT_NAMES = frozenset({"feimage", "foreignobject", "image", "img"})
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
