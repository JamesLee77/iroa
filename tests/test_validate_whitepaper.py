import json
from pathlib import Path

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
    whitepaper.write_text("# MODUA\n근거 문장 [S-001]", encoding="utf-8")
    write_json(sources, [{"id": "S-001", "title": "Known", "url": "https://example.com"}])
    write_json(claims, [{"claim": "근거 문장", "section": "MODUA", "source_ids": ["S-001"], "status": "supported"}])
    assert validate(whitepaper, sources, claims) == []
