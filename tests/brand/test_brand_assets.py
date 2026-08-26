import hashlib
from pathlib import Path
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest

from PIL import Image

from tools.brand.audit_assets import audit_png, contrast_ratio, audit_svg
from tools.brand.brand_contract import CandidatePaths, OFFICIAL_PNG_SIZES
from tools.brand.render_assets import render_svg_png


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class BrandContractTest(unittest.TestCase):
    def test_required_png_sizes_are_exact(self):
        self.assertEqual(
            OFFICIAL_PNG_SIZES,
            (16, 24, 32, 48, 64, 128, 180, 192, 256, 512, 1024),
        )

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
            track_b.wordmark,
            track_b.wordmark_reverse,
            track_b.wordmark_mono,
        ):
            self.assertTrue(path.is_file(), path)
            audit_svg(path)
        self.assertNotEqual(_digest(track_a.symbol), _digest(track_b.symbol))
        self.assertNotEqual(_digest(track_a.wordmark), _digest(track_b.wordmark))

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

    def test_render_svg_png_creates_auditable_rgba_png(self):
        source = Path("tests/brand/fixtures/accessible-symbol.svg")
        with TemporaryDirectory() as directory:
            destination = Path(directory) / "symbol.png"
            render_svg_png(source, destination, 32, 24)
            audit_png(destination, 32, 24)

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


if __name__ == "__main__":
    unittest.main()
