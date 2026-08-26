from pathlib import Path
import re
import subprocess
import sys
import unittest


class ComparisonOpticalParityTest(unittest.TestCase):
    comparison_pdf = Path(
        "docs/brand/candidates/comparison/iroa-bi-candidates.pdf"
    )

    def test_comparison_wordmarks_have_equal_visible_ink_height(self):
        result = subprocess.run(
            [
                sys.executable,
                "tools/brand/verify_comparison.py",
                "docs/brand/candidates/comparison/iroa-bi-candidates.html",
            ],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_comparison_pdf_has_two_standard_a4_pages(self):
        result = subprocess.run(
            ["pdfinfo", "-f", "1", "-l", "2", str(self.comparison_pdf)],
            capture_output=True,
            text=True,
            check=True,
        )
        pages = re.search(r"^Pages:\s+(\d+)$", result.stdout, re.MULTILINE)
        page_sizes = re.findall(
            r"^Page(?:\s+\d+)?\s+size:\s+([0-9.]+) x ([0-9.]+) pts",
            result.stdout,
            re.MULTILINE,
        )
        self.assertIsNotNone(pages, result.stdout)
        self.assertEqual(int(pages.group(1)), 2)
        self.assertEqual(len(page_sizes), 2, result.stdout)
        for width, height in page_sizes:
            self.assertAlmostEqual(float(width), 595.28, delta=0.02)
            self.assertAlmostEqual(float(height), 841.89, delta=0.02)

    def test_comparison_pdf_embeds_no_font_resources(self):
        result = subprocess.run(
            ["pdffonts", str(self.comparison_pdf)],
            capture_output=True,
            text=True,
            check=True,
        )
        separator = next(
            index
            for index, line in enumerate(result.stdout.splitlines())
            if line.startswith("---")
        )
        font_rows = [
            line
            for line in result.stdout.splitlines()[separator + 1 :]
            if line.strip()
        ]
        self.assertEqual(font_rows, [], result.stdout)


if __name__ == "__main__":
    unittest.main()
