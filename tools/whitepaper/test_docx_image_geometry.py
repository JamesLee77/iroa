#!/usr/bin/env python3

from __future__ import annotations

import unittest
import xml.etree.ElementTree as ET
from zipfile import ZipFile


WP = "{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

EXPECTED = {
    **{f"rId{index}": (6044184, 4032504) for index in range(12, 20)},
    "rId46": (5897880, 3024936),
    "rId47": (5897880, 3026465),
    "rId48": (5897880, 3029528),
}


class WhitepaperImageGeometryTest(unittest.TestCase):
    def test_replacement_images_preserve_approved_document_slots(self) -> None:
        with ZipFile("docs/whitepaper/exports/IROA_WHITEPAPER_KO.docx") as archive:
            document = ET.fromstring(archive.read("word/document.xml"))

        actual: dict[str, tuple[int, int]] = {}
        for drawing in document.iter(W + "drawing"):
            blip = drawing.find(".//" + A + "blip")
            extent = drawing.find(".//" + WP + "extent")
            if blip is None or extent is None:
                continue
            relationship_id = blip.get(R + "embed")
            if relationship_id in EXPECTED:
                actual[relationship_id] = (int(extent.get("cx", "0")), int(extent.get("cy", "0")))

        self.assertEqual(EXPECTED, actual)


if __name__ == "__main__":
    unittest.main()
