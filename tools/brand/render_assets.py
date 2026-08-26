from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory

from PIL import Image


def render_svg_png(source: Path, destination: Path, width: int, height: int) -> None:
    """Render an SVG with macOS sips and save an exact-size RGBA PNG."""
    if width <= 0 or height <= 0:
        raise ValueError("width and height must be positive")

    destination.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory() as directory:
        rendered = Path(directory) / "rendered.png"
        subprocess.run(
            ["sips", "-s", "format", "png", str(source), "--out", str(rendered)],
            check=True,
            capture_output=True,
            text=True,
        )
        with Image.open(rendered) as image:
            image.convert("RGBA").resize((width, height), Image.Resampling.LANCZOS).save(
                destination, format="PNG"
            )
