# IROA.AI 브랜드 자산 안내

이 디렉터리의 BI v1.0 공식 자산은 사용자가 선택한 **Track A**에서 승격한 `masters/`와 그로부터 생성한 `exports/`다. 운영 규칙은 [한국어 BI 가이드](IROA_BI_GUIDE_KO.md), 실제 적용 인상은 [사용 예시 보드](examples/usage-overview.png), 선택 근거는 [SELECTION.md](candidates/SELECTION.md)를 기준으로 한다.

## 먼저 고를 것

| 필요 | 사용할 경로 | 편집 여부 |
|---|---|---|
| 화면·문서에 넣을 벡터 로고 | `masters/symbol`, `masters/wordmark`, `masters/lockup` | 공식 소비 기준, 단독 편집 금지 |
| 승인된 형상 변경 | `candidates/track-a/*.svg` + 승격 도구 | 브랜드 승인 후 선택 원형에서 편집 |
| 고정 크기 PNG | `exports/digital` | 편집하지 않고 표시 크기와 같은 파일 사용 |
| 파비콘·앱·워치·키오스크 | `exports/icons` | 편집·재크롭하지 않음 |
| 인쇄소·DTP 전달 | `exports/print` | 편집하지 않는 PDF 호환본 |
| 기존 경로를 쓰는 애플리케이션 | 루트 `iroa-*` 호환 파일 | 직접 편집 금지 |
| 로고 제작 과정 확인 | `candidates` | 기록 전용, 제품 사용 금지 |

## 디렉터리 상태

### `masters/` — 공식 편집 원본

9개 SVG가 BI v1.0의 공식 벡터 마스터다.

- `symbol/iroa-symbol-{color,mono,reverse}.svg`
- `wordmark/iroa-wordmark-{color,mono,reverse}.svg`
- `lockup/iroa-lockup-{color,mono,reverse}.svg`
- `lockup/CONSTRUCTION.md`는 락업 배치와 간격의 근거 문서다.

마스터는 경로(path) 기반 벡터이며 비트맵 이미지와 라이브 텍스트를 포함하지 않는다. 이 저장소에서 `masters`는 공식 소비의 단일 기준인 동시에 승격 도구가 관리하는 출력이다. 현재 승격 도구는 선택된 `candidates/track-a/*.svg`를 읽어 `masters`를 다시 쓰므로 `masters`만 손으로 바꾸지 않는다. 승인된 형상·자간·광학 보정 변경은 선택 원형과 구성 기록에서 시작하고 승격 도구로 마스터, 내보내기와 호환 파일을 함께 재생성한다. PNG나 PDF에서 역으로 편집하지 않는다.

바로 열기: [컬러 심볼](masters/symbol/iroa-symbol-color.svg), [컬러 워드마크](masters/wordmark/iroa-wordmark-color.svg), [컬러 락업](masters/lockup/iroa-lockup-color.svg).

### `exports/` — 공식 소비자 파일

`exports`는 공식 마스터에서 결정적으로 생성한 배포본이다. 소비자는 여기서 알맞은 파일을 선택하며 파일 자체를 편집하지 않는다.

- `digital/`: 심볼과 워드마크의 RGBA PNG. 각 계열에 `16, 24, 32, 48, 64, 128, 180, 192, 256, 512, 1024` 크기가 있다. 파일 숫자는 높이다.
- `icons/`: `favicon.svg`, 16/32/48px 파비콘, 180px Apple 터치 아이콘, 192/512px 앱 아이콘, 192/512px 마스크 가능 아이콘, 48px 워치 심볼, 1024px 키오스크 심볼이다.
- `print/`: 심볼·워드마크·락업의 color/mono PDF 6개다.

### `exports/print/` PDF의 호환 역할

`exports/print/*.pdf`는 인쇄·DTP 교환을 위한 **1페이지 A4 벡터 호환본**이다. 글꼴, 래스터 이미지와 편집 가능한 텍스트를 포함하지 않는다. PDF 페이지에서 로고를 다시 그리거나 색을 바꾸지 말고, 수정은 `masters` SVG에서 시작한다.

이 파일들은 [BI 가이드 Markdown](IROA_BI_GUIDE_KO.md)을 인쇄한 문서가 아니다. `IROA_BI_GUIDE_KO.pdf`는 가이드 문서 배포 호환본으로 역할이 다르며, 외부 배포 전 Markdown의 버전과 내용이 일치하는지 별도로 확인한다.

인쇄 전달용 예: [컬러 락업 PDF](exports/print/iroa-lockup-color.pdf), [단색 워드마크 PDF](exports/print/iroa-wordmark-mono.pdf).

### `candidates/` — 비배포 제작 기록

- `track-a/`는 현재 공식 BI의 선택 원형, 구성 근거와 작은 크기 검토 렌더를 보존한다. 승인된 형상 변경의 관리 입력이지만 공식 소비자는 이 폴더가 아니라 `masters`와 `exports`를 사용한다.
- `track-b/`는 선택되지 않은 제로베이스 역사적 후보이며 **비공식 자산**이다.
- `comparison/`은 과거 비교 보드와 검토 자료다.
- `SELECTION.md`는 Track A 선택과 공식 승격 상태를 기록한다.

Track B 또는 비교 보드의 일부를 공식 Track A 자산과 시각적으로 혼합하거나, 후보 파일을 제품·문서·파트너 배포물에 사용하지 않는다.

### 루트 `iroa-*` — 기존 소비자 호환 경로

| 파일 | 역할 | 공식 원본 |
|---|---|---|
| `iroa-symbol.svg` | 기존 SVG 심볼 경로 | `masters/symbol/iroa-symbol-color.svg`와 바이트 동일 |
| `iroa-wordmark.svg` | 기존 SVG 워드마크 경로 | `masters/wordmark/iroa-wordmark-color.svg`와 바이트 동일 |
| `iroa-wordmark-mono.svg` | 기존 단색 워드마크 경로 | 공식 mono 마스터와 바이트 동일 |
| `iroa-wordmark-reverse.svg` | 기존 역상 워드마크 경로 | 공식 reverse 마스터와 바이트 동일 |
| `iroa-symbol.png` | 512×512 기존 PNG 경로 | 공식 컬러 심볼에서 재생성 |
| `iroa-wordmark.png` | 1200×360 기존 PNG 경로 | 공식 컬러 워드마크에서 재생성 |

호환 파일은 별도의 편집 원본이 아니다. 직접 바꾸면 다음 공식 재생성 때 덮어써지거나 마스터와 불일치하므로, 항상 `masters`에서 수정한다.

### 기타 콘텐츠

- `IROA_BI_GUIDE_KO.md`: BI v1.0 콘텐츠의 단일 원본.
- `IROA_BI_GUIDE_KO.docx`, `IROA_BI_GUIDE_KO.pdf`: 문서 배포 호환본. 외부 배포 전 Markdown과 버전·내용 일치 여부를 확인한다.
- `examples/usage-overview.png`: 공식 자산만 사용한 웹·앱·워치·키오스크·문서 적용 예시. 마스터나 화면 구현 사양은 아니다.
- `assets/photos/`: 사진과 [출처·대체 텍스트 목록](assets/photos/PHOTO-MANIFEST.md). 로고 자산이 아니다.

## 플랫폼별 빠른 선택

| 플랫폼 | 파일 |
|---|---|
| 웹 헤더 | `masters/wordmark/iroa-wordmark-color.svg` |
| 브라우저 파비콘 | `exports/icons/favicon.svg` + `favicon-16.png`, `favicon-32.png`, `favicon-48.png` |
| iOS 터치 아이콘 | `exports/icons/apple-touch-icon-180.png` |
| 앱 아이콘 | `exports/icons/app-icon-192.png`, `app-icon-512.png` |
| Android/PWA 마스크 가능 아이콘 | `exports/icons/maskable-icon-192.png`, `maskable-icon-512.png` |
| 워치 | `exports/icons/symbol-watch-48.png` |
| 키오스크 | `exports/icons/symbol-kiosk-1024.png` 또는 공식 락업 SVG |
| 디지털 문서 | 공식 SVG 마스터 |
| 단색 인쇄·영수증 | 공식 mono SVG 또는 `exports/print/*-mono.pdf` |

## 변경·검증 절차

1. [SELECTION.md](candidates/SELECTION.md)의 공식 선택을 확인한다.
2. 필요한 형상 수정은 브랜드 승인 후 선택 원형 `candidates/track-a/*.svg`와 구성 기록에서 수행한다. `masters`만 직접 바꾸지 않는다.
3. `python3 tools/brand/promote_candidate.py --winner track-a`로 관리 대상 내보내기와 호환 파일을 재생성한다.
4. `python3 tools/brand/audit_assets.py official`로 인벤토리, SVG, PNG, 아이콘 안전 영역과 PDF 호환성을 감사한다.
5. 전체 브랜드 테스트와 Markdown 상대 링크 검사를 실행한다.

도메인 보유, 상표권, 파트너십, 인증과 접근성 인증은 자산 파일의 존재로 자동 확정되지 않는다. 법적·운영 상태는 [BI 가이드의 도메인과 상표권 상태](IROA_BI_GUIDE_KO.md#12-도메인과-상표권-상태)를 따른다.
