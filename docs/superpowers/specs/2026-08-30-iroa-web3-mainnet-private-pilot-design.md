# IROA Web3 메인넷 비공개 파일럿 설계

날짜: 2026-08-30  
상태: 승인된 설계  
기준 브랜치: `codex/iroa-homepage-v1` (`223e037`)  
대상: IROA 토큰, NODE, 검증 증명, 보상 결산, 비공개 메인넷 파일럿과 V2 이전

## 1. 목적

IROA 백서의 토큰 배분과 NODE 성과보상을 Base 기반의 실제 시스템으로 구현한다. IROA V1은 독립 스마트계약 보안감사 전에 Base 메인넷에 먼저 발행하되 승인된 비공개 참여자만 보유·이전·검증할 수 있게 제한한다. 비공개 참여자는 NODE 등록, 생활 요청 실행, 결과·삭제 증명, 분쟁, 보상, 베스팅과 운영 권한을 메인넷에서 끝까지 검증한다.

비공개 검증이 끝나면 V1 계약과 실제 운영 증거를 독립 감사기관에 제출한다. 감사 결과를 반영한 IROA V2를 새 계약으로 발행하고, V1을 소각한 수량만큼 V2를 1:1로 발행하는 원자적 이전을 수행한다. V1과 V2를 합친 경제적 총공급은 언제나 10,000,000,000 IROA를 넘지 않는다.

이 설계는 공개 판매, DEX 유동성, 상장 또는 수익률을 승인하지 않는다. 해당 기능은 V2 감사·이전 이후에도 별도 설계와 승인을 필요로 한다.

## 2. 고정된 결정

- Settlement layer: Base Mainnet, 사전 리허설은 Base Sepolia
- V1 최대 공급량: `10,000,000,000 IROA`
- V1 공급: 생성 시 한 번만 발행하며 일반적인 추가 발행 기능은 두지 않음
- V1 형태: non-upgradeable ERC-20, 일시정지 가능, allowlist 기반 전송 제한
- V1 대상: 계약과 참여 동의를 마친 비공개 참여자
- V1 금지: 공개 판매, DEX, 브리지, 담보·대출, 공개 지갑 간 자유 이전
- 운영 권한: Safe 다중서명과 Timelock, 배포자 권한 이관·포기
- V2: 감사 후 항상 별도 non-upgradeable 계약으로 재발행
- V1 → V2: V1 소각과 V2 발행이 하나의 transaction에서 1:1로 실행
- 서비스 사용자: 토큰 또는 지갑 없이 핵심 요청 기능 사용 가능
- 개인정보: 원문과 상세 행동기록을 온체인에 기록하지 않음
- NODE 보상: 등록이나 가동만으로 지급하지 않고 검증된 작업·품질·보안·삭제 준수에 따라 지급

## 3. CCM 참조와 IROA 경계

`/Users/hyunsuklee/Developer/web3/ccm`은 Base 운영 기반의 참고 구현이다. 다음 항목을 선택적으로 재사용한다.

### 3.1 재사용 또는 변환

- Hardhat, TypeScript, ethers/viem 기반 계약 개발·배포
- Base Mainnet과 Base Sepolia 주소·번들·환경의 완전 분리
- BaseScan 소스와 생성자 인자 검증
- Safe 다중서명, Timelock, 온체인 역할 이관
- SIWE 운영자 인증과 append-only 감사 로그
- 공개 사이트, 테스트넷, 운영자 포털, 관리자 콘솔 분리
- Worker 예약 작업의 직렬 처리와 지갑 nonce 관리
- 배포 manifest, runbook, 잔액·역할·주소 확인 절차

### 3.2 구조만 참고하고 새로 작성

- CCM의 `CCMSandboxNodeRegistry`는 공개 등록형 시각화 계약이다. IROA NODE Registry는 운영자 자격, 기기 키, 신뢰 수준, 승인·정지·폐기와 증명 상태를 관리하므로 새로 작성한다.
- CCM Vesting의 선형 해제 계산은 참고하되 IROA의 7개 배분과 서로 다른 잠금 일정을 전용 금고로 구현한다.
- CCM Worker의 인증·DB·감사 구조는 참고하되 Task Capsule, Receipt, 정책 버전과 분쟁 상태는 IROA 도메인으로 작성한다.

### 3.3 사용하지 않는 항목

- 가격 연동 스테이킹
- Carbon Oracle과 탄소 NFT
- DeFi Vault, Wrapper, Lending, Insurance
- 공개 NODE 등록
- 투자자 KYC를 일반 IROA 사용자 인증에 적용하는 방식

## 4. 전체 아키텍처

IROA는 Interaction Plane, Control Plane, Execution Plane, Evidence Plane, Settlement Plane으로 분리한다.

```text
사용자·워치·키오스크
  ↓ 요청·승인·취소
Interaction Plane
  ↓
Control Plane
  ├─ 신원·정책·요청 상태
  ├─ Task Capsule·일회성 권한
  └─ 적격 NODE 선택·재배정
  ↓
Execution Plane
  ├─ 검증된 NODE Agent
  ├─ 격리 실행
  └─ Result Receipt·Deletion Receipt
  ↓
Evidence Plane
  ├─ 서명·정책·품질·중복 검증
  ├─ 분쟁·보상 보류
  └─ Merkle 결산
  ↓
Settlement Plane — Base Mainnet
  ├─ Token·Vesting·Allocation Vaults
  ├─ NODE Registry
  ├─ Receipt Root Registry
  └─ Reward Distributor·Timelock
```

개인정보 원문, Task Capsule 내용과 상세 행동기록은 Settlement Plane에 전달하지 않는다. 온체인에는 NODE 자격 상태, 정책 버전, 검증 batch root, 보상 금액, 청구 상태와 운영 권한만 기록한다.

## 5. 저장소와 모듈 경계

현재 Astro 홈페이지와 웹 백서는 루트에 유지한다. 초기 Web3 작업 때문에 기존 사이트를 워크스페이스로 이동하지 않는다.

```text
iroa/
├── src/                         기존 홈페이지·웹 백서
├── docs/
│   ├── whitepaper/
│   └── architecture/
├── onchain/                     Solidity·배포·검증·migration
├── sandbox/                     일반 사용자용 요청 체험
├── operator/                    NODE 운영자 포털
├── admin/                       검증·분쟁·결산 콘솔
├── control-api/                 인증·Task Capsule·요청 상태
├── verifier/                    Receipt·점수·Merkle 결산
├── node-agent/                  NODE 실행 에이전트
└── packages/
    ├── protocol/                공통 상태·Receipt·정책 타입
    ├── contracts/               ABI·주소·체인 manifest
    ├── crypto/                  EIP-712·해시·서명
    └── accessibility/           접근성 품질 규칙
```

각 모듈은 공통 `packages/protocol` 계약만 공유한다. UI, API와 NODE가 서로의 내부 DB 모델을 직접 import하지 않는다.

## 6. V1 스마트계약 구성

### 6.1 `IROATokenV1`

- ERC-20, Permit, Pausable와 migration 계약 전용 소각
- 생성 시 100억 IROA를 Genesis Safe에 한 번만 발행
- 일반 `mint` 함수 없음
- 일반 사용자 `burn` 함수 없음. binding된 Migration 계약만 자신이 수령한 V1을 `burnForMigration`으로 소각
- allowlist 정책을 통과한 지갑과 계약 사이에서만 이전
- `MIGRATION_ONLY`에서는 V1 → V2 Migration 계약으로 보내는 이전만 허용
- 상태는 `NORMAL_PRIVATE`, 해제 가능한 `PAUSED`, 불변인 `MIGRATION_ONLY`를 지원한다. `NORMAL_PRIVATE` 또는 `PAUSED`에서 `MIGRATION_ONLY`로 전환할 수 있으며, 이후 일반 이전을 영구 종료하되 migration 계약으로의 이전과 전용 소각은 허용한다.
- Base Mainnet과 Base Sepolia 이외의 배포는 별도 로컬 개발 profile만 허용
- 이름, symbol, 버전, 공식 사이트와 V1 상태를 공개

### 6.2 7개 전용 금고

| 금고 | 비율 | 수량 | 해제 원칙 |
|---|---:|---:|---|
| `NodeEmissionVault` | 25% | 2,500,000,000 | 12년 연차별 한도 |
| `EcosystemRewardVault` | 23% | 2,300,000,000 | 10년 단계별 집행, 단일 참여 보상 풀 |
| `ResearchBudgetVault` | 15% | 1,500,000,000 | 10년 연구개발 예산 |
| `TeamVestingVault` | 15% | 1,500,000,000 | 24개월 잠금 + 72개월 선형 해제 |
| `InvestorVestingVault` | 10% | 1,000,000,000 | 18개월 잠금 + 42개월 선형 해제 |
| `FoundationReserveVault` | 7% | 700,000,000 | 12개월 잠금 + 84개월 선형 해제 |
| `LiquidityReleaseVault` | 5% | 500,000,000 | 시작 시 2억, 잔여 3억은 36개월 선형 |

Genesis Safe는 배포 직후 하나의 Safe batch로 7개 금고에 정확한 수량을 전송한다. 합계 확인, 역할 이관과 배포자 권한 포기가 끝나기 전에는 private participant distribution을 시작하지 않는다.

### 6.3 NODE와 증명 계약

- `IROANodeRegistry`: 운영자, 기기 키, N0–N3 자격, 승인·정지·폐기
- `IROAReceiptRootRegistry`: epoch, Merkle root, 정책 버전, 제안·이의·확정 상태
- `IROARewardDistributor`: 확정 root와 proof 기반 청구, 전체 leaf hash 기반 중복 청구 방지. 검증된 청구 금액만 `NodeEmissionVault`에서 직접 해제해 미사용 월 예산은 금고에 유지
- 기능별 OpenZeppelin `AccessControl`: 계약별 운영 역할 관리. 각 `DEFAULT_ADMIN_ROLE`은 `IROATimelock`이 보유하고 배포자 EOA는 역할 이관 확인 후 모든 관리자 역할을 포기
- `IROATimelock`: Safe 제안의 지연 실행, 긴급 정지와 정상 관리 분리

## 7. NODE 보상과 토큰 이코노미

### 7.1 12년 NODE 배출

NODE 전용 25억의 연차별 비중은 백서 시뮬레이션을 고정 기준으로 사용한다.

```text
Year 1–12: 15%, 13%, 12%, 11%, 10%, 9%, 8%, 7%, 5%, 4%, 3%, 3%
```

각 연간 한도를 12개 월별 epoch로 나눈다. 검증된 작업이 부족하면 미사용 물량은 NODE 금고에 남고 다른 배분으로 자동 이동하지 않는다. 미사용 물량을 다음 달에 무제한 추가하지 않는다.

### 7.2 작업 점수

```text
TaskScore
= BaseWorkUnit
× CompletionGate
× SecurityGate
× (
    ResultQuality 40%
  + AccessibilityQuality 25%
  + Timeliness 15%
  + HumanHandoffQuality 10%
  + ResourceEfficiency 10%
  )
```

- 완료·보안 gate는 0 또는 1이다.
- Result Receipt와 Deletion Receipt가 모두 검증돼야 SecurityGate가 1이다.
- 가동시간 보너스는 검증된 작업 점수의 10% 이내이며 작업이 없는 NODE에는 지급하지 않는다.
- 여러 NODE의 점수는 운영자 단위로 합산한다.
- 파일럿에서 한 운영자의 월 보상은 해당 월 NODE 예산의 5% 이내다.
- 집중도 상한 초과분은 다른 운영자에게 자동 재분배하지 않고 NODE 금고에 남긴다.

```text
OperatorReward
= MonthlyNodeBudget
× OperatorValidScore
÷ TotalValidScore
```

자기거래, 중복 요청, 허위 완료, 서명 오류, 정책 불일치, 삭제 미준수와 분쟁 중인 작업은 보상에서 제외하거나 보류한다. 감점과 보류에는 근거, 정책 버전, 이의 절차가 있어야 한다.

### 7.3 생태계 참여 보상

사용자, 도움 제공자, 접근성 평가자, 기관, 병원, 상점과 지역 거점을 하나의 `EcosystemRewardVault`에서 관리한다. 지급 기준은 요청 완료 확인, 접근성 개선, 안전한 사람 인계, 현장 운영과 오류 재현이다. 개인정보 제공량, 대화시간과 앱 체류시간은 보상 기준이 아니다.

## 8. Task와 Receipt 계약

### 8.1 Task Capsule

```text
taskId
policyVersion
trustLevel
capabilityScope
expiresAt
inputCiphertextRef
expectedResultSchema
userApprovalHash
```

### 8.2 Result Receipt

```text
taskId
nodeId
operatorIdHash
startedAt
completedAt
resultHash
outcomeCode
accessibilityMetricsHash
policyVersion
nonce
nodeSignature
```

### 8.3 Deletion Receipt

```text
taskId
nodeId
deletedAt
storageScopeHash
runtimeImageHash
deletionMethod
policyVersion
nonce
nodeSignature
```

### 8.4 Reward leaf

```text
epoch
operatorIdHash
nodeId
score
rewardAmount
receiptBatchRoot
policyVersion
claimNonce
```

서명은 EIP-712 domain에 프로젝트명, 버전, chain ID와 검증 계약을 포함한다. Task nonce와 만료시간으로 재사용 공격을 막는다.

## 9. 요청 상태와 금지 전이

```text
Draft
→ AwaitingApproval
→ Queued
→ Assigned
→ Running
→ AwaitingConfirmation
→ Verified | Disputed | Failed | Cancelled
→ RewardPending
→ Rewarded
```

- 사용자 승인 없이 `Queued` 금지
- NODE 배정 없이 `Running` 금지
- Result Receipt 없이 `Verified` 금지
- Deletion Receipt 없이 `RewardPending` 금지
- 분쟁 중 `Rewarded` 금지
- 취소 요청 재실행에는 새 `taskId` 필요

NODE 응답이 없으면 lease 만료 후 다른 적격 NODE에 재배정한다. 이전 NODE의 nonce는 폐기한다. RPC 장애 시 작업 실행과 오프체인 검증은 계속할 수 있지만 결산 root 제출과 보상 청구는 대기열에 둔다.

## 10. 비공개 메인넷 검증

### 10.1 참여자 역할

- NODE 운영자
- 생태계 기여자
- 팀·자문 베스팅 수령자
- 초기 투자자 테스트 수령자
- 재단·treasury 운영자
- compliance·보안 검증자
- read-only 감사 관찰자

각 참여자는 지갑 소유 확인, 비공개 파일럿 동의, 관할과 법적 참여 가능 범위를 확인한 뒤 allowlist에 등록한다. 일반 사용자는 토큰 또는 지갑 없이 합성·모의 생활 요청을 수행한다.

### 10.2 메인넷 검증 흐름

1. V1 계약 배포와 BaseScan 검증
2. 7개 금고 배분과 공급 대사
3. Safe·Timelock 역할 이관, 배포자 권한 포기
4. private participant allowlist 등록
5. V1 수령, 베스팅 조회와 허용된 이전
6. NODE 등록·승인·정지·폐기
7. 합성 Task Capsule 실행
8. Result·Deletion Receipt 검증
9. 점수·분쟁·Merkle root 결산
10. 메인넷 IROA 보상 청구
11. 비상 정지·복구
12. V1 → V2 이전 리허설

파일럿에서도 공개 판매, DEX pool, 브리지와 제3자 보관 서비스는 열지 않는다.

## 11. 독립 감사와 V2 재발행

### 11.1 감사 범위

- V1 Token과 7개 금고
- Vesting과 월별·연차별 해제
- NODE Registry와 기기 자격 폐기
- Receipt root 제안·이의·확정
- Reward Distributor와 Merkle proof
- allowlist, pause, migration mode
- Safe·Timelock·운영 역할
- V1 → V2 Migration
- 배포 스크립트, 실제 메인넷 주소와 역할 보유자
- private participant 검증에서 발견된 실패와 복구 증거

감사 결과는 must-fix, migration-fix, 운영 통제와 acknowledged risk로 분류한다. 모든 must-fix와 migration-fix를 V2에 반영한 뒤 V2를 배포한다.

### 11.2 V1 → V2 공급 불변조건

V2는 cap이 100억이고 생성 시 초기 공급량은 0이다. V2의 migration 주소는 초기 공급 0 상태에서 정확히 한 번 binding하고 즉시 권한을 영구 잠근다. 이후 `IROAMigrationV1ToV2`만 V2를 발행할 수 있으며 다른 주소나 관리자에게 발행 권한을 부여하지 않는다. V2도 별도 공개 유통 설계와 승인이 있기 전까지 allowlist와 pause 정책을 유지하며 일반 burn을 제공하지 않는다. Migration은 한 transaction에서 다음 순서를 실행한다.

```text
1. 사용자 또는 V1 금고에서 amount V1 수령
2. 동일 transaction에서 amount V1 소각
3. 정확히 amount V2 발행
4. 사용자 또는 대응 V2 금고에 V2 전달
```

따라서 모든 시점에 다음이 성립해야 한다.

```text
V1.totalSupply + V2.totalSupply = 10,000,000,000 IROA
V2Minted = V1BurnedForMigration
```

Migration 계약은 토큰 주소, 비율과 수령 규칙이 immutable이며 일반 관리자 인출 기능을 두지 않는다. Migration 이외의 주소에는 V2 발행 권한을 부여하지 않는다.

### 11.3 베스팅과 금고 이전

- 이미 지급된 V1은 보유자가 직접 1:1 이전
- 미해제 V1은 V1 금고에서 소각하고 동일 수량을 V2 금고에 발행
- beneficiary, total allocation, start, cliff, end, released를 V2 schedule에 동일하게 복제
- NODE·생태계·연구개발·유동성 금고는 start, 월별 누적 한도, 이미 해제·청구된 수량과 잔여량을 동일하게 복제
- 이미 해제된 수량을 다시 vesting하지 않음
- V1/V2 금고 pair와 schedule import batch는 Migration 전용 역할, 공개 manifest와 일회성 ID로 제한하고 V1 소각·V2 발행·schedule import를 같은 transaction에서 완료
- V1/V2 schedule 대사표의 합계와 beneficiary별 잔여량이 일치해야 이전 완료

V2 이전 종료 후 V1은 migration-only 상태를 유지하며 공식 UI와 문서는 V2를 canonical token으로 표시한다. 잔여 V1 보유자가 이전할 수 있는 조회·migration 화면은 유지한다.

## 12. 개인정보와 보안

1차 파일럿은 합성·모의 생활 요청만 허용한다. 병원·금융·장애·가정 내부의 실제 민감정보는 사용하지 않는다.

- 작업 상태·점수·감사 기록: 접근통제된 관계형 DB
- 암호화 Task Capsule: 짧은 만료시간의 객체 저장소
- 계약 상태·결산 root: Base Mainnet
- 개인정보 원문·상세 행동기록: 온체인 금지
- NODE 기기 키: 운영자 지갑과 분리, 개별 폐기 가능
- 관리자: SSO/Access와 온체인 역할을 모두 확인
- 금전·역할 변경: Safe와 Timelock
- 보상 분쟁: 자동 박탈이 아니라 근거 공개와 사람 검토

법률 검토는 V1 private distribution 전에 수행한다. 검토 범위는 증권성, 가상자산사업자 해당 여부, 자금세탁방지, 세무·회계, 개인정보, 이용자 보호와 표시·광고다. 법률 검토는 독립 스마트계약 보안감사를 대체하지 않는다.

## 13. 장애 복구

| 장애 | 처리 |
|---|---|
| NODE 응답 없음 | lease 만료, nonce 폐기, 다른 NODE 재배정 |
| NODE 중간 종료 | 부분 결과 폐기, 새 실행 nonce 발급 |
| 잘못된 Receipt | 검증 거부, 원본 상태와 근거 보존 |
| 삭제 확인 실패 | 보상 보류, 신규 민감 작업 배정 중지 |
| RPC 장애 | root 제출·claim 대기, 오프체인 작업 상태 유지 |
| 잘못된 root | 이의 기간 중 취소 후 새 root 제안 |
| NODE 키 탈취 | 기기 키 폐기, 운영자와 다른 NODE 유지 |
| 관리자 계정 탈취 | 온체인 역할 없으면 거부, Safe·Timelock으로 회복 |
| 중복 청구 | epoch·leaf 청구 상태로 계약에서 거부 |
| V1 결함 | pause 또는 migration-only 전환, 감사 증거 보존 |
| V2 이전 실패 | 원자적 transaction revert로 V1 소각과 V2 발행 모두 취소 |

## 14. 개발 순서

외부 감사기관의 일정은 별도이며, 감사 제출 전 engineering 기간은 약 10–12주로 계획한다.

### 14.1 MODULE_GENERATION

1. 공통 protocol, chain manifest, EIP-712 타입
2. V1 Token, 7개 금고, Vesting, Timelock
3. NODE Registry, Receipt Root Registry, Reward Distributor
4. Control API와 요청 상태
5. NODE Agent와 합성 실행 plugin
6. Verifier, 보상 점수, 분쟁과 Merkle 결산
7. sandbox, operator, admin
8. Base Sepolia 배포·이관 runbook 생성
9. V1 Mainnet 배포·private validation runbook 생성
10. V1 → V2 Migration과 V2 schedule import

이 단계는 모듈과 인터페이스 생성에 집중한다. 전체 테스트, 전체 typecheck/build, 브라우저 suite와 전체 diff review를 실행하지 않는다.

### 14.2 REVIEW_FIX

각 모듈 생성 후 소스를 검토한다. 계약 불변조건, 권한, 재진입, replay, 상태 전이, 개인정보, 공급 대사, migration 원자성, 실패 복구와 유지보수성을 확인한다. 확인된 결함마다 해당 결함을 재현하는 가장 작은 테스트만 작성·실행하고 최소 수정 후 직접 영향 테스트만 다시 실행한다.

### 14.3 FINAL_INTEGRATION

모든 모듈과 review finding 수정이 끝난 뒤 한 번만 수행한다.

- 전체 Solidity regression, invariant와 migration 검증
- 전체 API·frontend typecheck와 production build
- 정적 분석과 dependency/security review
- 7개 금고 합계, vesting, epoch cap과 공급 불변조건
- Base Sepolia end-to-end rehearsal
- 실제 브라우저의 사용자·운영자·관리자 흐름
- 접근성 검증
- Base Mainnet preflight와 배포 artifact 검토
- 최종 전체 소스 review

GitHub Actions 실행은 별도 사용자 승인이 있어야 한다. FINAL_INTEGRATION 통과는 mainnet transaction 서명이나 배포를 자동 승인하지 않는다. Mainnet 배포는 주소, Safe signer, gas wallet, contract hash와 runbook을 사람이 확인한 별도 서명식으로 수행한다.

## 15. 단계별 출시

| 단계 | 결과 | 진입 조건 |
|---|---|---|
| A | 로컬·Base Sepolia 완성 | 모듈 review/fix와 FINAL_INTEGRATION 통과 |
| B | V1 Base Mainnet 발행 | 배포 artifact·Safe·Timelock·법률 범위 확인 |
| C | private participant 검증 | V1 주소 검증, 7개 금고 대사, allowlist 운영 준비 |
| D | 독립 스마트계약 감사 | 실제 V1 주소·운영 증거·migration code 제출 |
| E | V2 배포·1:1 migration | audit must-fix 반영과 V2 migration rehearsal 통과 |

## 16. 완료 조건

- V1 100억 IROA가 Base Mainnet에서 발행되고 소스와 생성자 인자가 검증됐다.
- 7개 금고의 수량 합계와 백서 비율이 일치한다.
- Safe·Timelock이 주요 역할을 보유하고 배포자 권한이 제거됐다.
- 승인된 private participant만 V1을 수령·이전할 수 있다.
- 일반 사용자는 지갑·토큰 없이 합성 요청을 완료할 수 있다.
- NODE 등록부터 Receipt, 분쟁, reward claim까지 메인넷 흐름이 완료된다.
- 미검증·중복·삭제 미준수 작업에 보상이 지급되지 않는다.
- 실제 V1 계약과 운영 증거가 독립 스마트계약 감사를 받는다.
- V2가 audit must-fix를 반영해 새 주소로 배포된다.
- V1 소각과 V2 발행이 1:1이며 두 token total supply 합계가 100억을 넘지 않는다.
- 베스팅과 7개 금고의 V2 잔여 수량이 V1 상태와 일치한다.
- 공개 판매, DEX, 브리지와 상장은 별도 승인 전까지 비활성이다.
