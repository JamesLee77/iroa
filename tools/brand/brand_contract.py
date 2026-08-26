from dataclasses import dataclass
from pathlib import Path


OFFICIAL_PNG_SIZES = (16, 24, 32, 48, 64, 128, 180, 192, 256, 512, 1024)


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
