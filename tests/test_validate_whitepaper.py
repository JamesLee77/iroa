import json
from pathlib import Path

import pytest

from scripts.validate_whitepaper import validate


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")


def test_rejects_prohibited_investment_and_medical_claims(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text("# MODUA\n원금 보장과 질병 진단을 제공합니다.", encoding="utf-8")
    write_json(sources, [])
    write_json(claims, [])
    errors = validate(whitepaper, sources, claims)
    assert any("원금 보장" in error for error in errors)
    assert any("질병 진단" in error for error in errors)


def test_rejects_unknown_source_ids(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text("# MODUA\n근거 문장 [S-UNKNOWN]", encoding="utf-8")
    write_json(sources, [{"id": "S-001", "title": "Known", "url": "https://example.com"}])
    write_json(claims, [])
    errors = validate(whitepaper, sources, claims)
    assert any("S-UNKNOWN" in error for error in errors)


def test_accepts_complete_minimal_document(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text("# MODUA\n근거 문장 [C-001] [S-001]", encoding="utf-8")
    write_json(sources, [{"id": "S-001", "title": "Known", "url": "https://example.com", "allowed_claim_kinds": ["known-fact"]}])
    write_json(claims, [{"id": "C-001", "claim": "근거 문장", "section": "MODUA", "source_ids": ["S-001"], "source_uses": [{"source_id": "S-001", "claim_kind": "known-fact"}], "status": "supported"}])
    assert validate(whitepaper, sources, claims) == []


def test_rejects_positioning_and_data_safety_variants(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text(
        "# MODUA\n삼성 공식 파트너입니다. 질병을 진단합니다. MODUA 스테이블코인을 발행합니다. "
        "갤럭시 워치에 개인키 지갑을 제공합니다. 건강 데이터를 블록체인에 기록합니다.",
        encoding="utf-8",
    )
    write_json(sources, [])
    write_json(claims, [])
    errors = validate(whitepaper, sources, claims)
    assert any("official-partner" in error for error in errors)
    assert any("diagnostic" in error for error in errors)
    assert any("stablecoin" in error for error in errors)
    assert any("private-key-wallet" in error for error in errors)
    assert any("health-data-ledger" in error for error in errors)


def test_rejects_data_sharing_without_explicit_approval(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text("# MODUA\n건강 데이터를 결제 파트너와 공유합니다.", encoding="utf-8")
    write_json(sources, [])
    write_json(claims, [])
    errors = validate(whitepaper, sources, claims)
    assert any("explicit-approval" in error for error in errors)


def test_rejects_invalid_ledger_status_and_unknown_ledger_source(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text("# MODUA", encoding="utf-8")
    write_json(sources, [])
    write_json(claims, [{"claim": "근거 문장", "section": "1", "source_ids": ["S-UNKNOWN"], "status": "unreviewed"}])
    errors = validate(whitepaper, sources, claims)
    assert any("Invalid claim status" in error for error in errors)
    assert any("unknown source ID" in error for error in errors)


def test_rejects_claim_kind_outside_source_ceiling(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text("# MODUA", encoding="utf-8")
    write_json(sources, [{"id": "S-001", "title": "Known", "url": "https://example.com", "allowed_claim_kinds": ["population-baseline"]}])
    write_json(claims, [{"claim": "근거 문장", "section": "1", "source_ids": ["S-001"], "source_uses": [{"source_id": "S-001", "claim_kind": "payment-capability"}], "status": "supported"}])
    errors = validate(whitepaper, sources, claims)
    assert any("exceeds source claim ceiling" in error for error in errors)


def test_rejects_payment_or_data_sharing_claim_without_approval_metadata(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text("# MODUA", encoding="utf-8")
    write_json(sources, [])
    write_json(claims, [{"claim": "결제 파트너와 데이터를 공유한다.", "section": "12", "source_ids": [], "source_uses": [], "status": "conditional"}])
    errors = validate(whitepaper, sources, claims)
    assert any("explicit approval metadata" in error for error in errors)


def test_rejects_generic_hefi_implementation_or_partnership_claim(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text("# MODUA\nHEFI 기술을 MODUA에 구현하고 파트너십을 맺습니다.", encoding="utf-8")
    write_json(sources, [])
    write_json(claims, [])
    errors = validate(whitepaper, sources, claims)
    assert any("hefi-implementation-or-partnership" in error for error in errors)


def test_rejects_approval_on_an_unrelated_document_line(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text(
        "# MODUA\n사용자 명시적 동의를 받습니다.\n건강 데이터를 결제 파트너와 공유합니다. [C-001] [S-001]",
        encoding="utf-8",
    )
    write_json(sources, [{"id": "S-001", "title": "Known", "url": "https://example.com", "allowed_claim_kinds": ["known-fact"]}])
    write_json(claims, [{"id": "C-001", "claim": "건강 데이터를 결제 파트너와 공유합니다.", "section": "12", "source_ids": ["S-001"], "source_uses": [{"source_id": "S-001", "claim_kind": "known-fact"}], "status": "conditional"}])
    errors = validate(whitepaper, sources, claims)
    assert any("explicit approval metadata" in error for error in errors)


def test_rejects_inline_citation_that_does_not_match_ledger_claim(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text("# MODUA\n지원되지 않는 문장 [C-001] [S-001]", encoding="utf-8")
    write_json(sources, [{"id": "S-001", "title": "Known", "url": "https://example.com", "allowed_claim_kinds": ["known-fact"]}])
    write_json(claims, [{"id": "C-001", "claim": "근거 문장", "section": "1", "source_ids": ["S-001"], "source_uses": [{"source_id": "S-001", "claim_kind": "known-fact"}], "status": "supported"}])
    errors = validate(whitepaper, sources, claims)
    assert any("does not match ledger claim" in error for error in errors)


def test_accepts_explicit_negative_safety_disclaimers(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text(
        "# MODUA\n질병 진단 기능이 아닙니다. MODUA는 스테이블코인을 발행·수탁·교환하지 않습니다.",
        encoding="utf-8",
    )
    write_json(sources, [])
    write_json(claims, [])
    assert validate(whitepaper, sources, claims) == []


def test_rejects_unrelated_negation_after_positive_high_risk_assertions(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text("# MODUA\nHEFI와 제휴합니다; 제한은 없습니다. 삼성 공식 파트너입니다; 예외는 없습니다.", encoding="utf-8")
    write_json(sources, [])
    write_json(claims, [])
    errors = validate(whitepaper, sources, claims)
    assert any("hefi-implementation-or-partnership" in error for error in errors)
    assert any("official-partner" in error for error in errors)


def test_rejects_cited_sensitive_claim_with_metadata_but_no_local_approval_words(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    claim_text = "건강 데이터를 결제 파트너와 공유합니다."
    whitepaper.write_text(f"# MODUA\n{claim_text} [C-001] [S-001]", encoding="utf-8")
    write_json(sources, [{"id": "S-001", "title": "Known", "url": "https://example.com", "allowed_claim_kinds": ["known-fact"]}])
    write_json(claims, [{"id": "C-001", "claim": claim_text, "section": "12", "source_ids": ["S-001"], "source_uses": [{"source_id": "S-001", "claim_kind": "known-fact"}], "explicit_approval_required": True, "status": "conditional"}])
    errors = validate(whitepaper, sources, claims)
    assert any("local explicit approval wording" in error for error in errors)


def test_accepts_official_partner_and_hefi_negative_disclaimers(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text(
        "# MODUA\n삼성 공식 파트너가 아닙니다.\nHEFI와 제휴하지 않습니다.",
        encoding="utf-8",
    )
    write_json(sources, [])
    write_json(claims, [])
    assert validate(whitepaper, sources, claims) == []


def test_rejects_korean_and_english_hefi_partner_assertions(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text("# MODUA\nHEFI 파트너입니다.\nHEFI partner.", encoding="utf-8")
    write_json(sources, [])
    write_json(claims, [])
    errors = validate(whitepaper, sources, claims)
    assert sum("hefi-implementation-or-partnership" in error for error in errors) == 2


def test_negative_disclaimer_does_not_hide_positive_assertion_in_another_clause(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text(
        "# MODUA\n삼성 공식 파트너가 아닙니다; Samsung 공식 파트너입니다.\n"
        "HEFI와 제휴하지 않습니다; HEFI partner.",
        encoding="utf-8",
    )
    write_json(sources, [])
    write_json(claims, [])
    errors = validate(whitepaper, sources, claims)
    assert sum("official-partner" in error for error in errors) == 1
    assert sum("hefi-implementation-or-partnership" in error for error in errors) == 1
    assert any("Samsung 공식 파트너입니다" in error for error in errors)
    assert any("HEFI partner" in error for error in errors)


def test_rejects_english_samsung_official_partner_assertion(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text("# MODUA\nSamsung is an official partner.", encoding="utf-8")
    write_json(sources, [])
    write_json(claims, [])
    errors = validate(whitepaper, sources, claims)
    assert sum("official-partner" in error for error in errors) == 1


def test_accepts_english_hefi_partner_disclaimer(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text("# MODUA\nHEFI is not a partner.", encoding="utf-8")
    write_json(sources, [])
    write_json(claims, [])
    assert validate(whitepaper, sources, claims) == []


def test_english_hefi_disclaimer_does_not_hide_positive_assertion(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text("# MODUA\nHEFI is not a partner; HEFI is a partner.", encoding="utf-8")
    write_json(sources, [])
    write_json(claims, [])
    errors = validate(whitepaper, sources, claims)
    assert sum("hefi-implementation-or-partnership" in error for error in errors) == 1
    assert any("HEFI is a partner" in error for error in errors)


@pytest.mark.parametrize(
    ("statement", "violation"),
    [
        ("삼성은 MODUA의 공식 파트너입니다.", "official-partner"),
        ("Samsung과 MODUA는 공식 제휴를 맺었습니다.", "official-partner"),
        ("MODUA는 스테이블코인을 만듭니다.", "stablecoin-issuance-custody-exchange"),
        ("건강정보를 블록체인에 저장합니다.", "health-data-ledger"),
        ("대화 데이터를 블록체인에 기록합니다.", "health-data-ledger"),
    ],
)
def test_rejects_ordinary_prohibited_claim_variants(
    tmp_path: Path, statement: str, violation: str
) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text(f"# MODUA\n{statement}", encoding="utf-8")
    write_json(sources, [])
    write_json(claims, [])

    errors = validate(whitepaper, sources, claims)

    assert any(f"Safety violation ({violation})" in error for error in errors)


@pytest.mark.parametrize(
    "statement",
    [
        "삼성은 MODUA의 공식 파트너가 아닙니다.",
        "MODUA는 삼성의 공식 파트너가 아니며 관련 보증을 제공하지 않습니다.",
        "Samsung과 MODUA는 공식 제휴를 맺지 않습니다.",
        "HEFI는 MODUA의 파트너가 아닙니다.",
        "MODUA는 스테이블코인을 만들지 않습니다.",
        "MODUA는 스테이블코인을 발행·수탁·교환하지 않고 자산을 보관하지 않습니다.",
        "건강정보를 블록체인에 저장하지 않습니다.",
        "대화 데이터를 블록체인에 기록하지 않습니다.",
    ],
)
def test_accepts_local_negative_disclaimers_for_new_policy_variants(
    tmp_path: Path, statement: str
) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text(f"# MODUA\n{statement}", encoding="utf-8")
    write_json(sources, [])
    write_json(claims, [])

    assert validate(whitepaper, sources, claims) == []


def test_accepts_explicit_local_consent_for_sensitive_data_sharing(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text(
        "# MODUA\n건강 데이터 공유는 사용자 명시적 동의 후에만 가능합니다.",
        encoding="utf-8",
    )
    write_json(sources, [])
    write_json(claims, [])

    assert validate(whitepaper, sources, claims) == []


def test_rejects_unqualified_local_consent_for_sensitive_data_sharing(tmp_path: Path) -> None:
    whitepaper = tmp_path / "whitepaper.md"
    sources = tmp_path / "sources.json"
    claims = tmp_path / "claims.json"
    whitepaper.write_text(
        "# MODUA\n건강 데이터 공유는 사용자 동의 후에 가능합니다.",
        encoding="utf-8",
    )
    write_json(sources, [])
    write_json(claims, [])

    errors = validate(whitepaper, sources, claims)

    assert any("explicit-approval-required" in error for error in errors)
