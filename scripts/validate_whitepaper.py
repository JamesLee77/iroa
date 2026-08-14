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
SAFETY_PATTERNS = (
    ("official-partner", re.compile(r"(?:Samsung|삼성)\s*(?:공식|official)\s*(?:파트너|partner)", re.IGNORECASE)),
    ("diagnostic", re.compile(r"(?:질병|의료|건강)?\s*(?:진단|diagnos(?:e|is|tic)?)", re.IGNORECASE)),
    ("stablecoin-issuance-custody-exchange", re.compile(r"MODUA.{0,40}(?:스테이블코인|stablecoin).{0,60}(?:발행|수탁|커스터디|보관|매매|교환|중개|거래소)", re.IGNORECASE)),
    ("private-key-wallet", re.compile(r"(?:갤럭시\s*워치|Galaxy\s*Watch|Watch).{0,80}(?:개인키|private\s*key).{0,80}(?:지갑|wallet)", re.IGNORECASE)),
    ("health-data-ledger", re.compile(r"(?:건강\s*데이터|health\s*data).{0,80}(?:블록체인|blockchain|결제\s*원장|payment\s*ledger)", re.IGNORECASE)),
)
PAYMENT_OR_DATA_SHARING = re.compile(
    r"(?:결제|payment|(?:데이터|정보).{0,20}(?:공유|제공|전송)|(?:공유|제공|전송).{0,20}(?:데이터|정보))",
    re.IGNORECASE,
)
EXPLICIT_APPROVAL = re.compile(r"(?:명시적\s*(?:동의|승인)|사용자\s*(?:동의|승인)|explicit\s*approval|user\s*consent)", re.IGNORECASE)


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def validate(whitepaper_path: Path, sources_path: Path, claims_path: Path) -> list[str]:
    text = whitepaper_path.read_text(encoding="utf-8")
    sources = load_json(sources_path)
    claims = load_json(claims_path)
    source_ids = {entry["id"] for entry in sources}
    sources_by_id = {entry["id"]: entry for entry in sources}
    errors = [f"Prohibited claim: {phrase}" for phrase in PROHIBITED if phrase in text]
    errors.extend(
        f"Safety violation ({name})" for name, pattern in SAFETY_PATTERNS if pattern.search(text)
    )
    if PAYMENT_OR_DATA_SHARING.search(text) and not EXPLICIT_APPROVAL.search(text):
        errors.append("Safety violation (explicit-approval-required)")
    for source_id in sorted(set(SOURCE_PATTERN.findall(text)) - source_ids):
        errors.append(f"Unknown source ID: {source_id}")
    for index, claim in enumerate(claims):
        if claim.get("status") not in {"supported", "conditional", "design-decision"}:
            errors.append(f"Invalid claim status at index {index}")
        claim_source_ids = claim.get("source_ids", [])
        for source_id in claim_source_ids:
            if source_id not in source_ids:
                errors.append(f"Claim {index} has unknown source ID: {source_id}")
        source_uses = claim.get("source_uses")
        if not isinstance(source_uses, list):
            errors.append(f"Claim {index} must declare source_uses")
            source_uses = []
        used_source_ids = {use.get("source_id") for use in source_uses if isinstance(use, dict)}
        if set(claim_source_ids) != used_source_ids:
            errors.append(f"Claim {index} source_ids and source_uses must match")
        for use in source_uses:
            if not isinstance(use, dict):
                errors.append(f"Claim {index} has invalid source_use")
                continue
            source_id = use.get("source_id")
            claim_kind = use.get("claim_kind")
            source = sources_by_id.get(source_id)
            if source is None:
                continue
            if claim_kind not in source.get("allowed_claim_kinds", []):
                errors.append(f"Claim {index} exceeds source claim ceiling: {source_id} -> {claim_kind}")
        if PAYMENT_OR_DATA_SHARING.search(claim.get("claim", "")) and claim.get("explicit_approval_required") is not True:
            errors.append(f"Claim {index} requires explicit approval metadata")
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
