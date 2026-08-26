import argparse
from pathlib import Path
from tempfile import TemporaryDirectory

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen.canvas import Canvas


def build_comparison_pdf(track_a: Path, track_b: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory() as directory:
        image_pdf = Path(directory) / "comparison-image-pages.pdf"
        canvas = Canvas(
            str(image_pdf),
            pagesize=A4,
            pageCompression=1,
            invariant=1,
        )
        page_width, page_height = A4
        for board in (track_a, track_b):
            canvas.drawImage(
                ImageReader(str(board)),
                0,
                0,
                width=page_width,
                height=page_height,
                preserveAspectRatio=False,
                anchor="c",
            )
            canvas.showPage()
        canvas.save()

        reader = PdfReader(image_pdf)
        writer = PdfWriter()
        writer.clone_document_from_reader(reader)
        for page in writer.pages:
            resources = page["/Resources"].get_object()
            resources.pop(NameObject("/Font"), None)
        with output.open("wb") as stream:
            writer.write(stream)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the two-page image-backed IROA BI comparison PDF"
    )
    parser.add_argument("track_a", type=Path)
    parser.add_argument("track_b", type=Path)
    parser.add_argument("output", type=Path)
    arguments = parser.parse_args()
    build_comparison_pdf(arguments.track_a, arguments.track_b, arguments.output)


if __name__ == "__main__":
    main()
