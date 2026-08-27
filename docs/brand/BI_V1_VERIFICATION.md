# IROA.AI BI v1.0 최종 검증 영수증

검증일: 2026-08-27
검증 기준 커밋: `206428bd2f3bc46d9f0622bc75a0518896bac25f` (`test: require exact guide PDF binding`)

## 판정 범위

- 공식 BI 선택: [SELECTION.md](candidates/SELECTION.md)의 사용자 결정대로 **Track A** (`winner: track-a`)만 공식 승격 대상이다.
- 이 영수증이 확인하는 범위는 저장소 안의 소스·관리 출력·문서 배포 호환본이다. 즉 Track A 원형에서 공식 `masters/`, `exports/`, 루트 호환 경로, 가이드와 비교 자료가 현재 계약에 맞는지를 재현한다.
- `iroa.ai` 도메인은 확보 완료 상태다. 그러나 도메인 보유는 상표권 확보와 별개이며, 상표 선행조사·출원/등록 상태·법률 검토는 이 검증으로 완료되지 않는다.
- 라이브 배포/소비자 통합, 실제 사용자 대상 접근성 검증과 접근성 인증도 이 소스·산출물 검증의 범위 밖이다. 아래 WCAG 값은 명시한 sRGB 조합의 계산값이지 제품 전체 인증이 아니다.

## 이력과 선택 근거

다음은 이 BI v1 작업 범위의 정확한 커밋이다. 마지막 Task 8 문서 커밋은 이 영수증에 별도로 기록된다.

| 단계 | 커밋 |
|---|---|
| 감사 도구 | `276575427c89e795e554ad69bb4f7750af8876c6`, `55813dfa41009f035fea586be161b1392c853a08` |
| Track A | `01d1dbd9fe7e86a20c78dab5b0edfc24e931fba6`, `876375bdaee86e34472905d00a494cb8dd47810a` |
| Track B (비공식 탐색) | `e4d73d8ec0fb66113de165e5f9166c1b701f0bf1`, `956f20ffa8b19990543111296ae6b7c02acffd43` |
| 비교와 Track A 선택 | `84f4e8aa75082d488ea82ed23054c95c9a15a994`, `184f43e9ad61f6b7492aba8b275f9a2f109a0499`, `01acc3d8d5e0e37de0d35d8f0905514f57fc6e61`, `91f4e594be4cff18f09e167cf94bed59ce870516`, `77b6c641a2d4c3d733f80bd73c68d827276328a9` |
| Track A 공식 승격 | `b4d8ce4b7623cdec15a102613aee892a42816cae`, `6cbff620757a61cb85cad4d47dcd8662323c2189` |
| 가이드·예시 보드 | `2ef82b9b8e834d88ee0f75096a4489cb089cdba2`, `0108782871e3c141f96192c03f31a8330899f427`, `b5cdb909641ed8e45c7b63c8a85d788bb2cdbb3e` |
| DOCX/PDF 배포 바인딩 | `5ea78c4f8087e3f72f956a68d415728568cb9d54`, `5c7b3c7041672a2f73764d8d15c4a7dc56ec30d6`, `206428bd2f3bc46d9f0622bc75a0518896bac25f` |

Track B는 `candidates/track-b/`와 비교 기록에만 남는다. 최종 감사에서 `masters/` 및 `exports/` 경로·텍스트를 각각 검색해 Track B 참조가 없음을 확인했다.

## 재현 명령과 결과

아래 명령은 이 영수증 작성 중 기준 커밋에서 새로 실행했다.

```bash
python3 tools/brand/audit_assets.py official
# official asset audit passed

python3 -m unittest discover -s tests/brand -p 'test_*.py' -v
# Ran 63 tests in 40.645s
# OK

python3 tools/brand/verify_comparison.py docs/brand/candidates/comparison/iroa-bi-candidates.html
# track-a ink-ratio=0.622558594; track-b=0.750000000
# Track B optical factor=0.830078125; eight paired scenes differ by 0px

python3 -m unittest \
  tests.brand.test_brand_assets.BrandContractTest.test_guide_distribution_pdf_exactly_matches_authoritative_docx_conversion \
  tests.brand.test_brand_assets.BrandContractTest.test_guide_packaged_renderer_stays_within_compatibility_tolerances -v
# Ran 2 tests in 29.864s
# OK

python3 -m unittest \
  tests.brand.test_brand_assets.BrandContractTest.test_brand_document_relative_links_resolve \
  tests.brand.test_brand_assets.BrandContractTest.test_guide_official_inventory_is_exactly_the_49_managed_files -v
# Ran 2 tests in 0.001s
# OK

python3 -m py_compile tools/brand/build_guide.py tests/brand/test_brand_assets.py
git diff --check b1d7754..HEAD
git diff --check
# all exit 0
```

공식 감사는 10개 마스터, 22개 디지털 PNG, 11개 아이콘, 6개 인쇄 PDF의 정확한 파일 집합을 닫힌 실패 방식으로 검사한다. SVG는 title/desc/viewBox와 path 기반 벡터만 허용하고, 라이브 텍스트·래스터 참조를 거부한다. PNG는 정해진 RGBA 크기와 투명도, 마스크 가능 아이콘의 10% 안전 영역을 검사한다. 인쇄 PDF는 1쪽 A4, 비어 있지 않은 벡터 패스, 글꼴·텍스트 연산·이미지 XObject 부재, Poppler 무오류 렌더를 요구한다.

## 호환 경로와 공식 인벤토리

다음 루트 SVG 호환 파일은 현재 공식 마스터와 `cmp`로 바이트 동일을 확인했다.

```bash
cmp docs/brand/iroa-symbol.svg docs/brand/masters/symbol/iroa-symbol-color.svg
cmp docs/brand/iroa-wordmark.svg docs/brand/masters/wordmark/iroa-wordmark-color.svg
cmp docs/brand/iroa-wordmark-mono.svg docs/brand/masters/wordmark/iroa-wordmark-mono.svg
cmp docs/brand/iroa-wordmark-reverse.svg docs/brand/masters/wordmark/iroa-wordmark-reverse.svg
# all exit 0, no output
```

| 루트 호환 파일 | SHA-256 | 공식 대응 |
|---|---|---|
| `iroa-symbol.svg` | `9287edb52fb8f1f98ff5b7f413ca3042ac55c692e0999194965424b9e4f0ed07` | `masters/symbol/iroa-symbol-color.svg`와 바이트 동일 |
| `iroa-wordmark.svg` | `68f5e8c58961d7d4229009f824cafbae030a6553a15875932de98139c9ee66d0` | `masters/wordmark/iroa-wordmark-color.svg`와 바이트 동일 |
| `iroa-wordmark-mono.svg` | `cf4a1b76a8a995c81ec5a2cfc28600ab25b398576e9572a2b1d8f4e67a8a10e3` | 공식 mono 마스터와 바이트 동일 |
| `iroa-wordmark-reverse.svg` | `d7db338bdc6a9d8d30768d8471497a26a730d7ac2b9f885d864b7150dadc50eb` | 공식 reverse 마스터와 바이트 동일 |
| `iroa-symbol.png` | `9cd1c783d06ad629718a49a61c5e2cd4e6e61fb5fe5da05485f6cb65ccb5ab52` | 공식 컬러 심볼에서 직접 렌더한 512×512 RGBA 파일 |
| `iroa-wordmark.png` | `1717ea28be0f35e67a78dfc5c322aa861d105301b9da6880c1c0b02e56043ffa` | 공식 컬러 워드마크에서 직접 렌더한 1200×360 RGBA 파일 |

아래는 공식 관리 출력의 정확한 49개 파일과 기준 SHA-256이다. 호환 루트 파일, 후보·비교·예시·가이드 파일은 이 49개 관리 출력 계약에 포함하지 않는다.

| 관리 경로 | SHA-256 |
|---|---|
| `masters/lockup/CONSTRUCTION.md` | `d0ea4a3a7c45aed5d7f308c68cbb58d3068f9bdf87dbb9955307e6ae6cef15fb` |
| `masters/lockup/iroa-lockup-color.svg` | `3fd84bbc46b9cff3a405a12fae5d45a49ce015a35e95ea03cce2274b1b3f6ebe` |
| `masters/lockup/iroa-lockup-mono.svg` | `7582930415db109a26ea4075e7845c8e739bb79a8eae8f110207315c033e9da3` |
| `masters/lockup/iroa-lockup-reverse.svg` | `c0f05f011bc73755e5a356a422a13ac7e284e04526c0ea176bbc585ca422f06b` |
| `masters/symbol/iroa-symbol-color.svg` | `9287edb52fb8f1f98ff5b7f413ca3042ac55c692e0999194965424b9e4f0ed07` |
| `masters/symbol/iroa-symbol-mono.svg` | `e73554890a3b9d408624fc924394ec3f20c78a9df5499658754db3fe06184f00` |
| `masters/symbol/iroa-symbol-reverse.svg` | `b17e88e088f8855782b84c721a238cc8152b53f57d19b718a07288572779b057` |
| `masters/wordmark/iroa-wordmark-color.svg` | `68f5e8c58961d7d4229009f824cafbae030a6553a15875932de98139c9ee66d0` |
| `masters/wordmark/iroa-wordmark-mono.svg` | `cf4a1b76a8a995c81ec5a2cfc28600ab25b398576e9572a2b1d8f4e67a8a10e3` |
| `masters/wordmark/iroa-wordmark-reverse.svg` | `d7db338bdc6a9d8d30768d8471497a26a730d7ac2b9f885d864b7150dadc50eb` |
| `exports/digital/iroa-symbol-16.png` | `fa0961cda6540e93eb285c2f29c138932fce1e326cf23fb989afb2ba0b0c1458` |
| `exports/digital/iroa-symbol-24.png` | `beef895b3f4bfddb689772037a74aa92d8d4cd629551639d48095eb48ecab203` |
| `exports/digital/iroa-symbol-32.png` | `634bbdc7b4cb2d6937ddace8f3387b0db2c3bdfa44aa38a6a6c93287ae26cdfd` |
| `exports/digital/iroa-symbol-48.png` | `367131165bda091100878b8be4cd7c0ae0051ff53d9f2b3858569761701fd01e` |
| `exports/digital/iroa-symbol-64.png` | `b0d87073349297c0d7713701b049137347d65d9b7932f666bc73a5d5b920ff50` |
| `exports/digital/iroa-symbol-128.png` | `0ff77cfbaa7d6101a8dc9eae10f5964923046ab0b0581e317708a81e6000cea5` |
| `exports/digital/iroa-symbol-180.png` | `35a4f93076caa61f731b5dda269d2c510f4878efa8579cf5ce7243bcecc9ffe8` |
| `exports/digital/iroa-symbol-192.png` | `d4cf0404f9b7051e85128349f732789b238331c4a7041baa2ad8c4a6ee7aa53b` |
| `exports/digital/iroa-symbol-256.png` | `893329a01f97924bb381f7cf26015351cd901f55153263dd1b0c8e3a57c7ec39` |
| `exports/digital/iroa-symbol-512.png` | `9cd1c783d06ad629718a49a61c5e2cd4e6e61fb5fe5da05485f6cb65ccb5ab52` |
| `exports/digital/iroa-symbol-1024.png` | `0a6b23c32e803a39ae3b7892c8adc755aa8cc267dafd8c980e430015ed10aedf` |
| `exports/digital/iroa-wordmark-16.png` | `3db4f4401255e5a2ad79340a0c8bd0769c51506d4e6a307edd087ba65055cb85` |
| `exports/digital/iroa-wordmark-24.png` | `f055c47fe3c4d98b504bdfefb417bc521bb34e383c10ce464e57ad794bff0fc7` |
| `exports/digital/iroa-wordmark-32.png` | `809fca5908905a92b38aa5fdd7525955237a8060e442ce15fd7636f4b6b05112` |
| `exports/digital/iroa-wordmark-48.png` | `43ab5fc9da9a2aaa80a73f81a9d6661b8de3e76ba89dc539810ae01b41f13dfd` |
| `exports/digital/iroa-wordmark-64.png` | `1671f910cf49f4b49c0fb847be48a43522ff5718809fcb1727882e4dcefaec7b` |
| `exports/digital/iroa-wordmark-128.png` | `ea4e0d4413be34dd52b976a059cef7f3085679b0f127accc740da543a289a666` |
| `exports/digital/iroa-wordmark-180.png` | `219679133cda5332d3316e0b551737e1e2e15ec0e955c317f202b96f8b8a6360` |
| `exports/digital/iroa-wordmark-192.png` | `bb017f0ad8741fa50702438d4b1fd64f574df39d090792e10d82bd0706e693e7` |
| `exports/digital/iroa-wordmark-256.png` | `4451958e7afa818a42816f135271ca6ee4fcb59739e86992b4cbf0337a3a3c26` |
| `exports/digital/iroa-wordmark-512.png` | `7cbeab2d53bd953666b26b4d8e324dce82bafa5b6dbd4b6ae08380b6aa4ce09b` |
| `exports/digital/iroa-wordmark-1024.png` | `ad09e817343879c0ad92008b447aac3933a9457540b6a1e113ffa8183c710422` |
| `exports/icons/app-icon-192.png` | `d4cf0404f9b7051e85128349f732789b238331c4a7041baa2ad8c4a6ee7aa53b` |
| `exports/icons/app-icon-512.png` | `9cd1c783d06ad629718a49a61c5e2cd4e6e61fb5fe5da05485f6cb65ccb5ab52` |
| `exports/icons/apple-touch-icon-180.png` | `35a4f93076caa61f731b5dda269d2c510f4878efa8579cf5ce7243bcecc9ffe8` |
| `exports/icons/favicon-16.png` | `fa0961cda6540e93eb285c2f29c138932fce1e326cf23fb989afb2ba0b0c1458` |
| `exports/icons/favicon-32.png` | `634bbdc7b4cb2d6937ddace8f3387b0db2c3bdfa44aa38a6a6c93287ae26cdfd` |
| `exports/icons/favicon-48.png` | `367131165bda091100878b8be4cd7c0ae0051ff53d9f2b3858569761701fd01e` |
| `exports/icons/favicon.svg` | `9287edb52fb8f1f98ff5b7f413ca3042ac55c692e0999194965424b9e4f0ed07` |
| `exports/icons/maskable-icon-192.png` | `d4cf0404f9b7051e85128349f732789b238331c4a7041baa2ad8c4a6ee7aa53b` |
| `exports/icons/maskable-icon-512.png` | `9cd1c783d06ad629718a49a61c5e2cd4e6e61fb5fe5da05485f6cb65ccb5ab52` |
| `exports/icons/symbol-kiosk-1024.png` | `0a6b23c32e803a39ae3b7892c8adc755aa8cc267dafd8c980e430015ed10aedf` |
| `exports/icons/symbol-watch-48.png` | `367131165bda091100878b8be4cd7c0ae0051ff53d9f2b3858569761701fd01e` |
| `exports/print/iroa-lockup-color.pdf` | `7a0ba2d8150117d7b226cab9dd2910185c7e5d37fb42b0d19d0c5af69cefb209` |
| `exports/print/iroa-lockup-mono.pdf` | `cc5633c7e69b3eaf639869a844c3f4e0f609be90d9dd2687a06d56252343cf21` |
| `exports/print/iroa-symbol-color.pdf` | `184f71a3d609d2ee75a0fa0d59445f44a3605ee1a7b38f9e286c799c2b326495` |
| `exports/print/iroa-symbol-mono.pdf` | `ac7fa6d28739d6cfdbdaafdac9987e6d4cfe9c6340006e0baa7828d727755f3a` |
| `exports/print/iroa-wordmark-color.pdf` | `e5120f3409762030a5eb1598fcaa209a5abd3d9ce22925362554ac87ef5754e9` |
| `exports/print/iroa-wordmark-mono.pdf` | `50d7ce2b419271836ad7fab03ecbcd681737da1faabe5bc1bb0f38041f21f008` |

## 네이티브 검사와 시각 확인 범위

- SVG: 9개 공식 마스터와 `favicon.svg`의 viewBox를 확인했다. 심볼은 `160×160`, 워드마크는 `600×180`, 락업은 `760×180`이며, 공식 감사가 path-only·접근성 메타데이터·비래스터 계약을 통과했다. 컬러 락업 SVG를 별도 PNG로 렌더해 확인했다.
- PNG: 공식 디지털·아이콘 32개와 루트 PNG 2개, 총 34개를 RGBA와 네이티브 크기로 검사했다. 루트 심볼은 `512×512`, 루트 워드마크는 `1200×360`이다. 1024px 심볼과 워드마크를 원본 크기로 확인했다.
- 인쇄 PDF: color/mono 심볼·워드마크·락업 **6개 전부** `pdfinfo`, `pdffonts`, Poppler 렌더로 검사했다. 각각 1쪽 A4, 글꼴 행 0, Poppler stderr 0 bytes였다. 컬러 락업의 렌더도 육안으로 확인했다.
- 비교 PDF: 2쪽 표준 A4, 글꼴 행 0, Poppler stderr 0 bytes였다. 두 비교 보드의 렌더를 확인했으며 비교 검증기는 8개 씬에서 Track A/B 워드마크 잉크 높이 차이 `0px`를 보고했다. 비교 PDF는 호환성 목적의 이미지 기반 PDF이며, 공식 관리 디렉터리의 소비자 자산은 아니다.
- 가이드 DOCX/PDF: 문서 PDF는 15쪽 A4, `LibreOffice 26.2.5.2 (AARCH64)` 산출본이며 Poppler stderr 0 bytes다. `pdffonts`는 NotoSansKR-Bold, NotoSansKR-Medium 두 subset 및 의도된 Helvetica만 보이고 모든 행이 `emb/sub/uni=yes`다. DOCX의 A4 토큰·실제 번호 매기기·정확한 표 geometry·공식 inline 이미지와 alt text·고정 Noto 글꼴 내장·스타일 상속 계약 6개를 재실행해 통과했다. DOCX 접근성 감사 결과는 high/medium/low=`0/0/0`이다.
- 배포 바인딩: 고정 LibreOffice 변환본과 커밋 PDF는 15/15쪽 정규화 텍스트·페이지 geometry·144dpi 래스터가 페이지별 완전히 일치해야 하는 권위 계약을 통과했다. 독립 패키지 렌더러는 호환성 진단으로 A4/geometry를 유지하고 `NMAE ≤ 0.003`, material pixel fraction `≤ 0.015` 계약을 통과했다. DOCX와 배포 PDF SHA-256은 각각 `d0af00795ca94c886a19dc432c1f6964d4e40dd1c98bfcae0ab5e45ffb098066`, `d67d279f2becfe0c762b288f03ec0e3fa278461f83cf25174af8a31801685e5d`다.
- 최종 렌더 검토: DOCX와 PDF의 1·8·15쪽, 비교 PDF의 1·2쪽, 컬러 인쇄 락업 PDF, 공식 SVG/1024px PNG 대표본을 원본 해상도로 확인했다. 페이지 잘림·겹침·표 경계 침범·한글 glyph 누락·머리말/바닥글 드리프트나 브랜드 형상 드리프트를 발견하지 못했다.

## 대비값과 문서 텍스트 계약

가이드의 필수 상태 문구는 다음 명령으로 현재 파일에서 재확인했다.

```bash
rg -n "버전: 1.0|iroa.ai 도메인은 확보 완료|상표권 확보와는 별개의 문제" docs/brand/IROA_BI_GUIDE_KO.md
# 3, 344행에서 모두 확인
```

가이드에 게재하고 테스트로 재계산한 WCAG 2.x sRGB 대비값은 `Ink/Ivory 14.48:1`, `Navy/Ivory 13.75:1`, `Navy/White 15.23:1`, `White/Navy 15.23:1`, `Light Teal/Navy 8.34:1`, `Coral/Navy 5.12:1`, `Teal/White 4.02:1`, `Teal/Ivory 3.63:1`, `Coral/White 2.98:1`이다. 일반 텍스트 `4.5:1`, 큰 텍스트와 비텍스트 UI·그래픽 `3:1` 기준을 구분한다.

## 작업트리 보존과 보류 항목

`git status --short`로 이 작업트리가 검증 시작 시 깨끗했음을 확인했다. 주 저장소 `/Users/hyunsuklee/Developer/web3/iroa`에서는 기존 미추적 협약서 DOCX 2개가 계속 미추적 상태임을 이름만 확인했고, 내용을 읽거나 수정·추가하지 않았다. `git diff --name-only b1d7754..HEAD`에서도 해당 파일이 이 BI 브랜치 커밋 범위에 포함되지 않음을 확인했다.

다음 보류 minor는 이 영수증의 공식 소스·산출물 판정을 바꾸지 않아 수정하지 않고 최종 검토로 이관한다.

1. Track B 후보의 geometry signature는 `fill-rule`/`transform` 같은 기하 영향 속성까지 서명하지 않는다. Track B는 공식 관리 경로에 없으므로 Track A 공식 인벤토리와 소비자 자산 판정에는 영향을 주지 않는다.
2. 비교 검증기는 토큰 산술과 렌더 잉크 높이를 검증하지만 모든 live DOM selector 결합까지 자동 검증하지 않는다. 현재 비교 PDF와 두 보드는 별도 렌더·native 검사 범위를 통과했으나, 비교 HTML을 장래 수정할 경우 DOM 결합 검증을 추가 검토한다.
3. Task 5의 무시되는 작업 보고서는 선택 컬러 마스터가 후보와 바이트 복사라고 서술하지만, 실제 현재 계약은 경로 정규화 후 픽셀 동일 기하와 루트 호환 파일의 바이트 동일성이다. 과거 SDD 보고서는 이 Task에서 문구만 고치지 않는다.

공식 SVG의 `<text>` 금지, 16px 구성 설명, 심볼 action point 설명은 후속 공식 감사·가이드·마스터 검증에서 이미 해소된 항목이다.
