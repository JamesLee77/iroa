from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image

from tools.brand.audit_assets import audit_png, contrast_ratio, audit_svg
from tools.brand.brand_contract import CandidatePaths, OFFICIAL_PNG_SIZES
from tools.brand.render_assets import render_svg_png


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


if __name__ == "__main__":
    unittest.main()
