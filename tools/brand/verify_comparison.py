import argparse
from pathlib import Path
import re
import subprocess
from tempfile import TemporaryDirectory
from xml.etree import ElementTree as ET

from PIL import Image


_RENDER_HEIGHT = 2048
_ALPHA_THRESHOLD = 32
_SCENE_TOKENS = {
    "mono-hero": "hero",
    "default": "proof",
    "reverse": "proof",
    "web-header": "web",
    "watch": "watch",
    "kiosk": "kiosk",
    "whitepaper-cover": "cover",
    "receipt": "receipt",
}


def _viewbox_aspect_ratio(source: Path) -> float:
    root = ET.parse(source).getroot()
    values = root.attrib.get("viewBox", "").replace(",", " ").split()
    if len(values) != 4:
        raise ValueError(f"{source} must include a four-number viewBox")
    width, height = (float(value) for value in values[2:])
    if width <= 0 or height <= 0:
        raise ValueError(f"{source} viewBox must have positive dimensions")
    return width / height


def measure_foreground_ink_ratio(source: Path) -> float:
    """Measure visible alpha height from a direct high-resolution SVG render."""
    width = round(_RENDER_HEIGHT * _viewbox_aspect_ratio(source))
    with TemporaryDirectory() as directory:
        rendered = Path(directory) / "wordmark.png"
        subprocess.run(
            [
                "sips",
                "-s",
                "format",
                "png",
                "-z",
                str(_RENDER_HEIGHT),
                str(width),
                str(source),
                "--out",
                str(rendered),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        with Image.open(rendered) as image:
            alpha = image.convert("RGBA").getchannel("A")
            mask = alpha.point(
                lambda value: 255 if value >= _ALPHA_THRESHOLD else 0
            )
            bounds = mask.getbbox()
    if bounds is None:
        raise ValueError(f"{source} has no visible foreground ink")
    return (bounds[3] - bounds[1]) / _RENDER_HEIGHT


def _parse_comparison_tokens(html: str) -> tuple[dict[str, float], float]:
    tokens = {
        name: float(value)
        for name, value in re.findall(
            r"--wordmark-([a-z-]+)-height:\s*([0-9.]+)px", html
        )
    }
    board_b = re.search(r"\.board-b\s*\{(?P<body>.*?)\}", html, re.DOTALL)
    if board_b is None:
        raise ValueError("comparison HTML must include .board-b")
    factor = re.search(
        r"--wordmark-optical-factor:\s*([0-9.]+)", board_b.group("body")
    )
    if factor is None:
        raise ValueError(".board-b must define --wordmark-optical-factor")
    missing = sorted(set(_SCENE_TOKENS.values()) - set(tokens))
    if missing:
        raise ValueError(f"comparison HTML is missing height tokens: {missing}")
    return tokens, float(factor.group(1))


def verify_comparison(html_path: Path, tolerance_px: int = 1) -> list[str]:
    repository = Path(__file__).resolve().parents[2]
    candidates = repository / "docs" / "brand" / "candidates"
    track_a = candidates / "track-a" / "wordmark.svg"
    track_b = candidates / "track-b" / "wordmark.svg"
    ratio_a = measure_foreground_ink_ratio(track_a)
    ratio_b = measure_foreground_ink_ratio(track_b)
    expected_factor = ratio_a / ratio_b

    tokens, configured_factor = _parse_comparison_tokens(html_path.read_text())
    if abs(configured_factor - expected_factor) > 0.001:
        raise ValueError(
            "Track B optical factor must come from foreground ink geometry: "
            f"configured={configured_factor:.9f}, expected={expected_factor:.9f}"
        )

    lines = [
        f"ink-ratio track-a={ratio_a:.9f} track-b={ratio_b:.9f}",
        f"optical-factor track-b={configured_factor:.9f}",
    ]
    for scene, token in _SCENE_TOKENS.items():
        base_height = tokens[token]
        ink_a = round(base_height * ratio_a)
        ink_b = round(base_height * configured_factor * ratio_b)
        difference = abs(ink_a - ink_b)
        lines.append(
            f"{scene}: track-a={ink_a}px track-b={ink_b}px diff={difference}px"
        )
        if difference > tolerance_px:
            raise ValueError(
                f"{scene} foreground ink differs by {difference}px "
                f"({ink_a}px vs {ink_b}px)"
            )
    return lines


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Verify optical wordmark parity in the IROA BI comparison"
    )
    parser.add_argument("html", type=Path)
    arguments = parser.parse_args()
    try:
        lines = verify_comparison(arguments.html)
    except (OSError, subprocess.CalledProcessError, ValueError) as error:
        parser.exit(1, f"comparison optical parity failed: {error}\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
