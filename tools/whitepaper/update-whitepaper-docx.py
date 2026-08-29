#!/usr/bin/env python3
"""Replace the existing whitepaper's visual assets without rewriting its prose or styles."""

from __future__ import annotations

import argparse
import shutil
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
WP = "{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
PIC = "{http://schemas.openxmlformats.org/drawingml/2006/picture}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PR = "{http://schemas.openxmlformats.org/package/2006/relationships}"

NAMESPACES = {
    "wpc": "http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas",
    "mo": "http://schemas.microsoft.com/office/2008/main",
    "mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
    "mv": "urn:schemas-microsoft-com:mac:vml",
    "o": "urn:schemas-microsoft-com:office:office",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "m": "http://schemas.openxmlformats.org/officeDocument/2006/math",
    "v": "urn:schemas-microsoft-com:vml",
    "wp14": "http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "w10": "urn:schemas-microsoft-com:office:word",
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "w14": "http://schemas.microsoft.com/office/word/2010/wordml",
    "wpg": "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup",
    "wpi": "http://schemas.microsoft.com/office/word/2010/wordprocessingInk",
    "wne": "http://schemas.microsoft.com/office/word/2006/wordml",
    "wps": "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "pic": "http://schemas.openxmlformats.org/drawingml/2006/picture",
}


ASSETS = {
    "rId12": {
        "source": "docs/brand/assets/illustrations/iroa-whitepaper-cover-v1.png",
        "target": "media/image2.png",
        "alt": "사용자 요청이 AI 지원, 보안 실행, 검증 NODE, 사람 도움과 완료 증명으로 이어지는 IROA 생태계",
        "caption": "그림 1. 요청에서 검증된 결과까지 연결되는 IROA 생태계",
    },
    "rId13": {
        "source": "docs/brand/assets/illustrations/iroa-product-system-v1.png",
        "target": "media/image3.png",
        "alt": "사용자의 태블릿 요청이 보호된 AI 계획, 검증 실행, 사람 지원과 완료 증명으로 이어지는 IROA 제품 체계",
        "caption": "그림 2. 하나의 요청 상태를 공유하는 IROA 서비스·제품 체계",
    },
    "rId14": {
        "source": "docs/brand/assets/illustrations/iroa-wearable-request-v1.png",
        "target": "media/image4.png",
        "alt": "스마트워치에서 시작한 요청과 승인이 IROA NODE의 검증 결과로 돌아오는 과정",
        "caption": "그림 3. 워치 요청·승인과 검증 결과의 왕복",
    },
    "rId15": {
        "source": "docs/brand/assets/illustrations/iroa-secure-execution-v1.png",
        "target": "media/image5.png",
        "alt": "요청별 작업 보호 꾸러미가 세 개의 격리 NODE에서 실행되고 검증 증명으로 합쳐지는 보안 실행 공간",
        "caption": "그림 4. 요청별 격리 실행과 검증 증명",
    },
    "rId16": {
        "source": "docs/brand/assets/illustrations/iroa-companion-handoff-v1.png",
        "target": "media/image6.png",
        "alt": "가정용 반려기기가 사용자의 복잡한 요청을 사람 지원자에게 안전하게 인계하는 과정",
        "caption": "그림 5. 반려기기에서 사람 지원으로 이어지는 안전한 인계",
    },
    "rId17": {
        "source": "docs/brand/assets/illustrations/iroa-kiosk-settlement-v1.png",
        "target": "media/image7.png",
        "alt": "휠체어 이용자가 접근 가능한 키오스크에서 요청하고 승인한 뒤 검증된 정산과 영수증을 받는 과정",
        "caption": "그림 6. 접근 가능한 키오스크 요청·승인·정산 흐름",
    },
    "rId18": {
        "source": "docs/brand/assets/illustrations/iroa-health-consent-v1.png",
        "target": "media/image8.png",
        "alt": "사용자가 필요한 건강정보만 승인하고 보호된 요약을 의료진에게 전달하는 동의 중심 병원 연계",
        "caption": "그림 7. 사용자 동의와 의료진 판단의 경계를 지키는 병원 연계",
    },
    "rId19": {
        "source": "docs/brand/assets/illustrations/iroa-reward-community-v1.png",
        "target": "media/image9.png",
        "alt": "사용자, 도움 제공자, 기관과 인프라 NODE의 검증된 기여가 지역사회 보상으로 연결되는 생태계",
        "caption": "그림 8. 검증된 기여가 지역사회 가치와 보상으로 이어지는 생태계",
    },
    "rId46": {
        "source": "docs/whitepaper/analysis/iroa-token-allocation.png",
        "target": "media/image10.png",
        "alt": "IROA 최대 공급량 100억 개의 승인된 토큰 배분",
    },
    "rId47": {
        "source": "docs/whitepaper/analysis/iroa-token-circulating-supply.png",
        "target": "media/image11.png",
        "alt": "출시 시점부터 12년 말까지 IROA 누적 유통량 기준 시나리오",
    },
    "rId48": {
        "source": "docs/whitepaper/analysis/iroa-node-reward-dilution.png",
        "target": "media/image12.png",
        "alt": "1년 차를 100으로 본 NODE 성장 시나리오별 평균 보상 희석",
    },
}

GEOMETRY = {
    **{f"rId{index}": (6044184, 4032504) for index in range(12, 20)},
    "rId46": (5897880, 3024936),
    "rId47": (5897880, 3026465),
    "rId48": (5897880, 3029528),
}


def paragraph_text(paragraph: ET.Element) -> str:
    return "".join(node.text or "" for node in paragraph.iter(W + "t"))


def replace_paragraph_text(paragraph: ET.Element, value: str) -> None:
    text_nodes = list(paragraph.iter(W + "t"))
    if not text_nodes:
        raise ValueError("caption paragraph does not contain text")
    text_nodes[0].text = value
    for node in text_nodes[1:]:
        node.text = ""


def update_drawing(drawing: ET.Element, relationship_id: str, spec: dict[str, str]) -> None:
    doc_property = drawing.find(".//" + WP + "docPr")
    picture_property = drawing.find(".//" + PIC + "cNvPr")
    if doc_property is None or picture_property is None:
        raise ValueError("drawing metadata is missing")
    filename = Path(spec["target"]).name
    doc_property.set("descr", spec["alt"])
    doc_property.set("title", filename)
    picture_property.set("name", filename)

    extent = drawing.find(".//" + WP + "extent")
    transform_extent = drawing.find(".//" + A + "xfrm/" + A + "ext")
    if extent is None or transform_extent is None:
        raise ValueError(f"drawing extent is missing for {filename}")
    width, height = GEOMETRY[relationship_id]
    extent.set("cx", str(width))
    extent.set("cy", str(height))
    transform_extent.set("cx", str(width))
    transform_extent.set("cy", str(height))

    blip_fill = drawing.find(".//" + PIC + "blipFill")
    blip = drawing.find(".//" + A + "blip")
    if blip_fill is None or blip is None:
        raise ValueError(f"drawing crop container is missing for {filename}")
    source_ratio = 1672 / 941
    target_ratio = width / height
    crop = blip_fill.find(A + "srcRect")
    if crop is None:
        crop = ET.Element(A + "srcRect")
        blip_fill.insert(list(blip_fill).index(blip) + 1, crop)
    crop.attrib.clear()
    if target_ratio < source_ratio:
        horizontal_crop = round((1 - target_ratio / source_ratio) / 2 * 100_000)
        crop.set("l", str(horizontal_crop))
        crop.set("r", str(horizontal_crop))
    elif target_ratio > source_ratio:
        vertical_crop = round((1 - source_ratio / target_ratio) / 2 * 100_000)
        crop.set("t", str(vertical_crop))
        crop.set("b", str(vertical_crop))


def patch_document(project_root: Path, source_docx: Path, output_docx: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="iroa-whitepaper-docx-") as temp:
        temp_root = Path(temp)
        with ZipFile(source_docx) as archive:
            archive.extractall(temp_root)

        rel_path = temp_root / "word/_rels/document.xml.rels"
        document_path = temp_root / "word/document.xml"
        rel_tree = ET.parse(rel_path)
        document_tree = ET.parse(document_path)
        relationships = {node.get("Id"): node for node in rel_tree.getroot()}
        old_targets = {relationship_id: relationships[relationship_id].get("Target") for relationship_id in ASSETS}
        paragraphs = list(document_tree.getroot().iter(W + "p"))

        for paragraph_index, paragraph in enumerate(paragraphs):
            drawing = paragraph.find(".//" + W + "drawing")
            if drawing is None:
                continue
            blip = drawing.find(".//" + A + "blip")
            if blip is None:
                continue
            relationship_id = blip.get(R + "embed")
            if relationship_id not in ASSETS:
                continue
            spec = ASSETS[relationship_id]
            relationship = relationships.get(relationship_id)
            if relationship is None:
                raise ValueError(f"missing relationship {relationship_id}")
            relationship.set("Target", spec["target"])
            update_drawing(drawing, relationship_id, spec)

            if "caption" in spec:
                if paragraph_index + 1 >= len(paragraphs):
                    raise ValueError(f"caption is missing after {relationship_id}")
                replace_paragraph_text(paragraphs[paragraph_index + 1], spec["caption"])

        for relationship_id, spec in ASSETS.items():
            source_asset = project_root / spec["source"]
            if not source_asset.is_file():
                raise FileNotFoundError(source_asset)
            destination = temp_root / "word" / spec["target"]
            old_target = old_targets[relationship_id]
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source_asset, destination)
            if old_target and old_target != spec["target"]:
                old_media = temp_root / "word" / old_target
                if old_media.exists():
                    old_media.unlink()

        ET.register_namespace("", "http://schemas.openxmlformats.org/package/2006/relationships")
        rel_tree.write(rel_path, encoding="UTF-8", xml_declaration=True)
        for prefix, namespace in NAMESPACES.items():
            ET.register_namespace(prefix, namespace)
        document_tree.write(document_path, encoding="UTF-8", xml_declaration=True)

        temp_output = output_docx.with_suffix(".tmp.docx")
        if temp_output.exists():
            temp_output.unlink()
        with ZipFile(temp_output, "w", ZIP_DEFLATED) as archive:
            for file in sorted(temp_root.rglob("*")):
                if file.is_file():
                    archive.write(file, file.relative_to(temp_root).as_posix())
        temp_output.replace(output_docx)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("output")
    parser.add_argument("--project-root", default=".")
    args = parser.parse_args()
    patch_document(Path(args.project_root).resolve(), Path(args.source), Path(args.output))


if __name__ == "__main__":
    main()
