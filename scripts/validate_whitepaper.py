import json
import re
import sys
from pathlib import Path

PROHIBITED = (
    "원금 보장",
    "수익 보장",
    "가격 상승 보장",
    "질병 진단을 제공합니다",
)
SOURCE_PATTERN = re.compile(r"\[(S-[A-Z0-9-]+)\]")
CLAIM_PATTERN = re.compile(r"\[(C-[A-Z0-9-]+)\]")
SAFETY_CLAUSE_PATTERN = re.compile(r"[^.;!?。！？]+")
LOCAL_ASSERTION_NEGATION = re.compile(
    r"^\s*(?:(?:이|가|은|는|을|를)?\s*(?:아닙니다|아니다|아님)|(?:이|가|은|는|을|를)?\s*하지\s*않(?:습니다|는다|다|음)|(?:is|are|does|do|will)?\s*not\b)",
    re.IGNORECASE,
)
ENGLISH_PARTNERSHIP_NEGATION = re.compile(
    r"\b(?:is|are)\s+not\s+(?:an?\s+)?(?:official\s+)?partner(?:ship)?s?\s*$",
    re.IGNORECASE,
)
SAFETY_PATTERNS = (
    ("official-partner", re.compile(r"(?:Samsung|삼성)\s*(?:(?:is|are)\s+(?:not\s+)?(?:an?\s+)?)?(?:공식|official)\s*(?:파트너|partner)", re.IGNORECASE)),
    ("diagnostic", re.compile(r"(?:질병|의료|건강)(?:을|를)?\s*(?:진단|diagnos(?:e|is|tic)?)(?:을|를)?\s*(?:제공|지원|수행|실시|가능|합니다|한다|할\s*수)", re.IGNORECASE)),
    ("stablecoin-issuance-custody-exchange", re.compile(r"MODUA.{0,40}(?:스테이블코인|stablecoin).{0,60}(?:발행|수탁|커스터디|보관|매매|교환|중개|거래소)(?:을|를)?\s*(?:제공|지원|수행|실시|가능|합니다|한다|할\s*수|됩니다)", re.IGNORECASE)),
    ("private-key-wallet", re.compile(r"(?:갤럭시\s*워치|Galaxy\s*Watch|Watch).{0,80}(?:개인키|private\s*key).{0,80}(?:지갑|wallet)(?:을|를)?\s*(?:제공|지원|사용|가능|합니다|한다|할\s*수)", re.IGNORECASE)),
    ("health-data-ledger", re.compile(r"(?:건강\s*데이터|health\s*data).{0,80}(?:블록체인|blockchain|결제\s*원장|payment\s*ledger).{0,40}(?:기록|저장|전송|적재)(?:합니다|한다|됩니다|할\s*수)?", re.IGNORECASE)),
    ("hefi-implementation-or-partnership", re.compile(r"(?:HEFI|헤피).{0,60}?(?:구현|구축|통합|연동|제휴|협력|승계|기반|파트너(?:십)?|partner(?:ship)?s?)", re.IGNORECASE)),
)
PAYMENT_OR_DATA_SHARING = re.compile(
    r"(?:결제|payment|(?:데이터|정보).{0,20}(?:공유|제공|전송)|(?:공유|제공|전송).{0,20}(?:데이터|정보))",
    re.IGNORECASE,
)
LOCAL_EXPLICIT_APPROVAL = re.compile(
    r"(?:(?:사람|사용자|본인).{0,16}(?:최종|명시적).{0,16}(?:승인|확인)|(?:최종|명시적).{0,16}(?:승인|확인).{0,16}(?:사람|사용자|본인))",
    re.IGNORECASE,
)


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def document_units(text: str) -> list[str]:
    return [unit for unit in text.splitlines() if unit.strip()]


def safety_clauses(unit: str) -> list[str]:
    return [match.group().strip() for match in SAFETY_CLAUSE_PATTERN.finditer(unit) if match.group().strip()]


def is_locally_negated(clause: str, assertion: re.Match[str]) -> bool:
    return (
        LOCAL_ASSERTION_NEGATION.match(clause[assertion.end():]) is not None
        or ENGLISH_PARTNERSHIP_NEGATION.search(assertion.group()) is not None
    )


def validate(whitepaper_path: Path, sources_path: Path, claims_path: Path) -> list[str]:
    text = whitepaper_path.read_text(encoding="utf-8")
    sources = load_json(sources_path)
    claims = load_json(claims_path)
    source_ids = {entry["id"] for entry in sources}
    sources_by_id = {entry["id"]: entry for entry in sources}
    claims_by_id = {claim.get("id"): claim for claim in claims if claim.get("id")}
    errors = [f"Prohibited claim: {phrase}" for phrase in PROHIBITED if phrase in text]
    for unit in document_units(text):
        for clause in safety_clauses(unit):
            for name, pattern in SAFETY_PATTERNS:
                errors.extend(
                    f"Safety violation ({name}): {clause}"
                    for assertion in pattern.finditer(clause)
                    if not is_locally_negated(clause, assertion)
                )
        cited_source_ids = SOURCE_PATTERN.findall(unit)
        if cited_source_ids:
            claim_markers = CLAIM_PATTERN.findall(unit)
            if len(claim_markers) != 1:
                errors.append("Cited claim must include exactly one claim marker")
            else:
                cited_claim = claims_by_id.get(claim_markers[0])
                if cited_claim is None:
                    errors.append(f"Unknown claim marker: {claim_markers[0]}")
                else:
                    if cited_claim.get("claim") not in unit:
                        errors.append(f"Citation {claim_markers[0]} does not match ledger claim")
                    if set(cited_source_ids) != set(cited_claim.get("source_ids", [])):
                        errors.append(f"Citation {claim_markers[0]} source IDs do not match ledger")
                    if PAYMENT_OR_DATA_SHARING.search(unit) and cited_claim.get("explicit_approval_required") is not True:
                        errors.append(f"Claim {claim_markers[0]} requires explicit approval metadata")
                    if PAYMENT_OR_DATA_SHARING.search(unit) and not LOCAL_EXPLICIT_APPROVAL.search(unit):
                        errors.append(f"Claim {claim_markers[0]} requires local explicit approval wording")
        elif PAYMENT_OR_DATA_SHARING.search(unit) and not LOCAL_EXPLICIT_APPROVAL.search(unit):
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
