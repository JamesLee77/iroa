# IROA.AI 브랜드 자산 안내

이 디렉터리의 BI v1.0 공식 자산은 사용자가 선택한 **Track A**에서 승격한 `masters/`와 그로부터 생성한 `exports/`다. 운영 규칙은 [한국어 BI 가이드](IROA_BI_GUIDE_KO.md), 실제 적용 인상은 [사용 예시 보드](examples/usage-overview.png), 선택 근거는 [SELECTION.md](candidates/SELECTION.md)를 기준으로 한다. 현재 소스·관리 출력·문서 배포본의 재현 검증 범위와 외부 게이트는 [BI v1.0 최종 검증 영수증](BI_V1_VERIFICATION.md)에 기록한다.

## 저장소 역할 계약

| 경로 | 역할 | 직접 편집 | 다음 단계 |
|---|---|---|---|
| `candidates/track-a` | `approved-editable-input` | 예 | `promotion → masters/exports → verify` |
| `masters` | `managed-output` | 아니오 | `promotion-generated` |
| `exports` | `managed-output` | 아니오 | `promotion-generated` |

승인된 편집 입력은 Track A 구성 파일 하나뿐이다. 작업 순서는 **승인된 Track A 구성 입력 편집 → 승격 도구 실행 → masters/exports 재생성 → 공식 감사와 테스트**다. `masters`, `exports`와 루트 호환 파일은 관리되는 출력이므로 직접 편집하지 않는다.

## 먼저 고를 것

| 필요 | 사용할 경로 | 편집 여부 |
|---|---|---|
| 화면·문서에 넣을 벡터 로고 | `masters/symbol`, `masters/wordmark`, `masters/lockup` | 공식 소비 기준, 단독 편집 금지 |
| 승인된 형상 변경 | `candidates/track-a` + 승격 도구 | 브랜드 승인 후 선택 원형에서 편집 |
| 고정 크기 PNG | `exports/digital` | 편집하지 않고 표시 크기와 같은 파일 사용 |
| 파비콘·앱·워치·키오스크 | `exports/icons` | 편집·재크롭하지 않음 |
| 인쇄소·DTP 전달 | `exports/print` | 편집하지 않는 PDF 호환본 |
| 기존 경로를 쓰는 애플리케이션 | 루트 `iroa-*` 호환 파일 | 직접 편집 금지 |
| 로고 제작 과정 확인 | `candidates` | 기록 전용, 제품 사용 금지 |

## 디렉터리 상태

### `masters/` — 공식 관리 출력

9개 SVG가 BI v1.0의 공식 벡터 마스터다.

- 심볼 color/mono/reverse 3개는 `masters/symbol`에 있다.
- 워드마크 color/mono/reverse 3개는 `masters/wordmark`에 있다.
- 락업 color/mono/reverse 3개는 `masters/lockup`에 있다.
- `masters/lockup/CONSTRUCTION.md`는 락업 배치와 간격의 근거 문서다.

마스터는 경로(path) 기반 벡터이며 비트맵 이미지와 라이브 텍스트를 포함하지 않는다. 이 저장소에서 `masters`는 공식 소비 기준이지만 승격 도구가 관리하는 출력이다. 현재 승격 도구는 선택된 `candidates/track-a` 구성 입력을 읽어 `masters`를 다시 쓴다. 승인된 형상·자간·광학 보정 변경은 Track A 구성 입력에서 시작하고 승격 도구로 마스터, 내보내기와 호환 파일을 함께 재생성한다. `masters`, PNG 또는 PDF를 직접 편집하지 않는다.

바로 열기: [컬러 심볼](masters/symbol/iroa-symbol-color.svg), [컬러 워드마크](masters/wordmark/iroa-wordmark-color.svg), [컬러 락업](masters/lockup/iroa-lockup-color.svg).

### `exports/` — 공식 소비자 파일

`exports`는 공식 마스터에서 결정적으로 생성한 배포본이다. 소비자는 여기서 알맞은 파일을 선택하며 파일 자체를 편집하지 않는다.

- `digital/`: 심볼과 워드마크의 RGBA PNG. 각 계열에 `16, 24, 32, 48, 64, 128, 180, 192, 256, 512, 1024` 크기가 있다. 파일 숫자는 높이다.
- `icons/`: `exports/icons/favicon.svg`, 16/32/48px 파비콘, 180px Apple 터치 아이콘, 192/512px 앱 아이콘, 192/512px 마스크 가능 아이콘, 48px 워치 심볼, 1024px 키오스크 심볼이다.
- `print/`: 심볼·워드마크·락업의 color/mono PDF 6개다.

크기별 전용 형상은 없다. 하나의 승인된 Track A 구성 형상이 모든 크기의 마스터와 내보내기에 사용되며, 16·24·32px PNG도 기하를 바꾸지 않고 같은 형상을 래스터화한다.

### `exports/print/` PDF의 호환 역할

`exports/print`의 6개 PDF는 인쇄·DTP 교환을 위한 **1페이지 A4 벡터 호환본**이다. 글꼴, 래스터 이미지와 편집 가능한 텍스트를 포함하지 않는다. PDF 페이지에서 로고를 다시 그리거나 색을 바꾸지 않는다. 변경은 승인된 Track A 구성 입력에서 시작하고 승격 도구로 PDF까지 다시 생성한다.

이 파일들은 [BI 가이드 Markdown](IROA_BI_GUIDE_KO.md)을 인쇄한 문서가 아니다. `IROA_BI_GUIDE_KO.pdf`는 가이드 문서 배포 호환본으로 역할이 다르며, 외부 배포 전 Markdown의 버전과 내용이 일치하는지 별도로 확인한다.

인쇄 전달용 예: [컬러 락업 PDF](exports/print/iroa-lockup-color.pdf), [단색 워드마크 PDF](exports/print/iroa-wordmark-mono.pdf).

### `candidates/` — 비배포 제작 기록

- `track-a/`는 현재 공식 BI의 선택 원형, 구성 근거와 작은 크기 검토 렌더를 보존한다. 승인된 형상 변경의 관리 입력이지만 공식 소비자는 이 폴더가 아니라 `masters`와 `exports`를 사용한다.
- `track-b/`는 선택되지 않은 제로베이스 역사적 후보이며 **비공식 자산**이다.
- `comparison/`은 과거 비교 보드와 검토 자료다.
- [SELECTION.md](candidates/SELECTION.md)는 Track A 선택과 공식 승격 상태를 기록한다.

Track B 또는 비교 보드의 일부를 공식 Track A 자산과 시각적으로 혼합하거나, 후보 파일을 제품·문서·파트너 배포물에 사용하지 않는다.

### 루트 `iroa-*` — 기존 소비자 호환 경로

| 파일 | 역할 | 공식 대응 출력 |
|---|---|---|
| `iroa-symbol.svg` | 기존 SVG 심볼 경로 | `masters/symbol/iroa-symbol-color.svg`와 바이트 동일 |
| `iroa-wordmark.svg` | 기존 SVG 워드마크 경로 | `masters/wordmark/iroa-wordmark-color.svg`와 바이트 동일 |
| `iroa-wordmark-mono.svg` | 기존 단색 워드마크 경로 | 공식 mono 마스터와 바이트 동일 |
| `iroa-wordmark-reverse.svg` | 기존 역상 워드마크 경로 | 공식 reverse 마스터와 바이트 동일 |
| `iroa-symbol.png` | 512×512 기존 PNG 경로 | 공식 컬러 심볼에서 재생성 |
| `iroa-wordmark.png` | 1200×360 기존 PNG 경로 | 공식 컬러 워드마크에서 재생성 |

호환 파일은 별도의 편집 입력이 아니다. 직접 바꾸면 다음 공식 재생성 때 덮어써지거나 마스터와 불일치한다. 변경은 승인된 Track A 구성 입력에서 시작해 승격 도구로 호환 파일까지 다시 생성한다.

### 기타 콘텐츠

- `IROA_BI_GUIDE_KO.md`: BI v1.0 콘텐츠의 단일 원본.
- `IROA_BI_GUIDE_KO.docx`, `IROA_BI_GUIDE_KO.pdf`: 문서 배포 호환본. 외부 배포 전 Markdown과 버전·내용 일치 여부를 확인한다.
- `examples/usage-overview.png`: 공식 자산만 사용한 웹·앱·워치·키오스크·문서 적용 예시. 마스터나 화면 구현 사양은 아니다.
- `examples/usage-overview-manifest.json`: 예시 보드가 소비한 공식 자산, 장면 영역과 모든 텍스트 대비 검증값.
- `tools/brand/build_usage_overview.py`: 위 PNG와 manifest를 같은 입력에서 결정적으로 생성하는 빌더.
- `assets/fonts/`: 예시 보드 전용 고정 Noto Sans KR 바이너리와 라이선스. 출처·SHA-256·재배포 근거는 [`assets/fonts/SOURCE.md`](assets/fonts/SOURCE.md)에 있으며, 빌더는 이 파일들만 사용하고 해시가 다르면 중단한다.
- `assets/photos/`: 사진과 [출처·대체 텍스트 목록](assets/photos/PHOTO-MANIFEST.md). 로고 자산이 아니다.

## 플랫폼별 빠른 선택

| 플랫폼 | 파일 |
|---|---|
| 웹 헤더 | `masters/wordmark/iroa-wordmark-color.svg` |
| 브라우저 파비콘 | `exports/icons/favicon.svg`, `exports/icons/favicon-16.png`, `exports/icons/favicon-32.png`, `exports/icons/favicon-48.png` |
| iOS 터치 아이콘 | `exports/icons/apple-touch-icon-180.png` |
| 앱 아이콘 | `exports/icons/app-icon-192.png`, `exports/icons/app-icon-512.png` |
| Android/PWA 마스크 가능 아이콘 | `exports/icons/maskable-icon-192.png`, `exports/icons/maskable-icon-512.png` |
| 워치 | `exports/icons/symbol-watch-48.png` |
| 키오스크 | `exports/icons/symbol-kiosk-1024.png` 또는 공식 락업 SVG |
| 디지털 문서 | 공식 SVG 마스터 |
| 단색 인쇄·영수증 | 공식 mono SVG 또는 `exports/print/iroa-symbol-mono.pdf`, `exports/print/iroa-wordmark-mono.pdf`, `exports/print/iroa-lockup-mono.pdf` |

## 변경·검증 절차

1. [SELECTION.md](candidates/SELECTION.md)의 공식 선택을 확인한다.
2. 필요한 형상 수정은 브랜드 승인 후 선택 원형 `candidates/track-a`와 구성 기록에서 수행한다. `masters`와 `exports`는 직접 바꾸지 않는다.
3. `python3 tools/brand/promote_candidate.py --winner track-a`로 관리 대상 내보내기와 호환 파일을 재생성한다.
4. `python3 tools/brand/audit_assets.py official`로 인벤토리, SVG, PNG, 아이콘 안전 영역과 PDF 호환성을 감사한다.
5. 전체 브랜드 테스트와 Markdown 상대 링크 검사를 실행한다.
6. `python3 tools/brand/build_usage_overview.py`로 사용 예시 PNG와 manifest를 다시 만들고 원본 크기로 확인한다.

도메인 보유, 상표권, 파트너십, 인증과 접근성 인증은 자산 파일의 존재로 자동 확정되지 않는다. 법적·운영 상태는 [BI 가이드의 도메인과 상표권 상태](IROA_BI_GUIDE_KO.md#13-도메인과-상표권-상태)를 따른다.
