#!/usr/bin/env python3

from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


PDF_PATH = Path("docs/whitepaper/exports/IROA_WHITEPAPER_KO.pdf")


class WhitepaperPdfKoreanTextTest(unittest.TestCase):
    def test_pdf_preserves_korean_text_layer_and_embeds_korean_font(self) -> None:
        text = subprocess.check_output(
            ["pdftotext", str(PDF_PATH), "-"],
            text=True,
        )
        self.assertIn("일상을 이롭게. 필요한 일을 끝까지.", text)

        fonts = subprocess.check_output(
            ["pdffonts", str(PDF_PATH)],
            text=True,
        )
        self.assertRegex(
            fonts,
            r"NotoSans(?:CJK)?KR",
            "PDF must embed a Korean Noto Sans font so Hangul renders visibly.",
        )

    def test_pdf_keeps_original_page_layout_and_exact_image_slots(self) -> None:
        info = subprocess.check_output(["pdfinfo", str(PDF_PATH)], text=True)
        self.assertRegex(info, r"(?m)^Pages:\s+52$")

        images = subprocess.check_output(["pdfimages", "-list", str(PDF_PATH)], text=True)
        image_pages = tuple(
            int(stripped.split()[0])
            for line in images.splitlines()
            if (stripped := line.strip()) and stripped[0].isdigit()
        )
        self.assertEqual(image_pages, (1, 11, 17, 19, 21, 23, 32, 36, 39, 40, 41))


if __name__ == "__main__":
    unittest.main()
