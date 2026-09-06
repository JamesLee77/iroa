# IROA NODE 네트워크 공개 레이어 설계 — 분석과 기획

날짜: 2026-09-06  
상태: 초안 (오너 검토 대기, 구현 전)  
기준 브랜치: `main` (`c856540`)  
대상: iroa.ai 홈페이지 개선, NODE 네트워크 공개 레이어(`/node`), 네트워크 상태·활동 기록 모듈  
참조: `/Users/hyunsuklee/Developer/web3/ccm` (testnet 네트워크 시각화, Container Node 운영자 요구사항), `docs/superpowers/specs/2026-08-30-iroa-web3-mainnet-private-pilot-design.md`

## 1. 목적

CCM 이 testnet 사이트에 만든 network / mining node 공개 레이어를 확인하고, 그 가운데 IROA 에 맞는 것을 iroa.ai 에 구현하기 위한 분석과 기획이다. 이 문서는 구현하지 않는다. 무엇을 가져오고, 무엇을 바꾸고, 무엇을 버리는지 결정하고, 단계별 구현 계획과 오너 결정 사항을 남긴다.

IROA 는 이미 CCM 보다 깊은 NODE 스택(`onchain/contracts/node`, `node-agent`, `verifier`, `control-api`, `operator`)을 갖고 있다. 빠진 것은 **일반 방문자가 iroa.ai 에서 볼 수 있는 NODE 네트워크의 공개 얼굴**이다. 홈페이지는 지금 NODE 를 "N2 Node · 검증 중" 카드 한 장으로 세 번 반복해 보여줄 뿐, NODE 가 무엇이고 누가 운영하며 어떻게 보상받는지 설명하지 않는다.

## 2. 분석

### 2.1 CCM 이 만든 것

| 항목 | CCM 구현 | 근거 |
|---|---|---|
| 공개 NODE 등록 계약 | `CCMSandboxNodeRegistry.sol` — 누구나 label·endpoint 로 등록, `count`/`totalEver`/`recent` 조회 | `onchain/contracts/sandbox/` |
| 라이브 네트워크 상태 | `LiveNetworkState.tsx` — 노드 수, 채굴자 수, 발행 건수, 스테이킹 총량, 잔여 풀 | wagmi `useReadContract` |
| 활동 기록 | `ActivityFeed.tsx` — mint/stake/claim/unstake/register 이벤트 10건, 2000블록 창 폴링 | viem `getLogs`, `usePolling` |
| 네트워크 시각화 | `MiningNetworkViz.tsx` — 허브+위성 7개 SVG, 흐름 애니메이션, reduced-motion 대응 | 정적 SVG, 실데이터는 허브 숫자만 |
| 운영자 페이지 요구사항 | Business Model Part 14 — KYB·본드 스테이킹·하드웨어/GPS 등록, 대시보드, 수익 추적기, VVB, 유지보수 | 사양만, 미구현 |

CCM 의 원칙 하나는 그대로 가져올 가치가 있다. **화면의 숫자는 전부 체인에서 읽은 실데이터**이고, 합성 숫자를 넣지 않는다.

### 2.2 IROA 가 이미 가진 것

| 계층 | 구현 | 공개 레이어에서 쓸 수 있는 것 |
|---|---|---|
| NODE 등록부 | `IROANodeRegistry.sol` — `registerNode` → `Pending`, `approveNode`(COMPLIANCE_ROLE) → `Active`, `suspendNode`, `revokeDeviceKey`, `changeOperatorWallet`(EIP-712) | 이벤트 `NodeRegistered`, `NodeStatusChanged`, `DeviceKeyRevoked`, `OperatorWalletChanged`; 조회 `getNode`, `nodeStatus` |
| 결산 루트 | `IROAReceiptRootRegistry.sol` — `proposeRoot` → 이의 창 → `finalizeRoot` | 이벤트 `RootProposed`, `RootChallenged`, `RootFinalized`, `ChallengedRootCancelled`; 조회 `finalizedRoot(epoch)` |
| 보상 지급 | `IROARewardDistributor.sol` — Merkle proof 청구, 월 예산, allowlist | 이벤트 `RewardClaimed`; 조회 `monthlyBudget(epoch)` |
| 보상 계산 | `verifier/src/epoch-budget.ts` — 운영자 단위 합산, 월 예산의 5% 상한, 초과분은 금고 잔류 | 공개 설명의 근거 |
| 작업 점수 | 파일럿 설계 §7.2 — 완료·보안 gate × (결과 품질 40 / 접근성 25 / 적시성 15 / 사람 인계 10 / 자원 효율 10) | 공개 설명의 근거 |
| 등록 절차 | `node-agent/src/enrollment.ts` — 기기 키 → `deriveNodeId(operator, deviceKeyHash)` → challenge 서명 → `/v1/nodes/enroll`; `heartbeat.ts` 용량 버킷 | 운영자 흐름 설명 |
| 운영자 포털 | `operator/src/pages/{Enrollment,Nodes,Tasks,Rewards,Migrate}.tsx` | 비공개, 그대로 둔다 |
| 배포 manifest | `onchain/deployments/schema.json` — 서명된 manifest 스키마(`profile`, `chainId`, `contracts`, `vaults`, `manifestHash`) | 공개 사이트의 주소·상태 단일 출처 |

**아직 없는 것:** `onchain/deployments/` 에는 스키마만 있고 실제 manifest(`local`/`base-sepolia`/`base-mainnet`)가 없다. 즉 오늘 기준으로 사이트가 읽을 체인 데이터가 없다.

### 2.3 CCM 과 IROA 의 경계

파일럿 설계가 이미 정해 둔 경계를 그대로 지킨다.

- §3.3 **공개 NODE 등록은 사용하지 않는다.** CCM 의 "누구나 등록" 콜아웃은 IROA 에 옮기지 않는다. IROA NODE 는 운영자 자격 확인 뒤 `COMPLIANCE_ROLE` 승인이 있어야 `Active` 가 된다.
- §2 V1 은 비공개 참여자만 보유·이전한다. 공개 판매·DEX·상장·수익률은 승인되지 않았다. 따라서 CCM 의 스테이킹 총량·잔여 풀·CCM 표시 지표는 IROA 공개 레이어에 없다.
- §3.2 `CCMSandboxNodeRegistry` 는 시각화용 계약이다. IROA 는 실제 등록부의 이벤트를 읽는다. 시각화를 위해 별도 계약을 만들지 않는다.
- 백서 §16.4 "NODE 를 등록하거나 장비를 켜두는 것만으로 고정수익을 지급하지 않는다." — 채굴(mining) 이라는 말과 수익 기대를 주는 표현을 쓰지 않는다. IROA 의 용어는 **검증된 작업 보상**이다.
- 백서 §16.4 희석 분석 — 12년 차 NODE 당 단순 평균이 1년 차의 약 1,083분의 1. 이 그림(`docs/whitepaper/analysis/iroa-node-reward-dilution.png`)은 공개 레이어에 그대로 싣는다. CCM 처럼 "수익 추적기" 를 앞세우지 않고, 희석을 먼저 보여준다.

### 2.4 iroa.ai 홈페이지 리뷰

라이브 페이지(`https://iroa.ai/`, 2026-09-06) 본문과 메타를 기준으로 확인했다.

| # | 발견 | 영향 | 제안 |
|---|---|---|---|
| H1 | Base · Native USDC "계획" 카드(네트워크/정산 자산/공개 상태/설명 4줄)가 히어로, STAGE 05, SETTLEMENT BOUNDARY 에 같은 문장으로 3회 반복 | 스크롤이 길어지고 새 정보가 없다 | 정산 섹션에 한 번만 두고, 히어로와 STAGE 05 는 배지+한 줄로 줄인다 |
| H2 | NODE 가 "N2 Node · 검증 중" 카드 한 장으로 히어로·STAGE 03·NODE & PROOF 에 3회 반복. N0–N4 신뢰 수준, 운영자 역할, NODE 25% 배분이 홈에 없다 | 방문자가 NODE 를 이해할 수 없다 | `/node` 페이지 신설, 홈 NODE & PROOF 는 요약+링크로 재편 (본 문서 §4) |
| H3 | 로드맵 04 "Network Research · 장기 연구 — 실행 공간 보상 …" 이 저장소의 파일럿 설계(A–E 단계, NODE·보상 계약 구현 완료)와 다르다 | 공개 정보와 실제 진행이 어긋난다 | 오너 결정(§6 Q1): 파일럿 단계를 공개할지, 공개하면 로드맵 04 문구를 맞춘다 |
| H4 | 백서 진입이 카드 + DOCUMENT INDEX + "IROA.AI / WHITEPAPER / 01" 티저로 세 덩어리 | 같은 링크가 반복된다 | 카드 하나 + 목차 하나로 합친다 |
| H5 | "공식 문의 채널 준비 중" — 기관 문의 CTA 가 없다 | 관심 기관·운영자가 닿을 곳이 없다 | 오너 결정(§6 Q4): 채널이 정해지면 CTA 연결 |
| H6 | JSON-LD 없음. `meta description` 이 `og:description` 과 같은 한 줄 | 검색 결과 노출이 약하다 | `Organization` + `WebSite` 스키마, 설명 문장 보강(ko/en) |
| H7 | 상단 내비 "네트워크" 가 홈 `#network` 앵커 | `/node` 가 생기면 목적지가 두 곳 | "네트워크" → `/node`, 홈 앵커는 섹션 내부 링크로 |
| H8 | 한국어 페이지에서 배지 라벨이 "IROA Rewards · Validation Stage" 처럼 영문 | 상태 언어가 섞인다 | 배지는 `getStatusLabel(locale)` 로 통일 |

디자인(팔레트, Pretendard, 히어로 3D 렌더, 반응형)은 2026-09-05 까지의 작업으로 마무리됐고 이번 범위에서 다시 열지 않는다.

## 3. 결정 (제안)

### 3.1 CCM 에서 가져오는 것 / 바꾸는 것 / 버리는 것

| CCM | IROA 결정 | 이유 |
|---|---|---|
| 실데이터 원칙 (합성 숫자 없음) | **가져온다** | 사이트의 기존 상태 언어(`현재/다음/계획/검증 중/장기 연구`)와 같은 태도 |
| `getLogs` 폴링, 2000블록 창, 최근 10건 | **가져온다** (viem, React 없이) | Astro 정적 사이트. wagmi 는 쓰지 않는다 |
| 라이브 네트워크 상태 카드 | **바꾼다** — 지표를 IROA 것으로 | 스테이킹·풀·채굴자 → Active NODE 수, 신뢰 수준 분포, 확정 에폭 수, 마지막 루트 확정 시각, 보상 청구 건수 |
| 활동 기록 | **바꾼다** — 이벤트 종류를 IROA 것으로 | `NodeRegistered`/`NodeStatusChanged`/`RootProposed`/`RootFinalized`/`RewardClaimed` |
| 허브+위성 SVG | **바꾼다** — 요청 흐름 구조로 | 위성 = 신뢰 수준 N0–N4, 허브 = 확정 에폭. 장식이 아니라 구조를 설명한다 |
| 공개 등록 콜아웃 | **버린다** | 파일럿 설계 §3.3 |
| 수익 추적기 | **버린다** — 희석 그래프와 점수 구조로 대체 | 백서 §16.4 |
| Container Node 하드웨어·GPS·본드 등록 | **버린다** | IROA NODE 는 기기 키·신뢰 수준·승인이 자격이다 |

### 3.2 정직성 규칙

1. 배포 manifest 가 없으면 숫자를 표시하지 않는다. "배포 전" 상태 카드가 구조만 보여준다.
2. 표시하는 수는 체인 이벤트·조회에서 온 것뿐이다. 프로필(`base-sepolia`/`base-mainnet`)과 계약 주소를 카드에 함께 적고 BaseScan 으로 연결한다.
3. `Active` 만 NODE 수로 센다. `Pending` 은 "승인 대기" 로 따로 적거나 세지 않는다.
4. 지갑 주소는 표시하지 않는다. `nodeId`·`operatorIdHash` 는 앞 8자만. 비공개 참여자의 신원을 유추할 수 있는 조합(주소+시각+금액)을 한 화면에 두지 않는다.
5. 보상 청구는 건수만 세고 금액을 합산해 보여주지 않는다. 가격·수익률·연환산 표현은 어디에도 없다.
6. 모든 블록에 `PublicStatus` 배지. 단계 A(Base Sepolia) 데이터는 "검증 중", 단계 B 이후 메인넷 데이터는 "현재". 로컬 프로필은 공개하지 않는다.

## 4. 설계

### 4.1 정보 구조

```
/            홈 — NODE & PROOF 섹션을 요약형으로 재편, 정산 카드 중복 정리
/node        NODE 네트워크 (신설, ko)
/en/node     NODE 네트워크 (신설, en)
/faq         기존 Q&A — NODE 관련 항목에서 /node 로 링크
```

내비: `프로토콜 · 네트워크(/node) · 이코노미 · 백서 · Q&A`. 홈 `#network` 앵커는 유지하되 내비에서는 뺀다.

### 4.2 `/node` 페이지 섹션

| 순서 | 섹션 | 내용 | 데이터 | 상태 배지 |
|---|---|---|---|---|
| 01 | NODE 란 | 요청별로 검증되는 실행 공간. 요청 전체를 독점하지 않는다 (백서 §8.2–8.3) | 정적 | 현재 |
| 02 | 신뢰 수준 N0–N4 | 표 — 등급·예시·허용 요청 (백서 §8.3 그대로) | 정적 | 현재 |
| 03 | 운영자가 하는 일 | 기기 키 생성 → NODE ID 도출 → 등록 → 자격 확인·승인 → 하트비트·정책 버전 → 작업 실행 → 결과·삭제 확인서 | 정적 (`enrollment.ts`, `heartbeat.ts` 흐름) | 검증 중 |
| 04 | 보상 구조 | §16.4 수식, §7.2 점수 가중치, 운영자 월 5% 상한, 고정수익 없음 | 정적 | 검증 중 |
| 05 | 희석 | `iroa-node-reward-dilution.png` + 백서 문장 | 정적 | 현재 |
| 06 | 네트워크 상태 | Active NODE 수, 신뢰 수준 분포, 확정 에폭 수, 마지막 루트 확정, 청구 건수 | manifest + 폴링 | 배포 전 / 검증 중 / 현재 |
| 07 | 활동 기록 | 최근 10건, 사람 말 문장 + BaseScan 링크 | 폴링 | 위와 동일 |
| 08 | 파일럿 단계 | A 로컬·Sepolia → B V1 메인넷 → C 비공개 참여자 → D 독립 감사 → E V2 이전 (파일럿 설계 §15) | 정적 | 단계별 |
| 09 | 운영자 참여 | 공개 등록 없음. 자격 요건과 문의 경로 | 정적 | 계획 |
| 10 | 경계 | 가격·수익률·상장 약속 없음, 토큰 보유는 서비스 조건 아님 (홈 ECONOMY 와 동일 문장) | 정적 | — |

08 은 §6 Q1 에 따라 넣거나 뺀다. 뺄 경우 06·07 의 "검증 중" 라벨 근거는 "Base Sepolia 검증" 한 줄로 대신한다.

### 4.3 네트워크 상태 모듈

**데이터 출처 (단일):** `onchain/deployments/<profile>.json`. 빌드 시 `schema.json` 으로 검증한 뒤 `chainId`, `contracts.nodeRegistry`, `contracts.receiptRootRegistry`, `contracts.rewardDistributor`, `release`, `createdAt` 만 클라이언트에 넘긴다. manifest 가 없으면 모듈은 "배포 전" 상태로 렌더링되고 스크립트를 싣지 않는다.

**프로필 선택:** `base-mainnet` 이 있으면 그것, 없으면 `base-sepolia`, 둘 다 없으면 배포 전. `local` 은 무시한다.

**읽기 (viem, 브라우저):**

| 지표 | 방법 |
|---|---|
| Active NODE 수, 신뢰 수준 분포 | `NodeRegistered` 전체 이력 → `nodeStatus(nodeId)` multicall → `Active` 만 집계, `trustLevel` 별 분포 |
| 확정 에폭 수, 마지막 확정 시각 | `RootFinalized` 이력 (블록 시각) |
| 청구 건수 | `RewardClaimed` 이력, 건수만 |
| 활동 기록 | 최근 2000블록 창의 5개 이벤트, 블록 시각으로 정렬, 10건 |

폴링 30초. 탭이 숨겨지면 멈춘다. RPC 는 공개 Base 엔드포인트 하나를 manifest 와 함께 정한다(§6 Q3). 실패하면 마지막 성공값에 "갱신 실패 · HH:MM" 를 붙이고 숫자를 지우지 않는다.

**번들 예산:** viem 은 tree-shake 뒤 약 30–40 KB gz 로 예상한다. 페이지 스크립트는 `/node` 에만 싣고 홈에는 싣지 않는다. 실제 크기는 FINAL_INTEGRATION 의 번들 예산 검사에서 확인한다.

**시각화:** 04.2 06 카드 옆에 SVG 하나. 중심 = 확정 에폭 수, 위성 5개 = N0–N4 (Active 수가 있으면 위성 크기로). 애니메이션은 `prefers-reduced-motion` 을 따른다. 색은 `--console-live` (폴링 중), `--console-verified` (확정), `--console-settle` (청구) 토큰만 쓴다.

### 4.4 활동 기록 문장

| 이벤트 | 한국어 | English |
|---|---|---|
| `NodeRegistered` | N{trustLevel} NODE `{id8}` 등록 · 승인 대기 | N{trustLevel} NODE `{id8}` registered · pending approval |
| `NodeStatusChanged` Pending→Active | NODE `{id8}` 승인 | NODE `{id8}` approved |
| `NodeStatusChanged` →Suspended / Revoked | NODE `{id8}` 정지 / 폐기 | NODE `{id8}` suspended / revoked |
| `RootProposed` | {epoch} 에폭 결산 루트 제안 · 이의 창 열림 | Epoch {epoch} settlement root proposed · challenge window open |
| `RootFinalized` | {epoch} 에폭 결산 확정 | Epoch {epoch} settlement finalized |
| `RewardClaimed` | {epoch} 에폭 보상 청구 1건 | 1 reward claim · epoch {epoch} |

금액·주소는 문장에 넣지 않는다. 각 줄은 tx 해시로 BaseScan 에 연결한다.

### 4.5 홈 변경

- `NetworkProof` → 제목 유지, 본문을 "N0–N4 한 줄 요약 + 운영자 승인 원칙 + `/node` 링크" 로 재편. 현재의 N2 카드·증빙 카드·개인정보 경계는 유지.
- `HomeHero` 아틀라스의 Base/USDC 카드 → 배지 + 한 줄. STAGE 05 카드 → 배지 + 한 줄 + 정산 섹션 링크 (H1).
- `WhitepaperEntry` → 카드 + 목차 하나 (H4).
- `SiteLayout` head → JSON-LD `Organization`/`WebSite`, ko/en 설명 문장 (H6).
- 배지 라벨 통일 (H8).
- 로드맵 04 문구는 Q1 뒤에.

### 4.6 콘텐츠·테스트 규칙 (기존 방식 계승)

- 콘텐츠는 `src/content/node.ko.ts` / `node.en.ts` + `src/types/node.ts`, `faq` 와 같은 구조. ko/en 키 동일성 테스트.
- 신뢰 수준 표와 보상 수식은 백서 파일에서 파생하거나, 파생이 어려우면 백서 문장과의 일치를 검사하는 가드 테스트를 둔다 (`asset-provenance.test.ts` 와 같은 태도).
- 활동 기록 문장 생성은 순수 함수 (`src/lib/network/activity.ts`) 로 두고 이벤트 → 문장 테스트를 붙인다.
- manifest 로더는 `schema.json` 검증 실패 시 빌드를 실패시킨다.

## 5. 단계별 구현 계획 (module-first)

각 단계는 별도 브랜치·PR 이고, 열고 기다린다. 각 단계 안에서 MODULE_GENERATION → REVIEW_FIX → FINAL_INTEGRATION 한 번.

### Phase 1 — 홈 정리 + `/node` 정적 페이지 (manifest 없이 출시 가능)

모듈:
1. `src/content/node.{ko,en}.ts`, `src/types/node.ts` — 섹션 01–05, 08(조건부), 09, 10 콘텐츠
2. `src/pages/node.astro`, `src/pages/en/node.astro`, 섹션 컴포넌트 (`NodeDefinition`, `TrustLevels`, `OperatorFlow`, `RewardStructure`, `RewardDilution`, `PilotStages`, `OperatorPath`)
3. `NetworkState.astro` 의 "배포 전" 상태만 (스크립트 없음)
4. 홈 변경 4.5 (H1, H4, H6, H7, H8)
5. FAQ ↔ `/node` 상호 링크

REVIEW_FIX: 콘텐츠 키 동일성, 백서 일치 가드, 링크 무결성.  
FINAL_INTEGRATION: 기존 전체 회귀 + 빌드 + a11y(Playwright+axe) + 번들 예산 + ko/en 모바일·데스크톱 스크린샷.

### Phase 2 — 네트워크 상태 (파일럿 단계 A: Base Sepolia manifest 가 생긴 뒤)

모듈:
1. `src/lib/network/manifest.ts` — manifest 로드·스키마 검증·프로필 선택 (빌드 시)
2. `src/lib/network/events.ts` — 5개 이벤트 ABI, 스캔 창, 집계 (순수 함수, 테스트)
3. `src/lib/network/activity.ts` — 이벤트 → 문장 (순수 함수, 테스트)
4. `NetworkState.astro` + `network-state.ts` 클라이언트 스크립트 (viem, 폴링, 숨김 탭 정지, 실패 표시)
5. `ActivityLedger.astro`
6. SVG 시각화

REVIEW_FIX: 집계 경계(0 노드, Pending 만 있음, 이의 중 루트), 폴링 중단, RPC 실패.  
FINAL_INTEGRATION: 위와 동일 + 번들 예산에 viem 포함.

### Phase 3 — 운영자 참여 경로 (문의 채널 결정 뒤)

`OperatorPath` 에 CTA 연결, 홈 INSTITUTIONAL READINESS 와 같은 채널. 개인정보 수집 문구·동의는 채널 형태에 따라 결정.

## 6. 오너 결정 필요 사항

| # | 질문 | 영향 |
|---|---|---|
| Q1 | 파일럿 단계 A–E 를 iroa.ai 에 공개할 것인가? | 4.2 의 08 섹션, 로드맵 04 문구(H3), "검증 중" 라벨 근거 |
| Q2 | Base Sepolia 단계 A 데이터를 공개 사이트에 표시할 것인가, 메인넷(단계 B) 이후만 표시할 것인가? | Phase 2 착수 시점, 프로필 선택 규칙 |
| Q3 | 공개 RPC 엔드포인트 — Base 공식 공개 RPC 를 쓸지, 계정 있는 제공자(키 노출 없이 도메인 제한)를 쓸지 | 폴링 안정성, 비용 |
| Q4 | 운영자·기관 문의 채널 (이메일·폼·없음) | H5, Phase 3 |
| Q5 | NODE 운영자 자격 요건을 어느 수준까지 공개할 것인가 (자격 확인 절차, 기기 요건) | 4.2 의 09 섹션 문구 |
| Q6 | 백서 §16.4 희석 그래프를 `/node` 에 그대로 실을 것인가 | 4.2 의 05 섹션 |

Q1·Q2 는 Phase 1 안에서도 문구에 영향을 주므로 먼저 필요하다. Q3–Q6 은 Phase 2·3 전까지 결정하면 된다.

## 7. 하지 않는 것

- 공개 NODE 등록, 시각화용 별도 계약, 테스트넷 플레이그라운드
- 스테이킹·풀·채굴자 지표, 금액 합산, 가격·수익률·연환산
- 운영자 포털(`operator/`)·관리자 콘솔(`admin/`) 기능의 공개 사이트 이식
- 지갑 연결(wagmi/WalletConnect) — 공개 레이어는 읽기 전용
- 디자인 시스템·팔레트·히어로 재작업
