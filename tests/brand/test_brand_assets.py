import hashlib
from pathlib import Path
import re
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from xml.etree import ElementTree as ET

from PIL import Image, ImageChops

from tools.brand.audit_assets import _audit_pdf, audit_official_assets, audit_png, contrast_ratio, audit_svg
from tools.brand.brand_contract import CandidatePaths, OFFICIAL_PNG_SIZES
from tools.brand.promote_candidate import _remove_unexpected_files
from tools.brand.render_assets import render_svg_png


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


class BrandContractTest(unittest.TestCase):
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
        for size, name in ((180, "apple-touch-icon-180.png"), (192, "app-icon-192.png"), (512, "app-icon-512.png"), (192, "maskable-icon-192.png"), (512, "maskable-icon-512.png"), (48, "symbol-watch-48.png"), (1024, "symbol-kiosk-1024.png")):
            audit_png(icons / name, size, size)

        for size in (192, 512):
            with Image.open(icons / f"maskable-icon-{size}.png").convert("RGBA") as image:
                alpha = image.getchannel("A")
                bounds = alpha.getbbox()
                self.assertIsNotNone(bounds)
                margin = size * 0.10
                self.assertGreaterEqual(bounds[0], margin)
                self.assertGreaterEqual(bounds[1], margin)
                self.assertLessEqual(bounds[2], size - margin)
                self.assertLessEqual(bounds[3], size - margin)
        audit_svg(icons / "favicon.svg")

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
