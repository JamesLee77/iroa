import json
import re
import sys
from pathlib import Path

PROHIBITED = (
    "원금 보장",
    "수익 보장",
    "가격 상승 보장",
    "질병 진단을 제공합니다",
    "Samsung 공식 파트너",
    "HEFI 파트너를 승계",
)
SOURCE_PATTERN = re.compile(r"\[(S-[A-Z0-9-]+)\]")


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def validate(whitepaper_path: Path, sources_path: Path, claims_path: Path) -> list[str]:
    text = whitepaper_path.read_text(encoding="utf-8")
    sources = load_json(sources_path)
    claims = load_json(claims_path)
    source_ids = {entry["id"] for entry in sources}
    errors = [f"Prohibited claim: {phrase}" for phrase in PROHIBITED if phrase in text]
    for source_id in sorted(set(SOURCE_PATTERN.findall(text)) - source_ids):
        errors.append(f"Unknown source ID: {source_id}")
    for index, claim in enumerate(claims):
        if claim.get("status") not in {"supported", "conditional", "design-decision"}:
            errors.append(f"Invalid claim status at index {index}")
        for source_id in claim.get("source_ids", []):
            if source_id not in source_ids:
                errors.append(f"Claim {index} has unknown source ID: {source_id}")
    return errors


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    errors = validate(
        root / "docs/whitepaper/MODUA_WHITEPAPER_KO.md",
        root / "docs/whitepaper/sources.json",
        root / "docs/whitepaper/claims.json",
    )
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    print("whitepaper-validation: PASS")
