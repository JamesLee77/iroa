# IROA 온체인 계약 소스 리뷰와 백서 달성 설계

날짜: 2026-09-06  
상태: 리뷰 완료 · 수정 4건 적용 · 설계 초안 (오너 검토 대기)  
기준 브랜치: `main` (`35e1117`)  
대상: `onchain/contracts/` 13개 계약 (token 2, migration 2, vaults 4, settlement 2, node 1, governance 1, test 1)  
참조: 백서 §16 토큰 이코노미, 파일럿 설계 `2026-08-30-iroa-web3-mainnet-private-pilot-design.md`

## 1. 요약

13개 계약 1,677줄을 읽고 흐름별로 검토했다. 치명(자금 손실·발행 초과)은 없다. 공급 불변조건(V1+V2 ≤ 100억, 소각=발행)과 7개 금고 배분(백서 §16.2와 수량 일치)은 코드와 테스트가 함께 지킨다.

수정한 것은 4건이다.

| # | 심각도 | 계약 | 문제 | 수정 |
|---|---|---|---|---|
| F1 | 중 | 금고 3종 | `migrateRemaining`이 잔액 == 남은 배분을 요구. 마이그레이션 모드 전에 allowlist 보유자가 1 wei만 보내도 그 금고의 V2 이전이 영구히 막힘(빼낼 함수 없음) | 부족할 때만 revert. 잉여는 V1에 남김 |
| F2 | 중 | `IROATokenV1` | 마이그레이션 모드에서 `pause` 불가. 이전 중 결함이 발견돼도 멈출 수 없음 | 마이그레이션 모드에서도 pause 가능. `unpause`는 바인딩이 있으면 MIGRATION_ONLY로 복귀(NORMAL로 열리지 않음) |
| F3 | 중 | `IROATokenV1`·`IROATokenV2` | `enterMigrationMode`/`bindMigrationContract`가 코드 존재만 확인. 다른 토큰용으로 배포된 마이그레이션 계약을 되돌릴 수 없게 바인딩할 수 있음 | 계약의 `v1()`/`v2()`가 자기 주소인지 확인 |
| F4 | 중 | `IROANodeRegistry` | 등록이 공개라 남이 실제 운영자의 기기 키 해시를 먼저 등록하면 그 운영자는 영원히 등록 불가 | `rejectNode`(COMPLIANCE): 승인된 적 없는 등록을 닫고 기기 키를 해제. 한 번 활성이었던 키는 `revokeDeviceKey`로 계속 잠금 |

정리: `_requireNode`/`_requireNodeView` 중복 제거.

## 2. 계약별 리뷰

### 2.1 `IROATokenV1`
- 발행은 생성자에서 한 번, `mint`/`burn` 없음. 소각은 마이그레이션 계약만, 마이그레이션 모드에서만.
- `_update`: PAUSED → 전면 차단. MIGRATION_ONLY → (allowlist 보유자 → 마이그레이션 계약, 호출자=마이그레이션) 또는 (마이그레이션 → 0) 만 허용. NORMAL → 양쪽 allowlist.
- F2, F3 적용. `permit`은 허용량만 만들고 이동은 `_update`가 막으므로 문제 없음.
- 남은 설계 사항: V1 allowlist와 V2 allowlist가 별개. V2에 등록되지 않은 V1 보유자는 `migrate()`가 V2 `_update`에서 revert → V1에 갇힘. 운영 절차로 해결(§4.4).

### 2.2 `IROATokenV2`
- 초기 공급 0, cap 100억, 발행은 잠긴 마이그레이션 계약만. 등록된 마이그레이션 금고는 allowlist 우회.
- F3 적용. `totalSupply != 0` 검사는 바인딩 전에는 도달 불가(발행 주체가 없음) — 방어 코드로 둠.

### 2.3 `IROAMigrationV1ToV2`
- `migrate`: transferFrom → V1 소각 → V2 발행, `assert(burned == minted)`. 잔액 차이 검사로 수수료형 토큰 배제.
- `migrateVault`: 7쌍 잠금 후에만, 호출자=V1 금고, 스냅샷 해시·배치 ID·스케줄 ID 1회성, import 결과 해시·수량 대조. 원자적.
- 이상 없음. 비상 정지는 V1 `pause`(F2)로 해결.

### 2.4 `MonthlyEmissionVault`
- 연차 가중치 합 100, 마지막 달 나머지 처리로 연간·총량 정확. 미사용 예산은 이월 없음(백서·파일럿 설계와 일치).
- 보상 전용(`rewardClaimsOnly`) 금고는 `releaseReward`만, 에폭 종료 후, 월 예산 한도. 비상 레버 = admin이 `REWARD_DISTRIBUTOR_ROLE` 회수.
- F1 적용.

### 2.5 `CliffLinearVestingVault` · `LiquidityReleaseVault`
- 절벽·선형 계산은 월 단위 계단식(30일). 초기 유동성 2억 즉시 + 3억 36개월 = 백서 §16.3.
- `migrateRemaining`은 수익자/트레저리만 호출 가능 → 키 분실 시 이전 불가(§4.4 운영 항목).
- F1 적용.

### 2.6 `V2ScheduleImporter`
- 스냅샷 검증(종류별 필드, 누적표 단조·총량 일치), 담보 ≥ 누적 import 잔여. 정확하다.
- **하지만 해제 함수가 없다.** 이전된 토큰은 importer에 머물고 나갈 길이 없다. 이것이 백서 달성의 가장 큰 공백이다(§3 G1).

### 2.7 `IROAReceiptRootRegistry`
- 제안 → 이의 창(메인넷 7일·Sepolia 24h·로컬 60s) → 누구나 확정. 이의는 CHALLENGER_ROLE, 취소는 admin(Timelock), 취소 후 재제안은 revision 증가. 확정 루트 불변.
- 이상 없음. 이의 제기가 역할 기반이라 운영자가 직접 이의를 걸 수 없음(§3 G4).

### 2.8 `IROARewardDistributor`
- 확정 루트·receiptBatchRoot·정책 버전 해시 대조 → NODE Active·지갑·operatorIdHash·allowlist 검증 → 리프 이중 해시 Merkle 증명 → 운영자 월 5% 상한 → 금고 `releaseReward`. 파일럿 설계 §7.2와 일치.
- `token`이 V1 allowlist에 immutable → V2 전환 시 새 배포 필요(§3 G2).
- 정지 뒤 청구 불가 = "보상 보류"(백서 §16.4)와 일치. 환수(clawback)는 온체인에 없음(§3 G5).

### 2.9 `IROANodeRegistry`
- 등록 공개 → Pending, 승인·정지·재개는 역할, 기기 키 폐기는 운영자 또는 컴플라이언스, 지갑 변경은 운영자 EIP-712 서명 + 컴플라이언스 실행. 신뢰 수준 0–3.
- F4 적용. 기기 키 소유 증명(등록 시 기기 키 서명)은 ABI 변경이 운영자 포털·node-agent에 파급되므로 V2 등록부 항목으로 넘김(§3 G3).
- 신뢰 수준은 등록 후 변경 불가 → 재등록 필요(§3 G3).

### 2.10 `IROATimelock`
- 메인넷·Sepolia 48시간 하한, 로컬 예외, `updateDelay` 하한 유지. 이상 없음.

## 3. 백서 달성 공백 (설계)

| # | 백서 약속 | 현재 | 공백 |
|---|---|---|---|
| G1 | §16.3 잠금 해제 일정이 V2에서도 이어짐 | V2 importer는 스냅샷만 저장 | **V2 해제 금고 없음** |
| G2 | §16.4 NODE 보상이 V2에서 계속 지급 | 분배기·금고가 V1에 고정 | V2 보상 분배기·NODE 금고 없음 |
| G3 | §8.3 실행 공간의 신뢰 수준과 증명 상태 | 신뢰 수준 고정, 기기 키 소유 증명 없음 | 등록부 V2 |
| G4 | §15.5 보상 분쟁 절차 | 이의는 재단 역할만 | 운영자 이의 경로 |
| G5 | §16.4 허위 작업 시 환수 | 청구 후 회수 불가 | 환수 수단 |
| G6 | 창립자 합의서(10% 즉시 교부·처분 제한) vs 팀·자문 금고(24+72개월 베스팅) | 온체인은 베스팅 | **정합 결정 필요** |

### G1 · V2 해제 금고 (최우선)

`V2ScheduleImporter`를 확장하지 않고 **해제 계약을 분리**한다. importer는 이전 순간의 진실(스냅샷)만 보관하고, 해제 계약이 그 스냅샷을 읽어 지급한다. 이전 자체(원자적 소각·발행·import)는 변경하지 않는다.

```
V2ScheduleImporter (기존, 불변)      V2ScheduleVault (신규)
  importSchedule(snapshot)             constructor(importer, token, releaseManager?)
  getSchedule(id)                      releasable(id, now) — CliffLinear: V1 vestedAt와 동일 수식
  cumulativeReleasePoint(id, i)                              MonthlyCumulative: table[monthIndex] - released
                                       release(id)          — CliffLinear: beneficiary에게
                                       releaseForMonth(id, amount) — 집행형(생태계·연구개발), RELEASE_MANAGER
                                       releaseReward(id, epoch, to, amount) — NODE 보상 전용, REWARD_DISTRIBUTOR
```

- 토큰은 importer가 보유하므로 vault는 importer에서 `transfer`할 권한이 필요하다. importer는 불변이므로 **V2ScheduleVault가 importer 역할을 겸하는 하나의 계약**(`V2ScheduleVault is V2ScheduleImporter`)으로 배포하는 편이 단순하다. 7개 V2 금고 = 7개 `V2ScheduleVault`. 기존 importer 코드는 상속으로 그대로 쓴다.
- 해제 수식은 V1 금고와 바이트 단위로 같은 계단식을 유지해 이전 전후 해제량이 이어진다. 테스트: 같은 시각에 V1 `vestedAt`와 V2 `releasable + released`가 같다.
- NODE 금고(`rewardClaimsOnly`)의 V2 대응은 `releaseReward`만 열고, 월 예산은 누적표 차분으로 계산한다.

### G2 · V2 보상 분배기

`IROARewardDistributor`를 그대로 두고 생성자 인자만 V2 토큰·V2 NODE 금고로 바꿔 **재배포**한다. 등록부·루트 등록부는 토큰 무관이라 재사용. 에폭 번호는 V1 시작 시각 기준으로 계속 센다(`start`가 스냅샷에 있음). V1 분배기는 마지막 V1 에폭 확정 후 금고 역할을 회수해 폐쇄.

### G3 · 등록부 V2 (파일럿 뒤)

- `registerNode`에 기기 키 EIP-712 서명 추가(소유 증명). node-agent가 서명을 만들고 운영자 포털이 전달.
- `changeTrustLevel(nodeId, level)` (COMPLIANCE) — 증명 상태에 따라 등급 조정.
- 등록 수수료 또는 보증금은 백서가 요구하지 않으므로 넣지 않는다.

### G4 · 운영자 이의

온체인 이의는 파일럿 동안 재단 역할로 유지한다(파일럿 설계 §2). 운영자는 control-api `/v1/disputes`(verifier `disputes.ts`)로 이의를 제기하고, 재단이 근거 해시로 `challengeRoot`를 실행한다. V2에서 보증금 기반 공개 이의를 검토한다.

### G5 · 환수

청구 이후 회수는 토큰 설계상 불가(강제 이전 없음). 대안 두 가지 중 택일.
1. **청구 지연**: 확정 후 N개월 청구 유예 — 단순하나 정직한 운영자도 늦게 받음.
2. **다음 에폭 상계**: 허위가 확인된 운영자의 다음 에폭 점수에서 차감 — verifier `epoch-budget.ts`에 `penalties` 입력 추가. 온체인 변경 없음. **권장.**

### G6 · 창립자 합의서 정합 (오너 결정)

합의서 초안은 창립자 10%를 즉시 교부하고 처분만 제한한다. 온체인 팀·자문 금고(15%, 24개월 절벽 + 72개월 선형)는 그 안의 창립자 몫도 베스팅한다. 둘 중 하나로 맞춰야 한다.
- (a) 합의서를 금고에 맞춤 — 창립자 몫도 베스팅
- (b) 금고를 합의서에 맞춤 — 팀·자문 15%를 창립자 10%(즉시 교부, 처분 제한은 allowlist로 구현) + 기타 5%(베스팅)로 분리. 백서 §16.3 "팀 물량 출시 시점 미유통"과 충돌하므로 백서 개정 필요.
합의서 확인사항 9번과 함께 결정한다.

## 4. 운영 항목 (코드 변경 없음)

1. V2 allowlist를 V1 allowlist에서 미리 복제한 뒤 마이그레이션 모드 진입.
2. 금고 잉여(F1)는 이전 뒤 V1에 남는다 — 대사표에 "V1 잔여 잉여"로 기록.
3. Cliff/Liquidity 금고의 `migrateRemaining`은 수익자 키가 필요 — 수익자 지갑은 Safe로.
4. 배포 manifest `controls.deploymentBlock`을 기록 — 공개 사이트가 전체 이력을 읽는 기준.
5. 관리자 콘솔 `Nodes` 화면에 `rejectNode` 버튼 추가(별도 PR).

## 5. 검증

| 층 | 결과 |
|---|---|
| 소스 리뷰 | 13개 계약 전수, 흐름별 |
| REVIEW_FIX 집중 테스트 | `IROATokenV1` 8/8 (신규 2), `IROATokenV2` 1/1 (신규), `Migration.invariant` 15/15 (신규 2: 잉여 1 wei 이전 성공·부족 시 revert), `NodeSettlement` 12/12 (신규 2: 스쿼팅 키 해제·활성 NODE 거부 불가) |
| 변이 검사 | Cliff 금고의 F1을 `!=`로 되돌리자 잉여 테스트 1건이 `MigrationBalanceMismatch(…000, …001)`로 실패 → 복원 |
| FINAL_INTEGRATION | `onchain` 전체 hardhat **56/56 passing** (배포 스크립트·타임락·금고·마이그레이션 불변조건 포함), `solc 0.8.24` 13개 파일 컴파일 |
| CI | 없음 |
