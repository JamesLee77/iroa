# IROA.AI 브랜드 아이덴티티 가이드

- 버전: 1.0
- 기준일: 2026-08-27
- 공식 브랜드명: **IROA.AI**
- 기본 워드마크 표기: **iroa.ai**
- 공식 BI: **Track A**
- 단일 콘텐츠 원본: 이 Markdown 문서

공식 파일을 고를 때는 [브랜드 자산 README](README.md)를, 실제 적용의 전체 인상은 [공식 사용 예시 보드](examples/usage-overview.png)를 함께 확인한다.

## 1. 브랜드 핵심

### 브랜드명과 역할

- 공식 브랜드: **IROA.AI**
- 기본 워드마크: **iroa.ai**
- 한국어 발음: **이로아**
- 기술적 의미: **Inclusive Real-world Orchestration Agent**

IROA는 설명만 제공하는 AI가 아니라 노인과 장애인의 선택을 존중하며 예약, 주문, 이동, 결제, 병원·복지 연계 같은 생활 과업을 끝까지 수행하도록 돕는 Agent를 의미한다.

### 브랜드 약속

> 일상을 이롭게.

### 핵심 메시지

> 곁에서 함께, 필요한 일을 끝까지.

### 영문 메시지

> Real Life, Made Easier.

### 브랜드 성격

| 성격 | 표현 방법 |
|---|---|
| 따뜻함 | 아이보리 배경, 코랄 행동점, 실제 생활 사진 |
| 신뢰 | 네이비 본문, 단정한 정보 구조, 명확한 책임 경계 |
| 주도성 | 사용자가 선택·확인·취소하는 장면과 문구 |
| 포용성 | 장애 특성을 고정된 유형이 아니라 개인별 선호로 다룸 |
| 실행력 | “추천”보다 “완료”, 기능보다 결과를 먼저 설명 |

IROA는 유아적 캐릭터, 과장된 미래주의, 암호화폐 시각 언어, 감시 기술, 의료기관처럼 차가운 표현을 피한다.

## 2. 공식 로고 시스템

### 2.1 공식성과 선택 범위

2026-08-27 선택 기록에 따라 Track A만 BI v1.0 공식 자산이다. [후보 선택 기록](candidates/SELECTION.md)은 이 결정을 보존한다. Track B는 선택되지 않은 제로베이스 탐색 기록이며 공식 제품, 문서, 파트너 자료에 사용하거나 Track A와 혼합하지 않는다.

공식 로고는 다음 세 가지 역할로 운영한다.

| 역할 | 용도 | 우선 파일 |
|---|---|---|
| 기본 워드마크 | 웹 헤더, 문서 발신자, 캠페인 서명 | `masters/wordmark/iroa-wordmark-color.svg` |
| 축약 가로 락업 | 넓은 표면, 공동 브랜딩, 키오스크 시작 화면 | `masters/lockup/iroa-lockup-color.svg` |
| 심볼 | 파비콘, 앱·워치 아이콘, 좁은 상태 표시 | `masters/symbol/iroa-symbol-color.svg` |

색상형은 밝고 단순한 배경, 역상형은 마스터에 포함된 IROA Navy 배경, 단색형은 흑백 인쇄·각인·단색 영수증에 쓴다. 임의로 색상형을 흰색으로 바꾸거나 역상형의 배경을 제거하지 않는다.

### 2.2 구조와 광학 보정

- 심볼은 `160 × 160` 좌표계, 중심 `(80, 80)`, 반지름 `48`, 획 `24`의 열린 고리와 중심 `(128, 80)`, 반지름 `10.5`의 코랄 행동점으로 구성된다.
- 고리의 오른쪽 열림각은 `80°`이며 그려진 호는 `280°`다.
- 워드마크는 `600 × 180` 좌표계다. 주 획은 `22`, 작은 `.ai` 획은 `14`이며 주 문자 기준선은 `y=143`, `.ai` 기준선은 `y=142.5`다.
- 워드마크의 `o`는 심볼 구조를 `translate(166 29.5) scale(.8)`로 공유한다. 코랄 행동점은 하나뿐이며 점, `i`의 점 또는 마침표를 행동점으로 다시 칠하지 않는다.
- 락업은 `760 × 180` 좌표계다. 선택된 심볼과 워드마크의 형상을 바꾸지 않고 배치하며, 가시 형상 사이 간격은 `57.5` 단위 이상이다.

이 값은 새 로고를 다시 그리기 위한 도면이 아니라 마스터 보존 기준이다. 크기별로 다른 형상을 쓰는 별도 16·24·32px 변형은 없다. 하나의 승인된 Track A 마스터가 16·24·32px에서도 성립하도록 설계됐으며, 각 PNG 내보내기는 같은 기하를 크기만 바꾸어 래스터화한다. 내보내기 과정에서 행동점 크기, 열림각, 획 또는 자간을 바꾸지 않는다. 상세 기준은 [Track A 원형 구성 기록](candidates/track-a/CONSTRUCTION.md)과 [공식 락업 구성 기록](masters/lockup/CONSTRUCTION.md)에 있다.

### 2.3 보호 공간

보호 공간 `X`는 로고 바깥의 비어 있어야 하는 최소 거리다. 계산값이 소수 픽셀이면 바깥쪽으로 올림한다.

| 자산 | X 정의 | 운영 예시 |
|---|---|---|
| 심볼 | 심볼 획 `24/160`, 즉 프레임 한 변의 `15%` | 32px 심볼이면 사방 최소 5px |
| 워드마크 | 주 획 `22/180`, 즉 워드마크 높이의 `12.23%` | 높이 36px이면 사방 최소 5px |
| 락업 | 심볼 획 `24/180`, 즉 락업 높이의 `13.34%` | 높이 36px이면 사방 최소 5px |

보호 공간 안에는 파트너 로고, 문구, 버튼, 테두리, 사진의 얼굴이나 화면 가장자리를 두지 않는다. 배경색은 보호 공간을 침범하는 요소로 보지 않지만, 배경 무늬와 사진의 고대비 경계는 침범으로 본다.

### 2.4 최소 크기

| 자산 | 디지털 최소 | 인쇄 최소 | 규칙 |
|---|---:|---:|---|
| 심볼 | 16px | 8mm | 16px은 제공된 파비콘만 사용, 일반 UI는 24px 이상 권장 |
| 워드마크 | 가로 120px | 가로 32mm | 더 작으면 심볼로 전환 |
| 락업 | 가로 152px | 가로 41mm | 제품명·파트너 로고는 최소 크기에 포함하지 않음 |

16px 심볼에는 테두리, 제품명, 상태 배지 또는 추가 문구를 결합하지 않는다. 인쇄 전에는 실제 출력물에서 행동점과 열린 간격이 분리되는지 확인한다.

## 3. 컬러와 접근성 대비

### 3.1 컬러 값

CMYK는 일반 프로세스 인쇄의 시작값이며 출력 장비와 용지에 맞춘 교정쇄를 우선한다.

| 이름 | HEX | RGB | CMYK 참고값 | 주 용도 |
|---|---|---|---|---|
| IROA Navy | `#16263D` | `22, 38, 61` | `64, 38, 0, 76` | 제목, 본문, 어두운 배경 |
| IROA Coral | `#F06D5E` | `240, 109, 94` | `0, 55, 61, 6` | 행동점, 큰 강조 |
| IROA Ivory | `#F7F3EA` | `247, 243, 234` | `0, 2, 5, 3` | 편안한 기본 배경 |
| IROA Teal | `#3D8B83` | `61, 139, 131` | `56, 0, 6, 45` | 보조 강조, 큰 그래픽 |
| IROA Light Teal | `#83CDC4` | `131, 205, 196` | `36, 0, 4, 20` | 네이비 위 보조 강조 |
| Ink | `#19222E` | `25, 34, 46` | `46, 26, 0, 82` | 긴 본문, 표 글자 |
| White | `#FFFFFF` | `255, 255, 255` | `0, 0, 0, 0` | 역상 글자, 정보 면 |

### 3.2 적용 기준

| 대상 | 최소 대비 | 정의 |
|---|---:|---|
| 일반 텍스트 | `4.5:1` | 18pt 미만 일반 또는 14pt 미만 굵게 |
| 큰 텍스트 | `3:1` | 18pt 이상 일반 또는 14pt 이상 굵게 |
| 비텍스트 UI·그래픽 | `3:1` | 입력 테두리, 상태 아이콘, 데이터 표시처럼 식별에 필요한 구성요소와 인접 색상 사이 |

비텍스트 UI 기준은 글자의 굵기를 뜻하지 않는다. 장식 요소는 의미 전달에 필요하지 않을 때만 이 판정에서 제외한다. 실제 제품은 확대, 고대비 모드, 포커스와 비활성 상태까지 별도로 확인한다.

### 3.3 허용 조합과 측정값

아래 값은 sRGB 색상에 대해 계산한 WCAG 2.x 상대 휘도 대비값이다. 이는 해당 조합의 수치 근거이며 제품 전체의 접근성 인증이나 적합성 인증을 뜻하지 않는다.

| 전경 / 배경 | 대비 | 운영 판정 |
|---|---:|---|
| Ink / IROA Ivory | `14.48:1` | 일반·큰 텍스트 허용 |
| IROA Navy / IROA Ivory | `13.75:1` | 일반·큰 텍스트 허용 |
| IROA Navy / White | `15.23:1` | 일반·큰 텍스트 허용 |
| White / IROA Navy | `15.23:1` | 일반·큰 텍스트 허용 |
| IROA Light Teal / IROA Navy | `8.34:1` | 일반·큰 텍스트 허용 |
| IROA Coral / IROA Navy | `5.12:1` | 일반 텍스트 수치는 충족하나 작은 본문보다 강조에 사용 |
| IROA Teal / White | `4.02:1` | 일반 텍스트 금지; 큰 텍스트와 비텍스트 UI·그래픽에는 허용 |
| IROA Teal / IROA Ivory | `3.63:1` | 일반 텍스트 금지; 큰 텍스트와 비텍스트 UI·그래픽에는 허용 |
| IROA Coral / White | `2.98:1` | 텍스트와 식별 필수 UI·그래픽 금지; 의미 없는 장식에만 사용 |

색상만으로 상태를 구분하지 않는다. 색상과 함께 명시적 문구, 아이콘 형상, 패턴 또는 위치를 제공한다. 실제 화면에서는 투명도, 사진, 그라데이션, 비활성 상태까지 포함한 최종 픽셀을 다시 측정한다.

## 4. 서체와 문장

### 4.1 서체

- 한국어: **Noto Sans KR** Medium / Bold
- 한국어 대체: **Apple SD Gothic Neo**, **Malgun Gothic**, 시스템 sans-serif
- 영문과 숫자: **Inter**, 대체로 **Noto Sans**, **Arial**, 시스템 sans-serif
- 일반 문서 본문: 10.5–11.5pt
- 접근성 강조판 본문: 13–16pt
- 본문 행간: 글자 크기의 1.45–1.65배

얇은 글꼴, 압축 자간, 전부 대문자인 긴 제목, 9pt 미만의 표 본문을 피한다. 로고 SVG의 문자 윤곽은 폰트가 아니므로 워드마크를 일반 텍스트로 재조판하지 않는다.

### 4.2 권장 문장

- “무엇을 도와드릴까요?”
- “예약 내용을 확인한 뒤 확정할게요.”
- “이 작업에는 결제가 필요합니다. 승인하시겠어요?”
- “자동 실행을 멈추고 직원을 연결할게요.”
- “사용자가 선택한 방식으로 다시 설명합니다.”

### 4.3 금지 문장

- “노약자도 쉽게”
- “장애를 극복하는 AI”
- “완전 자동 결제”
- “고독사를 방지합니다”
- “의료 진단을 대신합니다”
- “수익이 보장되는 Node”

서비스의 가능성과 현재 구현 상태를 구분하고 계획·실증·운영·제휴·규제 승인을 같은 의미로 사용하지 않는다.

## 5. 사진 원칙

사진은 사용자의 주도적인 행동과 사람 사이의 연결을 보여준다. 휠체어, 워치, 키오스크, 로봇이 등장하더라도 기기보다 사람의 선택과 표정이 중심이어야 한다.

### 사용한다

- 일상에서 기술을 자연스럽게 사용하는 노인과 장애인
- 주문·결제·예약의 결과가 보이는 장면
- 가족, 자원봉사자, 상점주와 함께 문제를 해결하는 장면
- 안부 대화와 지역사회 연결
- Node와 로봇을 실제 제품이 아닌 기술 개념으로 명확히 표시한 장면

### 사용하지 않는다

- 침대, 환자복, 눈물, 어두운 방으로 취약성만 강조한 장면
- 얼굴 스캔, 감시 화면, 과도한 생체정보 그래픽
- 특정 회사 로고가 제휴처럼 보이는 장면
- AI가 사람을 대신해 모든 결정을 내리는 장면
- 사진 속 인물이 IROA를 지지한다고 암시하는 문구

사진의 출처, 허용 범위와 대체 텍스트는 [사진 출처 목록](assets/photos/PHOTO-MANIFEST.md)에서 관리한다. 사진 파일을 로고, 워드마크 또는 상표 도형의 일부로 사용하지 않는다.

## 6. 디지털 아이콘

| 환경 | 공식 파일 | 규칙 |
|---|---|---|
| 파비콘 SVG | `exports/icons/favicon.svg` | 벡터 파비콘을 지원하는 브라우저의 우선값 |
| 파비콘 PNG | `exports/icons/favicon-16.png`, `exports/icons/favicon-32.png`, `exports/icons/favicon-48.png` | 표시 슬롯과 같은 크기의 파일을 선택, 확대 금지 |
| Apple 터치 | `exports/icons/apple-touch-icon-180.png` | iOS 홈 화면 메타데이터에 180px 원본 연결 |
| 앱 아이콘 | `exports/icons/app-icon-192.png`, `exports/icons/app-icon-512.png` | 시스템 마스크에 맡기며 임의 둥근 모서리·광택 금지 |
| 마스크 가능 아이콘 | `exports/icons/maskable-icon-192.png`, `exports/icons/maskable-icon-512.png` | 제공 파일의 사방 10% 안전 영역 유지, 추가 크롭 금지 |
| 워치 | `exports/icons/symbol-watch-48.png` | 48px 원본 사용, 알림 상태 문구와 분리 |
| 키오스크 | `exports/icons/symbol-kiosk-1024.png` | 고밀도 시작 화면 원본, 비율 유지 축소만 허용 |

아이콘 안에 제품명, 파트너명, 숫자 배지 또는 인증 문구를 합성하지 않는다. 운영 상태는 심볼 바깥의 플랫폼 배지와 텍스트로 제공한다.

## 7. 공동 브랜딩

공동 브랜딩은 서면으로 확인된 관계와 실제 승인 범위 안에서만 사용한다. 로고를 나란히 놓았다는 사실이 제휴, 인증, 후원 또는 공공기관 승인을 새로 만들지 않는다.

1. IROA는 공식 락업 또는 워드마크를 사용하고 파트너 로고는 파트너가 제공한 마스터를 사용한다.
2. 두 로고의 광학 높이를 맞추되 어느 한쪽도 변형하지 않는다.
3. IROA 보호 공간을 양쪽 모두 확보한 뒤, 필요하면 `1px` 또는 인쇄 `0.25mm`의 Ink 20% 중립 구분선을 둔다.
4. 공동 제공 관계는 “with”, “기술 제공”, “운영 협력”처럼 실제 계약이 허용한 문구로 별도 표기한다.
5. 파트너 로고를 IROA 행동점, 심볼 내부, 앱 아이콘 또는 제품 서브브랜드처럼 결합하지 않는다.
6. 삼성, 병원, 정부기관, 결제사 등 제3자가 공식 파트너인 것처럼 보이게 하는 예시는 승인 전 외부 공개하지 않는다.

## 8. 제품명과 서브브랜드

### 8.1 공식 제품명

- **IROA Agent**: 생활 과업을 계획하고 완료하는 핵심 Agent
- **IROA Mobile**: 선택적 개인 접점
- **IROA Watch**: 요청·확인·안전 신호 인터페이스
- **IROA Node**: 격리된 장시간·고성능 실행 인프라
- **IROA Kiosk**: 현장에서 주문·예약·결제를 지원하는 Agentic Node
- **IROA Companion**: 대화·루틴·안부 확인을 제공하는 반려 친구
- **IROA Robot**: 물리적 도움으로 확장하는 단계적 연구 제품
- **IROA Network**: 사용자, 도움 제공자, 기관, Node 운영자의 신뢰·보상 계층

### 8.2 표기 규칙

- 회사·브랜드명은 `IROA.AI`, 제품명은 `IROA Watch`처럼 `IROA + 한 칸 + 제품명`으로 쓴다.
- 첫 노출에서만 공식 워드마크 또는 락업을 사용하고 제품명은 보호 공간 밖의 일반 텍스트로 둔다.
- 제품마다 행동점 색, 심볼 모양, 워드마크 자간 또는 `.ai` 색을 바꾼 전용 로고를 만들지 않는다.
- 기능명은 제품명 아래의 일반 텍스트 계층으로 둔다. 기능명을 로고 안에 넣지 않는다.
- `Node 인증`, `공식 파트너`, `의료기기` 같은 표현은 해당 제도와 승인이 별도로 확인된 경우에만 사용한다.

## 9. 매체별 적용

| 매체 | 권장 자산 | 적용 규칙 |
|---|---|---|
| 웹 | `masters/wordmark/iroa-wordmark-color.svg`, `exports/icons/favicon.svg` | 흰색·Ivory 헤더에서 워드마크 가로 120px 이상, 텍스트 대비 별도 측정 |
| 앱 | `exports/icons/app-icon-192.png`, `exports/icons/app-icon-512.png`, 마스크 가능 아이콘 | 플랫폼별 선언 크기와 동일 파일 사용, 아이콘에 제품명 합성 금지 |
| 워치 | `exports/icons/symbol-watch-48.png` | 48px 원본 사용, 요청·확인 문구는 심볼 밖에 배치 |
| 키오스크 | `exports/icons/symbol-kiosk-1024.png` 또는 공식 락업 | 먼 거리에서는 심볼과 큰 문구를 분리, 터치 상태를 색만으로 표시하지 않음 |
| 문서 | `masters/lockup/iroa-lockup-color.svg`, 단색 PDF | A4 화면·디지털은 SVG, 인쇄 교환은 `exports/print` PDF 사용 |
| 단색 영수증·각인 | `masters/symbol/iroa-symbol-mono.svg`, `masters/wordmark/iroa-wordmark-mono.svg` | 단색 마스터만 사용, 망점·회색 효과를 임의 추가하지 않음 |

예시 보드는 웹·앱·워치·키오스크·문서 문맥을 하나의 운영 화면으로 보여 주지만, 그 보드 자체는 로고 마스터가 아니다.

## 10. 금지 사용

| 잘못된 예 | 문제 | 바른 대안 |
|---|---|---|
| 로고를 가로로 늘이거나 세로로 누름 | 열린 고리와 문자 획 비례가 깨짐 | 공식 SVG/PNG를 비율 고정으로 배치 |
| 워드마크의 행동점, 글자 간격, `.ai` 위치를 수정 | 광학 보정과 공식 형상이 사라짐 | 해당 배경의 공식 마스터 사용 |
| Track B 심볼과 Track A 워드마크를 결합 | 비공식 후보가 공식 BI로 오인됨 | Track A 공식 masters만 사용 |
| Coral/White로 작은 본문이나 버튼 라벨 표시 | `2.98:1`로 핵심 텍스트 대비가 부족함 | Navy/White 또는 Ink/Ivory 사용 |
| 복잡한 사진 위에 색상형 로고를 바로 배치 | 윤곽·행동점 식별이 흔들림 | 단색 정보 면을 만들고 보호 공간 확보 |
| 16px PNG를 64px로 확대 | 가장자리와 행동점이 흐려짐 | 같은 표시 크기의 공식 내보내기 선택 |
| 심볼에 그림자·3D·금속·그라데이션 추가 | 장기성과 재현성이 손상됨 | 색상·역상·단색 공식 변형 사용 |
| 앱 아이콘을 임의로 둥글게 자르거나 확대 크롭 | 마스크 가능 아이콘 안전 영역이 사라짐 | 제공된 마스크 가능 아이콘 사용 |
| 파트너 로고를 보호 공간 안이나 심볼 내부에 배치 | 공동 브랜딩 경계와 소유가 혼동됨 | 보호 공간 밖에서 광학 높이 정렬 |
| 색상만으로 완료·위험·대기 상태 구분 | 색각·저시력 환경에서 의미가 사라질 수 있음 | 문구·아이콘·형상을 함께 제공 |
| PDF·PNG를 편집 원본으로 사용 | 벡터 구조와 재생성 경로가 끊김 | 승인된 Track A 선택 원형과 승격 경로에서 변경 |

### 10.1 생성·관리 흐름

`masters`는 모든 소비자가 참조하는 공식 자산이지만 저장소에서는 승격 도구가 관리하는 출력이다. 승인된 편집 입력은 `candidates/track-a`의 Track A 구성 파일이다. 변경은 Track A 구성 입력에서 시작하고 승격 도구를 실행한 뒤 `masters`와 `exports`를 함께 검증한다. `masters`나 `exports`를 직접 편집하지 않는다.

## 11. 공식 관리 출력 인벤토리 (49개)

이 절은 관리되는 공식 출력의 완전한 목록이다. 마스터 10개, 디지털 PNG 22개, 아이콘 11개, 인쇄 PDF 6개로 총 49개이며, 편집 입력·호환 사본·제작 기록·예시는 포함하지 않는다.

### 11.1 공식 관리 마스터 출력

| 파일 | 역할 |
|---|---|
| `masters/symbol/iroa-symbol-color.svg` | 밝은 배경용 공식 심볼 관리 출력 |
| `masters/symbol/iroa-symbol-mono.svg` | 단색 심볼 관리 출력 |
| `masters/symbol/iroa-symbol-reverse.svg` | 네이비 맥락을 포함한 역상 심볼 관리 출력 |
| `masters/wordmark/iroa-wordmark-color.svg` | 밝은 배경용 공식 워드마크 관리 출력 |
| `masters/wordmark/iroa-wordmark-mono.svg` | 단색 워드마크 관리 출력 |
| `masters/wordmark/iroa-wordmark-reverse.svg` | 네이비 맥락을 포함한 역상 워드마크 관리 출력 |
| `masters/lockup/iroa-lockup-color.svg` | 밝은 배경용 심볼+워드마크 락업 관리 출력 |
| `masters/lockup/iroa-lockup-mono.svg` | 단색 락업 관리 출력 |
| `masters/lockup/iroa-lockup-reverse.svg` | 네이비 맥락을 포함한 역상 락업 관리 출력 |
| `masters/lockup/CONSTRUCTION.md` | 공식 락업 배치와 간격 근거 |

### 11.2 디지털 PNG

`exports/digital`에는 아래 22개 RGBA 투명 PNG가 있다. 파일의 숫자는 실제 높이이며 심볼은 같은 폭, 워드마크 폭은 높이의 `600/180` 비율로 생성된다.

| 계열 | 완전한 파일 목록 | 용도 |
|---|---|---|
| 심볼 | `exports/digital/iroa-symbol-16.png`, `exports/digital/iroa-symbol-24.png`, `exports/digital/iroa-symbol-32.png`, `exports/digital/iroa-symbol-48.png`, `exports/digital/iroa-symbol-64.png`, `exports/digital/iroa-symbol-128.png`, `exports/digital/iroa-symbol-180.png`, `exports/digital/iroa-symbol-192.png`, `exports/digital/iroa-symbol-256.png`, `exports/digital/iroa-symbol-512.png`, `exports/digital/iroa-symbol-1024.png` | 표시 슬롯과 같은 크기의 래스터 심볼 |
| 워드마크 | `exports/digital/iroa-wordmark-16.png`, `exports/digital/iroa-wordmark-24.png`, `exports/digital/iroa-wordmark-32.png`, `exports/digital/iroa-wordmark-48.png`, `exports/digital/iroa-wordmark-64.png`, `exports/digital/iroa-wordmark-128.png`, `exports/digital/iroa-wordmark-180.png`, `exports/digital/iroa-wordmark-192.png`, `exports/digital/iroa-wordmark-256.png`, `exports/digital/iroa-wordmark-512.png`, `exports/digital/iroa-wordmark-1024.png` | 높이 기준 래스터 워드마크; 운영 최소 폭 규칙은 별도 적용 |

### 11.3 아이콘 내보내기

| 파일 | 용도 |
|---|---|
| `exports/icons/favicon.svg` | 벡터 파비콘 |
| `exports/icons/favicon-16.png` | 16px 파비콘 |
| `exports/icons/favicon-32.png` | 32px 파비콘 |
| `exports/icons/favicon-48.png` | 48px 파비콘 |
| `exports/icons/apple-touch-icon-180.png` | Apple 터치 아이콘 |
| `exports/icons/app-icon-192.png` | 192px 앱 아이콘 |
| `exports/icons/app-icon-512.png` | 512px 앱 아이콘 |
| `exports/icons/maskable-icon-192.png` | 192px 마스크 가능 아이콘, 사방 10% 안전 영역 |
| `exports/icons/maskable-icon-512.png` | 512px 마스크 가능 아이콘, 사방 10% 안전 영역 |
| `exports/icons/symbol-watch-48.png` | 48px 워치 심볼 |
| `exports/icons/symbol-kiosk-1024.png` | 1024px 키오스크 심볼 |

### 11.4 인쇄 PDF

| 파일 | 용도 |
|---|---|
| `exports/print/iroa-symbol-color.pdf` | 컬러 심볼 인쇄 교환본 |
| `exports/print/iroa-symbol-mono.pdf` | 단색 심볼 인쇄 교환본 |
| `exports/print/iroa-wordmark-color.pdf` | 컬러 워드마크 인쇄 교환본 |
| `exports/print/iroa-wordmark-mono.pdf` | 단색 워드마크 인쇄 교환본 |
| `exports/print/iroa-lockup-color.pdf` | 컬러 락업 인쇄 교환본 |
| `exports/print/iroa-lockup-mono.pdf` | 단색 락업 인쇄 교환본 |

## 12. 호환·기록·예시

위 인쇄 PDF들은 글꼴과 래스터 이미지를 포함하지 않는 1페이지 A4 벡터 호환본이다. 편집 입력이나 BI 가이드 PDF가 아니며, 변경은 10.1의 생성·관리 흐름을 따른다.

| 경로 | 상태와 용도 |
|---|---|
| `iroa-symbol.svg`, `iroa-wordmark.svg`, `iroa-wordmark-mono.svg`, `iroa-wordmark-reverse.svg` | 기존 소비자 경로용 공식 마스터 호환 복사본; 직접 편집 금지 |
| `iroa-symbol.png`, `iroa-wordmark.png` | 기존 소비자 경로용 512×512, 1200×360 호환 PNG |
| `candidates/` | Track A 제작 원형과 Track B 비공식 탐색 기록; 배포 자산 아님 |
| `examples/usage-overview.png` | 공식 자산만 사용한 결정적 적용 예시; 마스터 아님 |
| `examples/usage-overview-manifest.json` | 예시 보드의 공식 의존 자산, 장면 영역과 텍스트 대비 증거 |
| `assets/photos/` | 사진과 출처·대체 텍스트 기록; 로고 원본 아님 |
| `IROA_BI_GUIDE_KO.md` | BI v1.0 단일 콘텐츠 원본 |
| `IROA_BI_GUIDE_KO.docx`, `IROA_BI_GUIDE_KO.pdf` | 문서 배포 호환본; 외부 배포 전 Markdown 버전과 일치 여부 확인 |

## 13. 도메인과 상표권 상태

`iroa.ai 도메인은 확보 완료` 상태다. 그러나 도메인 보유는 `상표권 확보와는 별개의 문제`다. 한국과 목표 국가에서 상표 선행조사, 출원·등록 상태 및 법률 검토가 별도로 확인되기 전에는 “상표 등록 완료”, “독점권 확보”, “전 세계 사용 가능”을 주장하지 않는다.

이 문서는 브랜드 운영 기준이지 법률 의견, 상표 등록 증명 또는 접근성 인증서가 아니다.
