#!/usr/bin/env python3

from __future__ import annotations

import argparse
import io
import zlib
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps
from pypdf import PdfReader, PdfWriter
from pypdf.generic import BooleanObject, EncodedStreamObject, NameObject, NumberObject


@dataclass(frozen=True)
class Replacement:
    page: int
    object_id: int
    image_path: Path
    fit: str


REPLACEMENTS = (
    Replacement(1, 25, Path("docs/brand/assets/illustrations/iroa-whitepaper-cover-v1.png"), "cover"),
    Replacement(11, 73, Path("docs/brand/assets/illustrations/iroa-product-system-v1.png"), "cover"),
    Replacement(17, 87, Path("docs/brand/assets/illustrations/iroa-wearable-request-v1.png"), "cover"),
    Replacement(19, 92, Path("docs/brand/assets/illustrations/iroa-secure-execution-v1.png"), "cover"),
    Replacement(21, 97, Path("docs/brand/assets/illustrations/iroa-companion-handoff-v1.png"), "cover"),
    Replacement(23, 102, Path("docs/brand/assets/illustrations/iroa-kiosk-settlement-v1.png"), "cover"),
    Replacement(32, 133, Path("docs/brand/assets/illustrations/iroa-health-consent-v1.png"), "cover"),
    Replacement(36, 142, Path("docs/brand/assets/illustrations/iroa-reward-community-v1.png"), "cover"),
    Replacement(39, 149, Path("docs/whitepaper/analysis/iroa-token-allocation.png"), "contain"),
    Replacement(40, 152, Path("docs/whitepaper/analysis/iroa-token-circulating-supply.png"), "contain"),
    Replacement(41, 155, Path("docs/whitepaper/analysis/iroa-node-reward-dilution.png"), "contain"),
)


def make_image_stream(source: Path, width: int, height: int, fit: str) -> EncodedStreamObject:
    image = Image.open(source).convert("RGB")

    if fit == "cover":
        rendered = ImageOps.fit(image, (width, height), method=Image.Resampling.LANCZOS)
        encoded = io.BytesIO()
        rendered.save(encoded, format="JPEG", quality=94, optimize=True, progressive=True)
        data = encoded.getvalue()
        filter_name = "/DCTDecode"
    elif fit == "contain":
        rendered = Image.new("RGB", (width, height), "#F5F0E8")
        contained = ImageOps.contain(image, (width, height), method=Image.Resampling.LANCZOS)
        offset = ((width - contained.width) // 2, (height - contained.height) // 2)
        rendered.paste(contained, offset)
        data = zlib.compress(rendered.tobytes(), level=9)
        filter_name = "/FlateDecode"
    else:
        raise ValueError(f"Unsupported fit mode: {fit}")

    stream = EncodedStreamObject()
    stream._data = data
    stream.update(
        {
            NameObject("/Type"): NameObject("/XObject"),
            NameObject("/Subtype"): NameObject("/Image"),
            NameObject("/Width"): NumberObject(width),
            NameObject("/Height"): NumberObject(height),
            NameObject("/ColorSpace"): NameObject("/DeviceRGB"),
            NameObject("/BitsPerComponent"): NumberObject(8),
            NameObject("/Filter"): NameObject(filter_name),
            NameObject("/Interpolate"): BooleanObject(False),
        }
    )
    return stream


def replace_images(input_pdf: Path, output_pdf: Path) -> None:
    reader = PdfReader(input_pdf)
    by_page = {item.page: item for item in REPLACEMENTS}

    for page_number, replacement in by_page.items():
        page = reader.pages[page_number - 1]
        resources = page["/Resources"].get_object()
        xobjects = resources["/XObject"].get_object()

        matched_name = None
        matched_object = None
        for name, reference in xobjects.items():
            if getattr(reference, "idnum", None) == replacement.object_id:
                matched_name = name
                matched_object = reference.get_object()
                break

        if matched_name is None or matched_object is None:
            raise RuntimeError(
                f"Expected image object {replacement.object_id} on page {page_number} was not found."
            )

        width = int(matched_object["/Width"])
        height = int(matched_object["/Height"])
        xobjects[matched_name] = make_image_stream(
            replacement.image_path,
            width,
            height,
            replacement.fit,
        )

    writer = PdfWriter(clone_from=reader)
    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    with output_pdf.open("wb") as file_handle:
        writer.write(file_handle)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Replace the eleven IROA whitepaper visuals without reflowing the PDF."
    )
    parser.add_argument("input_pdf", type=Path)
    parser.add_argument("output_pdf", type=Path)
    args = parser.parse_args()
    replace_images(args.input_pdf, args.output_pdf)


if __name__ == "__main__":
    main()
