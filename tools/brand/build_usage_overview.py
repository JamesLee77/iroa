"""Build the deterministic IROA BI v1.0 official usage overview."""

import argparse
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image, ImageDraw, ImageFont

if __package__:
    from .audit_assets import contrast_ratio
    from .render_assets import render_svg_png
else:
    from audit_assets import contrast_ratio
    from render_assets import render_svg_png


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BRAND_ROOT = ROOT / "docs/brand"
DEFAULT_OUTPUT = DEFAULT_BRAND_ROOT / "examples/usage-overview.png"
DEFAULT_MANIFEST = DEFAULT_BRAND_ROOT / "examples/usage-overview-manifest.json"
DEFAULT_FONT_ROOT = DEFAULT_BRAND_ROOT / "assets/fonts"

WIDTH = 2560
HEIGHT = 1600
NAVY = "#16263D"
CORAL = "#F06D5E"
IVORY = "#F7F3EA"
TEAL = "#3D8B83"
LIGHT_TEAL = "#83CDC4"
INK = "#19222E"
WHITE = "#FFFFFF"
MIST = "#E8E7E1"
TEXT_GRAY = "#C8D2DB"

FONT_SPECS = {
    False: {
        "name": "NotoSansKR-Medium.otf",
        "path": "assets/fonts/NotoSansKR-Medium.otf",
        "sha256": "b46988ef13e8bac08f3933af686eaf770972994f9b6d335be0184d60169b5431",
    },
    True: {
        "name": "NotoSansKR-Bold.otf",
        "path": "assets/fonts/NotoSansKR-Bold.otf",
        "sha256": "5a6ceb287ed2fc6cfc6213144ebea68cbd94b20fc9eb873d8486493bf02d9bda",
    },
}

ASSET_DEPENDENCIES = (
    "exports/digital/iroa-symbol-128.png",
    "exports/digital/iroa-wordmark-64.png",
    "exports/digital/iroa-wordmark-128.png",
    "exports/icons/app-icon-192.png",
    "exports/icons/symbol-kiosk-1024.png",
    "exports/icons/symbol-watch-48.png",
    "masters/lockup/iroa-lockup-color.svg",
)

SCENES = {
    "web": {
        "bounds": [96, 292, 1256, 808],
        "assets": [
            "exports/digital/iroa-wordmark-64.png",
            "exports/digital/iroa-symbol-128.png",
        ],
    },
    "app": {
        "bounds": [1300, 292, 1808, 808],
        "phone_bounds": [1436, 322, 1672, 778],
        "assets": ["exports/icons/app-icon-192.png"],
    },
    "watch": {
        "bounds": [1852, 292, 2464, 808],
        "assets": ["exports/icons/symbol-watch-48.png"],
    },
    "kiosk": {
        "bounds": [96, 854, 1112, 1504],
        "assets": ["exports/icons/symbol-kiosk-1024.png"],
    },
    "document": {
        "bounds": [1156, 854, 1828, 1504],
        "assets": ["masters/lockup/iroa-lockup-color.svg"],
    },
}


def _verified_font_paths(font_root: Path) -> dict[bool, Path]:
    verified = {}
    for bold, specification in FONT_SPECS.items():
        path = font_root / specification["name"]
        if not path.is_file():
            raise FileNotFoundError(f"pinned font missing: {path}")
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != specification["sha256"]:
            raise ValueError(
                f"pinned font hash mismatch: {path}: "
                f"expected {specification['sha256']}, got {actual}"
            )
        verified[bold] = path
    return verified


def _font(
    font_paths: dict[bool, Path],
    size: int,
    bold: bool = False,
) -> ImageFont.FreeTypeFont:
    # Pin Pillow's layout backend so hosts with optional libraqm installed do
    # not shape the same bundled fonts differently from hosts without it.
    return ImageFont.truetype(
        str(font_paths[bold]),
        size,
        layout_engine=ImageFont.Layout.BASIC,
    )


def _rounded(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    radius: int,
    fill: str,
    outline: str | None = None,
    width: int = 1,
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def _asset(brand_root: Path, relative: str) -> Path:
    if relative not in ASSET_DEPENDENCIES:
        raise ValueError(f"usage overview dependency is not in the official manifest: {relative}")
    path = brand_root / relative
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def _paste_png(
    canvas: Image.Image,
    brand_root: Path,
    relative: str,
    position: tuple[int, int],
    size: tuple[int, int] | None = None,
) -> tuple[int, int]:
    with Image.open(_asset(brand_root, relative)).convert("RGBA") as source:
        image = source.copy()
    if size is not None:
        image = image.resize(size, Image.Resampling.LANCZOS)
    canvas.alpha_composite(image, position)
    return image.size


def build_usage_overview(
    output: Path,
    manifest_path: Path | None = None,
    brand_root: Path = DEFAULT_BRAND_ROOT,
    font_root: Path = DEFAULT_FONT_ROOT,
) -> dict[str, object]:
    font_paths = _verified_font_paths(font_root)
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), IVORY)
    draw = ImageDraw.Draw(canvas)
    text_runs: list[dict[str, object]] = []

    def text(
        xy: tuple[int, int],
        value: str,
        size: int,
        foreground: str,
        background: str,
        *,
        bold: bool = False,
        anchor: str | None = None,
        context: str,
        minimum: float = 4.5,
    ) -> tuple[int, int, int, int]:
        ratio = contrast_ratio(foreground, background)
        if ratio < minimum:
            raise ValueError(
                f"{context} text contrast {ratio:.2f}:1 is below {minimum:.1f}:1"
            )
        face = _font(font_paths, size, bold)
        bounds = tuple(round(value) for value in draw.textbbox(xy, value, font=face, anchor=anchor))
        draw.text(xy, value, font=face, fill=foreground, anchor=anchor)
        text_runs.append(
            {
                "context": context,
                "text": value,
                "bounds": list(bounds),
                "foreground": foreground,
                "background": background,
                "ratio": round(ratio, 2),
                "minimum": minimum,
            }
        )
        return bounds

    # Header
    _paste_png(
        canvas,
        brand_root,
        "exports/digital/iroa-wordmark-128.png",
        (96, 72),
    )
    text((2460, 94), "BRAND IDENTITY · V1.0", 30, NAVY, IVORY, bold=True, anchor="ra", context="header.version")
    text((2460, 144), "공식 적용 시스템", 46, INK, IVORY, bold=True, anchor="ra", context="header.title")
    draw.line((96, 236, 2464, 236), fill=NAVY, width=2)
    draw.line((96, 236, 390, 236), fill=CORAL, width=8)
    draw.line((390, 236, 540, 236), fill=TEAL, width=8)

    # Web
    _rounded(draw, (96, 292, 1256, 808), 28, WHITE, "#D8D7D1", 2)
    draw.rounded_rectangle((96, 292, 1256, 356), radius=28, fill="#F1F0EB")
    draw.rectangle((96, 328, 1256, 356), fill="#F1F0EB")
    for cx, color in ((128, CORAL), (156, "#DABF65"), (184, LIGHT_TEAL)):
        draw.ellipse((cx - 7, 317, cx + 7, 331), fill=color)
    text((224, 323), "WEB", 20, NAVY, "#F1F0EB", bold=True, anchor="lm", context="web.label")
    _paste_png(canvas, brand_root, "exports/digital/iroa-wordmark-64.png", (146, 388))
    text((1178, 424), "도움 요청   이용 안내", 22, NAVY, WHITE, anchor="rm", context="web.navigation")
    _rounded(draw, (136, 490, 1216, 764), 22, NAVY)
    text((192, 552), "일상을 이롭게.", 56, WHITE, NAVY, bold=True, context="web.headline")
    text((192, 630), "선택은 사용자에게, 필요한 일은 끝까지.", 27, LIGHT_TEAL, NAVY, context="web.copy")
    _rounded(draw, (192, 686, 438, 738), 26, CORAL)
    text((315, 712), "무엇을 도와드릴까요?", 20, NAVY, CORAL, bold=True, anchor="mm", context="web.action")
    draw.ellipse((836, 522, 1010, 696), fill=WHITE)
    _paste_png(canvas, brand_root, "exports/digital/iroa-symbol-128.png", (859, 545))

    # App
    _rounded(draw, (1300, 292, 1808, 808), 28, NAVY)
    text((1348, 338), "APP", 20, LIGHT_TEAL, NAVY, bold=True, context="app.label")
    _rounded(draw, (1436, 322, 1672, 778), 42, WHITE)
    _rounded(draw, (1511, 340, 1597, 350), 5, "#D8D7D1")
    _paste_png(canvas, brand_root, "exports/icons/app-icon-192.png", (1458, 384))
    text((1554, 600), "IROA Agent", 25, NAVY, WHITE, bold=True, anchor="mm", context="app.product")
    text((1554, 640), "예약 내용을 확인했어요.", 18, INK, WHITE, anchor="mm", context="app.copy")
    _rounded(draw, (1470, 682, 1638, 730), 24, NAVY)
    text((1554, 706), "확인하기", 18, WHITE, NAVY, bold=True, anchor="mm", context="app.action")
    _rounded(draw, (1462, 740, 1646, 768), 14, NAVY)
    text((1554, 754), "선택 · 확인 · 완료", 13, LIGHT_TEAL, NAVY, anchor="mm", context="app.status")

    # Watch
    _rounded(draw, (1852, 292, 2464, 808), 28, "#EDE7DD", "#D8D1C6", 2)
    text((1900, 338), "WATCH", 20, NAVY, "#EDE7DD", bold=True, context="watch.label")
    _rounded(draw, (2024, 360, 2292, 730), 92, "#C8C6C0")
    _rounded(draw, (1986, 430, 2330, 674), 72, INK)
    draw.ellipse((2109, 467, 2207, 565), fill=WHITE)
    _paste_png(canvas, brand_root, "exports/icons/symbol-watch-48.png", (2134, 492))
    text((2158, 603), "요청이 도착했어요", 19, WHITE, INK, bold=True, anchor="mm", context="watch.copy")
    text((2158, 638), "확인  ·  취소", 16, LIGHT_TEAL, INK, anchor="mm", context="watch.actions")
    text((1900, 758), "48px 공식 심볼", 18, NAVY, "#EDE7DD", context="watch.caption")

    # Kiosk
    _rounded(draw, (96, 854, 1112, 1504), 28, WHITE, "#D8D7D1", 2)
    text((144, 900), "KIOSK", 20, NAVY, WHITE, bold=True, context="kiosk.label")
    _rounded(draw, (162, 956, 1046, 1388), 24, NAVY)
    draw.ellipse((232, 1020, 496, 1284), fill=WHITE)
    _paste_png(
        canvas,
        brand_root,
        "exports/icons/symbol-kiosk-1024.png",
        (252, 1040),
        (224, 224),
    )
    text((566, 1045), "무엇을", 42, WHITE, NAVY, bold=True, context="kiosk.headline1")
    text((566, 1102), "도와드릴까요?", 42, WHITE, NAVY, bold=True, context="kiosk.headline2")
    text((566, 1178), "주문 · 예약 · 결제", 24, LIGHT_TEAL, NAVY, context="kiosk.options")
    _rounded(draw, (566, 1240, 934, 1314), 37, CORAL)
    text((750, 1277), "화면을 눌러 시작", 23, NAVY, CORAL, bold=True, anchor="mm", context="kiosk.action")
    text((144, 1446), "먼 거리 식별 · 큰 문구 · 명시적 상태", 20, INK, WHITE, context="kiosk.caption")

    # Document
    _rounded(draw, (1156, 854, 1828, 1504), 28, "#E9E5DC")
    text((1204, 900), "DOCUMENT", 20, NAVY, "#E9E5DC", bold=True, context="document.label")
    _rounded(draw, (1304, 934, 1680, 1470), 8, WHITE)
    with TemporaryDirectory() as directory:
        lockup = Path(directory) / "lockup.png"
        render_svg_png(
            _asset(brand_root, "masters/lockup/iroa-lockup-color.svg"),
            lockup,
            304,
            72,
        )
        with Image.open(lockup).convert("RGBA") as source:
            canvas.alpha_composite(source.copy(), (1340, 984))
    draw.line((1340, 1086, 1644, 1086), fill=MIST, width=2)
    text((1340, 1134), "생활 지원 운영 안내", 27, NAVY, WHITE, bold=True, context="document.title")
    text((1340, 1182), "필요한 일을 끝까지 연결합니다.", 17, INK, WHITE, context="document.copy")
    for y, width in ((1240, 272), (1276, 244), (1312, 286), (1374, 178)):
        draw.rounded_rectangle((1340, y, 1340 + width, y + 10), radius=5, fill="#D9D8D2")
    draw.ellipse((1594, 1370, 1620, 1396), fill=CORAL)
    text((1204, 1460), "SVG 마스터 · 벡터 인쇄 호환본", 18, INK, "#E9E5DC", context="document.caption")

    # System summary
    _rounded(draw, (1872, 854, 2464, 1504), 28, NAVY)
    text((1920, 900), "ONE OFFICIAL SYSTEM", 20, LIGHT_TEAL, NAVY, bold=True, context="system.label")
    text((1920, 964), "하나의 형상,", 42, WHITE, NAVY, bold=True, context="system.headline1")
    text((1920, 1018), "다섯 개의 문맥.", 42, WHITE, NAVY, bold=True, context="system.headline2")
    text((1920, 1092), "웹  ·  앱  ·  워치", 23, LIGHT_TEAL, NAVY, context="system.platforms1")
    text((1920, 1134), "키오스크  ·  문서", 23, LIGHT_TEAL, NAVY, context="system.platforms2")
    _paste_png(canvas, brand_root, "exports/digital/iroa-symbol-128.png", (1920, 1214))
    draw.ellipse((2094, 1230, 2124, 1260), fill=CORAL)
    text((2148, 1245), "행동은 명확하게", 21, WHITE, NAVY, bold=True, anchor="lm", context="system.principle1")
    draw.ellipse((2094, 1300, 2124, 1330), fill=LIGHT_TEAL)
    text((2148, 1315), "기술은 따뜻하게", 21, WHITE, NAVY, bold=True, anchor="lm", context="system.principle2")
    draw.line((1920, 1392, 2416, 1392), fill="#425065", width=2)
    text((1920, 1432), "IROA.AI BI v1.0 · 2026-08-27", 18, TEXT_GRAY, NAVY, context="system.footer")

    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(output, format="PNG", optimize=False, compress_level=9)
    manifest: dict[str, object] = {
        "version": 1,
        "canvas": [WIDTH, HEIGHT],
        "mode": "RGB",
        "assets": list(ASSET_DEPENDENCIES),
        "fonts": [
            {
                "path": FONT_SPECS[bold]["path"],
                "sha256": FONT_SPECS[bold]["sha256"],
            }
            for bold in (False, True)
        ],
        "scenes": SCENES,
        "text_runs": text_runs,
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
    }
    if manifest_path is not None:
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--brand-root", type=Path, default=DEFAULT_BRAND_ROOT)
    parser.add_argument("--font-root", type=Path, default=DEFAULT_FONT_ROOT)
    arguments = parser.parse_args()
    manifest = build_usage_overview(
        arguments.output,
        arguments.manifest,
        arguments.brand_root,
        arguments.font_root,
    )
    print(
        f"built {arguments.output} "
        f"{manifest['canvas'][0]}x{manifest['canvas'][1]} {manifest['mode']} "
        f"sha256={manifest['sha256']}"
    )


if __name__ == "__main__":
    main()
