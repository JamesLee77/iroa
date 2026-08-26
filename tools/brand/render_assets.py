import argparse
from pathlib import Path
import subprocess
from xml.etree import ElementTree as ET

if __package__:
    from .brand_contract import CandidatePaths
else:
    from brand_contract import CandidatePaths


_CANDIDATE_REVIEW_SIZES = (16, 24, 32, 64)


def render_svg_png(source: Path, destination: Path, width: int, height: int) -> None:
    """Render SVG geometry directly at the requested RGBA PNG resolution."""
    if width <= 0 or height <= 0:
        raise ValueError("width and height must be positive")

    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "sips",
            "-s",
            "format",
            "png",
            "-z",
            str(height),
            str(width),
            str(source),
            "--out",
            str(destination),
        ],
        check=True,
        capture_output=True,
        text=True,
    )


def _viewbox_aspect_ratio(source: Path) -> float:
    root = ET.parse(source).getroot()
    values = root.attrib.get("viewBox", "").replace(",", " ").split()
    if len(values) != 4:
        raise ValueError(f"{source} must include a four-number viewBox")
    width, height = (float(value) for value in values[2:])
    if width <= 0 or height <= 0:
        raise ValueError(f"{source} viewBox must have positive dimensions")
    return width / height


def render_candidate_previews(candidate_root: Path) -> None:
    paths = CandidatePaths(candidate_root)
    for source in (
        paths.symbol,
        paths.wordmark,
        paths.wordmark_reverse,
        paths.wordmark_mono,
    ):
        aspect_ratio = _viewbox_aspect_ratio(source)
        for height in _CANDIDATE_REVIEW_SIZES:
            width = round(height * aspect_ratio)
            destination = candidate_root / "renders" / f"{source.stem}-{height}.png"
            render_svg_png(source, destination, width, height)


def main() -> None:
    parser = argparse.ArgumentParser(description="Render IROA brand assets")
    subparsers = parser.add_subparsers(dest="command", required=True)
    candidate_parser = subparsers.add_parser(
        "candidate", help="render 16/24/32/64 px candidate previews"
    )
    candidate_parser.add_argument("candidate_root", type=Path)
    arguments = parser.parse_args()

    if arguments.command == "candidate":
        render_candidate_previews(arguments.candidate_root)


if __name__ == "__main__":
    main()
