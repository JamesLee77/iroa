from dataclasses import dataclass
from pathlib import Path


OFFICIAL_PNG_SIZES = (16, 24, 32, 48, 64, 128, 180, 192, 256, 512, 1024)

OFFICIAL_MASTER_FILES = frozenset(
    {
        *(f"symbol/iroa-symbol-{variant}.svg" for variant in ("color", "mono", "reverse")),
        *(f"wordmark/iroa-wordmark-{variant}.svg" for variant in ("color", "mono", "reverse")),
        *(f"lockup/iroa-lockup-{variant}.svg" for variant in ("color", "mono", "reverse")),
        "lockup/CONSTRUCTION.md",
    }
)
OFFICIAL_DIGITAL_FILES = frozenset(
    {
        *(f"iroa-symbol-{size}.png" for size in OFFICIAL_PNG_SIZES),
        *(f"iroa-wordmark-{size}.png" for size in OFFICIAL_PNG_SIZES),
    }
)
OFFICIAL_ICON_FILES = frozenset(
    {
        "favicon.svg",
        "favicon-16.png",
        "favicon-32.png",
        "favicon-48.png",
        "apple-touch-icon-180.png",
        "app-icon-192.png",
        "app-icon-512.png",
        "maskable-icon-192.png",
        "maskable-icon-512.png",
        "symbol-watch-48.png",
        "symbol-kiosk-1024.png",
    }
)
OFFICIAL_PRINT_FILES = frozenset(
    f"iroa-{role}-{variant}.pdf"
    for role in ("symbol", "wordmark", "lockup")
    for variant in ("color", "mono")
)


@dataclass(frozen=True)
class CandidatePaths:
    root: Path

    @property
    def symbol(self) -> Path:
        return self.root / "symbol.svg"

    @property
    def wordmark(self) -> Path:
        return self.root / "wordmark.svg"

    @property
    def wordmark_reverse(self) -> Path:
        return self.root / "wordmark-reverse.svg"

    @property
    def wordmark_mono(self) -> Path:
        return self.root / "wordmark-mono.svg"
