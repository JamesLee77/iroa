# IROA Web3 V1 Mainnet Private Pilot Implementation Plan

> **For implementers:** Follow `module-first-development` and this repository's three-phase validation gate task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Base Mainnet에 100억 IROA V1을 비공개 전송 제한 상태로 발행하고, NODE 등록부터 검증 증명·분쟁·보상까지 private participant가 검증할 수 있는 전체 시스템과 V2 1:1 migration 기반을 구축한다.

**Architecture:** 기존 Astro 홈페이지는 루트에 유지하고, 독립 npm workspace로 onchain, control-api, verifier, node-agent, sandbox, operator와 admin을 추가한다. 개인정보와 Task 원문은 오프체인에 두고 EIP-712 Receipt와 월별 Merkle root만 Base에 결산한다. V1은 한 번만 100억을 발행하며, V2는 초기 공급 0에서 V1이 소각된 수량만큼만 원자적으로 발행한다.

**Tech Stack:** Node.js 22.12+, TypeScript 6.0.3, Solidity 0.8.24, OpenZeppelin Contracts 5.6.1, OpenZeppelin Merkle Tree 1.0.8, Hardhat 3.15.0, Hardhat Ethers+Mocha Toolbox 3.0.7, ethers 6.17.0, viem 2.56.0, Hono 4.13.5, Zod 4.5.4, Cloudflare Wrangler 4.127.1, React 19.2.8, Vite 8.2.2, wagmi 2.19.5, RainbowKit 2.2.11, Vitest 4.1.11, Playwright 1.62.1

**Spec:** `docs/superpowers/specs/2026-08-30-iroa-web3-mainnet-private-pilot-design.md`

## Global Constraints

- V1의 총공급은 정확히 `10_000_000_000 ether`이며 일반 `mint` 함수가 없어야 한다.
- V1은 Base Mainnet에서 발행하고 Base Sepolia에서 동일 bytecode와 역할 이관을 먼저 리허설한다.
- V1은 allowlist 지갑·금고·보상·migration 계약 사이에서만 이전할 수 있다.
- 공개 판매, DEX, 브리지, 담보·대출과 공개 지갑 간 자유 이전을 구현하지 않는다.
- 7개 배분은 25%, 23%, 15%, 15%, 10%, 7%, 5%이고 다른 pool로 자동 재배분하지 않는다.
- NODE 보상은 검증된 Result Receipt와 Deletion Receipt가 모두 있는 작업에만 지급한다.
- 일반 서비스 사용자는 토큰 또는 지갑 없이 요청·승인·취소·결과 확인을 수행한다.
- 실제 개인정보와 민감정보를 사용하지 않고 합성·모의 Task만 허용한다.
- V2의 초기 공급은 0이고 `IROAMigrationV1ToV2`만 V2를 발행할 수 있다. V2도 별도 공개 유통 승인 전까지 allowlist·pause 정책을 유지하고 일반 burn을 제공하지 않는다.
- 모든 migration은 같은 transaction에서 V1을 소각한 뒤 같은 수량의 V2를 발행한다.
- `V1.totalSupply() + V2.totalSupply() == 10_000_000_000 ether`를 모든 migration 상태에서 유지한다.
- 주요 관리자 역할은 Safe가 제안하고 `IROATimelock`이 실행한다. 배포자 EOA는 역할 이관 뒤 관리자 역할을 포기한다.
- 기존 홈페이지·웹 백서·협약서와 사용자의 미추적 파일을 이동·삭제·재구성하지 않는다.
- GitHub Actions는 사용자가 명시적으로 승인하기 전에는 실행·재실행하지 않는다.
- Base Mainnet transaction은 FINAL_INTEGRATION과 배포 artifact 검토가 끝난 뒤 별도 서명식에서만 실행한다.
- V1 private participant distribution은 증권성, 가상자산사업자, 자금세탁방지, 세무·회계, 개인정보, 이용자 보호와 표시·광고 범위의 서면 법률 검토가 완료된 뒤 시작한다.

## Validation Phase Contract

- `MODULE_GENERATION`: 모듈 구현과 모듈 회귀 test source 생성만 수행한다. test, 전체 typecheck/build, browser suite와 전체 diff review를 실행하지 않는다.
- `REVIEW_FIX`: 완성된 모듈을 LLM이 소스 검토한다. 확인된 결함이 있을 때만 정확한 test file·case를 지정한 finding item을 만들고 RED/GREEN 명령을 실행한다. 결함이 없으면 실행 명령 없이 검토 결과만 기록한다.
- `FINAL_INTEGRATION`: 모든 모듈과 accepted finding이 끝난 뒤 Task 14에서 전체 회귀·typecheck·build·정적 분석·browser flow를 한 번만 실행한다.

---

## File Structure

```text
package.json                              npm workspace와 terminal integration scripts
tsconfig.base.json                        공통 TypeScript strict 설정
packages/protocol/                        Task·Receipt·Reward·Policy 계약
packages/crypto/                          EIP-712, id hash와 Merkle 도구
packages/contracts/                       ABI, chain과 deployment manifest
onchain/contracts/token/                  V1, V2, Migration
onchain/contracts/vaults/                 7개 배분 금고 구현
onchain/contracts/node/                   NODE Registry
onchain/contracts/settlement/             Receipt root와 Reward Distributor
onchain/contracts/governance/             Timelock
onchain/scripts/                           deploy, role handoff, reconcile, verify
onchain/test/                              contract regression과 invariant source
control-api/src/                           Task 상태·NODE lease·감사 API
node-agent/src/                            enrollment·heartbeat·합성 executor·Receipt
verifier/src/                              Receipt 검증·점수·분쟁·Merkle 결산
sandbox/src/                               지갑 없는 일반 사용자 흐름
operator/src/                              NODE 운영자와 reward claim 흐름
admin/src/                                 승인·정지·분쟁·root·Timelock 흐름
docs/architecture/runbooks/               Sepolia, Mainnet, private validation, migration
```

---

### Task 1: Workspace와 공통 Protocol 계약

**Phase:** MODULE_GENERATION → REVIEW_FIX

**Files:**
- Modify: `package.json`
- Create: `tsconfig.base.json`
- Create: `packages/protocol/package.json`
- Create: `packages/protocol/tsconfig.json`
- Create: `packages/protocol/src/task.ts`
- Create: `packages/protocol/src/receipt.ts`
- Create: `packages/protocol/src/reward.ts`
- Create: `packages/protocol/src/policy.ts`
- Create: `packages/protocol/src/index.ts`
- Create: `packages/protocol/src/protocol.test.ts`

**Interfaces:**
- Produces: `TaskState`, `TaskCapsule`, `ResultReceipt`, `DeletionReceipt`, `RewardLeaf`, `PolicyVersion`, `canTransition()`
- Consumes: 없음

- [x] **Step 1: npm workspace 설정**

루트 `package.json`에 다음 workspace와 terminal scripts를 추가한다. 기존 Astro scripts는 유지한다.

```json
{
  "workspaces": [
    "packages/*", "onchain", "control-api", "node-agent",
    "verifier", "sandbox", "operator", "admin"
  ],
  "scripts": {
    "test:all": "npm run test:run && npm run test --workspaces --if-present",
    "typecheck:all": "npm run typecheck && npm run typecheck --workspaces --if-present",
    "build:artifact": "npm run sync:whitepaper-assets && npm run render:og && astro build",
    "build:all": "npm run build:artifact && npm run build --workspaces --if-present",
    "test:e2e:all": "playwright test && npm run test:e2e --workspace sandbox && npm run test:e2e --workspace operator && npm run test:e2e --workspace admin"
  }
}
```

workspace test scripts는 watch가 아닌 one-shot mode를 사용한다. 세 app의 E2E script는 Task 14에서 이미 생성한 artifact를 serve하며 자체 build를 다시 호출하지 않는다.

- [x] **Step 2: 공통 상태와 상태 전이 구현**

```ts
export type TaskState =
  | 'draft' | 'awaiting_approval' | 'queued' | 'assigned' | 'running'
  | 'awaiting_confirmation' | 'verified' | 'disputed' | 'failed'
  | 'cancelled' | 'reward_pending' | 'rewarded';

export function canTransition(from: TaskState, to: TaskState): boolean;
```

전이표는 Spec 9절만 허용한다. `cancelled`와 `rewarded`는 terminal state다.

- [x] **Step 3: Capsule과 Receipt 타입 구현**

모든 시간은 Unix seconds `number`, 모든 hash는 ``0x${string}``, 금액은 decimal string으로 직렬화한다. `ResultReceipt`와 `DeletionReceipt`에는 `chainId`, `verifyingContract`, `nonce`를 포함한다.

- [x] **Step 4: module regression source 생성**

`protocol.test.ts`에 허용·금지 상태 전이, hash 형식, 음수 시간이 거부되는 Zod schema test를 작성하되 실행하지 않는다.

- [x] **Step 5: 커밋**

```bash
git add package.json tsconfig.base.json packages/protocol
git commit -m "feat: define IROA protocol contracts"
```

- [x] **Step 6: 소스 검토와 REVIEW_FIX 경계**

상태 우회, 직렬화 손실, hash 길이, nonce 누락과 terminal state 재진입을 검토한다. 결함이 확인되지 않으면 test를 실행하지 않는다. 결함이 확인되면 finding 이름, test file과 단일 case를 기록한 REVIEW_FIX item을 먼저 만든다.

---

### Task 2: EIP-712·Merkle·Chain Manifest

**Phase:** MODULE_GENERATION → REVIEW_FIX

**Files:**
- Create: `packages/crypto/package.json`
- Create: `packages/crypto/src/eip712.ts`
- Create: `packages/crypto/src/ids.ts`
- Create: `packages/crypto/src/merkle.ts`
- Create: `packages/crypto/src/crypto.test.ts`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/src/chains.ts`
- Create: `packages/contracts/src/manifest.ts`
- Create: `packages/contracts/deployments/base-sepolia.json`
- Create: `packages/contracts/deployments/base.json`

**Interfaces:**
- Consumes: `ResultReceipt`, `DeletionReceipt`, `RewardLeaf`
- Produces: `resultReceiptTypedData()`, `deletionReceiptTypedData()`, `hashOperatorId()`, `buildRewardTree()`, `verifyRewardProof()`, `DeploymentManifest`

- [x] **Step 1: EIP-712 domain과 message builder 구현**

```ts
export type ReceiptDomainInput = {
  chainId: 8453 | 84532;
  verifyingContract: `0x${string}`;
  version: string;
};

export function resultReceiptTypedData(
  domain: ReceiptDomainInput,
  receipt: ResultReceipt,
): TypedDataDefinition;
```

domain name은 `IROA Receipt`, version은 policy major version, message에는 `taskId`, `nodeId`, `policyVersion`, `nonce`, `resultHash`를 포함한다.

- [x] **Step 2: Reward leaf와 Merkle tree 구현**

logical leaf tuple은 `(epoch, operatorIdHash, nodeId, score, rewardAmount, receiptBatchRoot, policyVersion, claimNonce)`다. leaf hash는 OpenZeppelin `StandardMerkleTree`의 표준인 `keccak256(bytes.concat(keccak256(abi.encode(...))))`로 만들고 sorted pair tree를 사용한다. offchain builder와 Solidity verifier는 같은 field type·순서·double-hash 규칙을 공유한다.

- [x] **Step 3: chain manifest 구현**

`base.json`과 `base-sepolia.json`은 빈 주소 문자열을 허용하지 않는다. `assertManifestForChain(manifest, chainId)`가 다른 체인의 manifest 사용을 거부한다.

- [x] **Step 4: module regression source 생성**

동일 Receipt의 deterministic hash, chain ID 변경 시 다른 digest, 중복 leaf 거부, 잘못된 proof 거부를 작성하되 실행하지 않는다.

- [x] **Step 5: 커밋과 소스 검토**

```bash
git add packages/crypto packages/contracts
git commit -m "feat: add receipt cryptography and chain manifests"
```

signature replay, chain confusion, ambiguous packed encoding과 duplicate leaf를 검토하고 confirmed finding에만 REVIEW_FIX를 적용한다.

---

### Task 3: V1 Token과 7개 Allocation Vault

**Phase:** MODULE_GENERATION → REVIEW_FIX

**Files:**
- Create: `onchain/package.json`
- Create: `onchain/hardhat.config.ts`
- Create: `onchain/contracts/token/IROATokenV1.sol`
- Create: `onchain/contracts/vaults/MonthlyEmissionVault.sol`
- Create: `onchain/contracts/vaults/CliffLinearVestingVault.sol`
- Create: `onchain/contracts/vaults/LiquidityReleaseVault.sol`
- Create: `onchain/contracts/governance/IROATimelock.sol`
- Create: `onchain/test/IROATokenV1.test.ts`
- Create: `onchain/test/AllocationVaults.test.ts`

**Interfaces:**
- Produces: `IROATokenV1`, `setAllowed(address,bool)`, `enterMigrationMode(address)`, `burnForMigration(uint256)`, `MonthlyEmissionVault.releasableAt(uint64)`, `CliffLinearVestingVault.releasable(address)`, `LiquidityReleaseVault.releasableAt(uint64)`
- Consumes: Genesis Safe, Timelock과 7개 vault addresses

- [x] **Step 1: onchain workspace 생성**

Solidity `0.8.24`, OpenZeppelin `5.6.1`, Hardhat `3.15.0`, `@nomicfoundation/hardhat-toolbox-mocha-ethers` `3.0.7`, ethers `6.17.0`을 exact version으로 고정한다. compiler optimizer는 `runs: 200`, metadata bytecode hash는 `ipfs`로 고정한다.

- [x] **Step 2: V1 구현**

```solidity
uint256 public constant GENESIS_SUPPLY = 10_000_000_000 ether;
bytes32 public constant ALLOWLIST_MANAGER_ROLE = keccak256("ALLOWLIST_MANAGER_ROLE");
bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

function setAllowed(address account, bool allowed) external;
function enterMigrationMode(address migration) external;
function burnForMigration(uint256 amount) external;
function migrationContract() external view returns (address);
```

constructor가 Genesis Safe에 `GENESIS_SUPPLY`를 발행하고 public/external mint 또는 일반 사용자 burn을 노출하지 않는다. `burnForMigration`은 migration mode에서 binding된 Migration contract만 자신의 V1 잔액을 소각할 수 있다. 상태는 `NORMAL_PRIVATE`, `PAUSED`, `MIGRATION_ONLY`로 관리한다. pause는 정상 private 전송을 막고, 감사 후 실행하는 `enterMigrationMode`는 pause 여부와 관계없이 한 번만 가능하며 migration 주소를 고정한다. 불변 상태인 migration mode에서는 migration contract로의 이전과 그 계약의 전용 소각만 허용한다.

- [x] **Step 3: Vault 구현**

`MonthlyEmissionVault`는 immutable 월별 누적 release table을 사용한다. NODE 12년 weight는 `[15,13,12,11,10,9,8,7,5,4,3,3]`, ecosystem 10년 weight는 `[12,12,11,11,10,10,9,9,8,8]`, R&D 10년 weight는 `[12,12,12,12,12,10,10,8,6,6]`으로 고정한다. 각 연도 물량을 12개월로 동일 분할하되 해당 연도의 마지막 달이 wei 나머지를 흡수하고, 최종 누적값은 allocation과 정확히 같아야 한다. 미사용 잔액은 해당 vault에 남긴다.

`CliffLinearVestingVault`는 beneficiary별 `total`, `released`, `start`, `cliff`, `linearDuration`을 저장하고 team, investor, foundation address로 각각 배포한다. cliff 동안 0이고 cliff 종료 시점부터 team 72개월, investor 42개월, foundation 84개월 동안 선형 해제하며 마지막 달이 wei 나머지를 흡수한다. `LiquidityReleaseVault`는 genesis 2억과 36개월 동안 나머지 3억만 해제한다. 해제는 private treasury 운용 한도일 뿐 DEX·공개 판매·공개 지갑 배분을 자동 실행하지 않는다.

- [x] **Step 4: Timelock 구현**

Base Mainnet과 Base Sepolia에서 최소 48시간을 강제하고 local chain만 짧은 delay를 허용한다. proposer와 executor는 Safe, admin은 zero address를 기본 배포값으로 사용한다. Genesis Safe와 7개 vault는 allocation 전에 allowlist에 등록하고 read-back한 뒤에만 Safe allocation batch를 실행한다.

- [x] **Step 5: module regression source 생성**

100억 one-shot supply, mint selector와 일반 burn selector 부재, allowlist 전송, migration contract 외 `burnForMigration` 거부, migration-only 전송, 7개 배분 합계, 각 cliff와 마지막 달 exact release를 test source로 작성하되 실행하지 않는다.

- [x] **Step 6: 커밋과 소스 검토**

```bash
git add onchain
git commit -m "feat: add IROA V1 token and allocation vaults"
```

공급 증가 경로, role escalation, rounding dust, timestamp 경계, pause와 migration deadlock, Safe/Timelock 역할을 검토한다. confirmed finding에만 단일 contract test REVIEW_FIX를 적용한다.

---

### Task 4: NODE Registry와 Receipt·Reward Settlement

**Phase:** MODULE_GENERATION → REVIEW_FIX

**Files:**
- Create: `onchain/contracts/node/IROANodeRegistry.sol`
- Create: `onchain/contracts/settlement/IROAReceiptRootRegistry.sol`
- Create: `onchain/contracts/settlement/IROARewardDistributor.sol`
- Create: `onchain/test/NodeSettlement.test.ts`

**Interfaces:**
- Produces: `registerNode`, `approveNode`, `suspendNode`, `revokeDeviceKey`, `proposeRoot`, `challengeRoot`, `finalizeRoot`, `claim`
- Consumes: V1 Token, NodeEmissionVault, Timelock, verifier signer

- [x] **Step 1: NODE Registry 구현**

```solidity
enum NodeStatus { Pending, Active, Suspended, Revoked }
struct NodeRecord {
  address operatorWallet;
  bytes32 operatorIdHash;
  bytes32 deviceKeyHash;
  uint8 trustLevel;
  NodeStatus status;
  uint64 registeredAt;
}
```

한 device key는 하나의 active node에만 연결한다. 한 node에는 보상 청구용 `operatorWallet` 하나를 연결하고 wallet 변경은 Timelock이 아니라 운영자 서명과 compliance 승인을 모두 요구한다. N4는 사용자 승인 수준이므로 NODE trust level은 N0–N3만 허용한다.

- [x] **Step 2: Receipt root lifecycle 구현**

root 상태는 `Proposed → Challenged | Finalized | Cancelled`다. Base profile의 challenge window는 7일, Base Sepolia는 24시간, local은 60초다. `ROOT_PROPOSER_ROLE`만 제안하고 private compliance·auditor의 `CHALLENGER_ROLE`만 challenge할 수 있다. window가 끝난 미분쟁 root의 finalize는 permissionless이고, challenged root의 cancel 또는 replacement는 Timelock만 실행한다. challenged root는 claim 대상이 아니다.

- [x] **Step 3: Reward claim 구현**

`claim(epoch, operatorIdHash, nodeId, score, amount, receiptBatchRoot, policyVersion, claimNonce, proof)`가 finalized root를 확인하고 `NodeRegistry.operatorWallet(nodeId) == msg.sender`, 저장된 operatorIdHash 일치와 operator wallet의 token allowlist 상태를 강제한다. StandardMerkleTree leaf hash 전체를 claim nullifier로 사용해 서로 다른 운영자의 같은 nonce가 충돌하지 않게 하고 동일 leaf의 중복 청구를 막는다. Distributor는 토큰을 선입금 받지 않고 유효 claim마다 `NodeEmissionVault.releaseReward(epoch, msg.sender, amount)`를 호출한다. Vault는 `claimed[epoch] + amount <= monthlyBudget(epoch)`를 강제하므로 미사용 물량은 계속 Vault에 남는다.

- [x] **Step 4: module regression source 생성**

device key 중복, suspended NODE, unauthorized challenge, premature finalize, challenged root, proof 변조, 같은 nonce를 가진 서로 다른 operator의 정상 claim, duplicate leaf claim과 epoch budget overflow를 작성하되 실행하지 않는다.

- [x] **Step 5: 커밋과 소스 검토**

```bash
git add onchain/contracts/node onchain/contracts/settlement onchain/test/NodeSettlement.test.ts
git commit -m "feat: settle verified IROA node rewards"
```

Merkle leaf collision, root replacement, cross-epoch replay, reentrancy, budget bypass와 role separation을 검토한다. confirmed finding에만 focused REVIEW_FIX를 적용한다.

---

### Task 5: V1 소각 기반 V2 Migration

**Phase:** MODULE_GENERATION → REVIEW_FIX

**Files:**
- Create: `onchain/contracts/token/IROATokenV2.sol`
- Create: `onchain/contracts/token/IROAMigrationV1ToV2.sol`
- Create: `onchain/contracts/vaults/V2ScheduleImporter.sol`
- Create: `onchain/test/Migration.invariant.test.ts`

**Interfaces:**
- Produces: `bindMigrationContract(address)`, `lockMigrationAuthority()`, `registerVaultPair(address,address)`, `lockVaultPairs()`, `migrate(uint256)`, `migrateVault(VaultMigrationBatch)`, `importSchedule(ScheduleSnapshot)`, `migrationBurned()`, `migrationMinted()`
- Consumes: V1, V2, V1/V2 vault mappings

- [x] **Step 1: V2 구현**

V2 constructor는 공급을 발행하지 않으며 cap은 100억이다. V1과 같은 allowlist·pause 정책을 유지하고 일반 burn은 제공하지 않는다. 배포 순환 참조를 피하기 위해 Timelock은 공급량이 0인 상태에서 `bindMigrationContract(address)`를 정확히 한 번 호출하고 같은 batch에서 `lockMigrationAuthority()`를 실행한다. lock 이후 주소 변경과 추가 minter 등록은 영구적으로 불가능하며 `mintForMigration`은 binding된 Migration contract만, allowlist된 수령자 또는 등록 V2 vault에 대해서만 호출할 수 있다.

- [x] **Step 2: 원자적 migration 구현**

```solidity
function migrate(uint256 amount) external nonReentrant {
  v1.safeTransferFrom(msg.sender, address(this), amount);
  v1.burnForMigration(amount);
  v2.mintForMigration(msg.sender, amount);
  emit Migrated(msg.sender, amount);
}
```

zero amount, fee-on-transfer token과 다른 token address를 거부한다. `migrationBurned == migrationMinted`를 transaction마다 assert한다.

- [x] **Step 3: vesting snapshot import 구현**

Timelock은 정확히 7개의 V1/V2 vault pair를 공개 manifest와 대조해 등록한 뒤 `lockVaultPairs()`로 영구 고정한다. `VaultMigrationBatch`는 pair, amount, scheduleSnapshotHash와 sourceBatchId를 포함하며 등록 V1 vault만 자기 pair로 호출할 수 있다. Migration은 같은 transaction에서 V1 pull·전용 소각·V2 vault 발행·schedule import를 실행하고 어느 단계든 실패하면 전체를 되돌린다.

vesting `ScheduleSnapshot`은 beneficiary, total, released, start, cliff, linearDuration, sourceScheduleId를 포함한다. NODE·ecosystem·R&D·liquidity snapshot은 start, 누적 release table, released/claimed와 remaining을 포함한다. 같은 sourceScheduleId 또는 sourceBatchId는 한 번만 import 가능하고, batch별 V2 발행량은 실제 V1 소각량 및 import된 잔여 schedule 합계와 정확히 같아야 한다. gas 한도를 위해 여러 batch로 나눌 수 있지만 각 batch 자체는 원자적이다.

- [x] **Step 4: invariant source 생성**

임의 순서의 user/vault migration, partial migration, 7개 pair lock, 잘못된 pair, schedule import revert, duplicate schedule과 마지막 1 wei까지 `V1.totalSupply + V2.totalSupply == GENESIS_SUPPLY`를 검증하는 stateful test source를 작성하되 실행하지 않는다.

- [x] **Step 5: 커밋과 소스 검토**

```bash
git add onchain/contracts/token onchain/contracts/vaults/V2ScheduleImporter.sol onchain/test/Migration.invariant.test.ts
git commit -m "feat: add atomic IROA V1 to V2 migration"
```

burn/mint 원자성, allowance, pause/migration mode, schedule double import와 role revocation을 검토한다. confirmed finding에만 focused REVIEW_FIX를 적용한다.

---

### Task 6: 배포·역할 이관·공급 대사 도구

**Phase:** MODULE_GENERATION → REVIEW_FIX

**Files:**
- Create: `onchain/scripts/deploy-v1.ts`
- Create: `onchain/scripts/allocate-genesis.ts`
- Create: `onchain/scripts/handoff-roles.ts`
- Create: `onchain/scripts/verify-deployment.ts`
- Create: `onchain/scripts/reconcile-supply.ts`
- Create: `onchain/scripts/deploy-v2-migration.ts`
- Create: `onchain/scripts/import-v2-schedules.ts`
- Create: `onchain/deployments/schema.json`
- Create: `onchain/test/DeploymentScripts.test.ts`

**Interfaces:**
- Produces: signed deployment manifest, exact Safe batch JSON, role report, supply reconciliation report
- Consumes: chain ID, Safe address, signer address, verified bytecode hashes

- [x] **Step 1: chain-locked deployment 구현**

`deploy-v1.ts`는 `DEPLOYMENT_PROFILE=local|base-sepolia|base-mainnet`과 실제 chain ID가 일치하지 않으면 transaction 전에 종료한다. private key, RPC URL과 API key를 출력하지 않는다.

- [x] **Step 2: genesis allocation과 role handoff 구현**

7개 정확한 transfer를 Safe Transaction Builder JSON으로 출력한다: NODE `2_500_000_000 ether`, ecosystem `2_300_000_000 ether`, R&D `1_500_000_000 ether`, team `1_500_000_000 ether`, investor `1_000_000_000 ether`, foundation `700_000_000 ether`, liquidity `500_000_000 ether`. 먼저 Genesis Safe와 7개 vault allowlist 등록 및 read-back batch를 만들고, 다음 batch에서 정확한 allocation을 실행한다. 역할 이관은 grant → receipt confirmation → read-back → deployer renounce 순서이며, read-back이 다르면 renounce하지 않는다.

- [x] **Step 3: 공급 대사 구현**

report에는 V1/V2 totalSupply, 7개 vault 잔액, participant 잔액, migration burned/minted, locked/claimable과 합계 오차를 기록한다. 오차가 1 wei라도 있으면 exit code 1이다.

- [x] **Step 4: V2와 Migration 배포 순서 고정**

`deploy-v2-migration.ts`는 V2와 7개 V2 vault를 초기 공급 0으로 배포하고, V1/V2 주소를 constructor에 고정한 Migration을 배포한다. 첫 Timelock batch는 `bindMigrationContract(Migration)` → `lockMigrationAuthority()`를 원자적으로 실행한다. 두 번째 batch는 정확히 7개 vault pair 등록 → manifest read-back → `lockVaultPairs()`를 실행한다. 각 batch 전후 V2 공급이 0인지 확인한다. V1 `enterMigrationMode(Migration)`는 audit must-fix 반영·migration rehearsal·V2 운영 승인 이후 별도 irreversible Safe batch로만 제안한다.

- [x] **Step 5: regression source 생성**

wrong chain, zero Safe, duplicated vault address, allocation mismatch, incomplete role handoff, V2 binding 변경, lock 누락, non-zero pre-migration supply와 secret redaction을 작성하되 실행하지 않는다.

- [x] **Step 6: 커밋과 소스 검토**

```bash
git add onchain/scripts onchain/deployments onchain/test/DeploymentScripts.test.ts
git commit -m "ops: add deterministic IROA deployment controls"
```

chain confusion, secret exposure, nonce race, partial Safe batch와 premature renounce를 검토한다. confirmed finding에만 focused REVIEW_FIX를 적용한다.

---

### Task 7: Control API와 Task Lease

**Phase:** MODULE_GENERATION → REVIEW_FIX

**Files:**
- Create: `control-api/package.json`
- Create: `control-api/src/index.ts`
- Create: `control-api/src/auth.ts`
- Create: `control-api/src/tasks.ts`
- Create: `control-api/src/nodes.ts`
- Create: `control-api/src/leases.ts`
- Create: `control-api/src/audit.ts`
- Create: `control-api/src/storage.ts`
- Create: `control-api/migrations/0001_core.sql`
- Create: `control-api/test/task-lifecycle.test.ts`

**Interfaces:**
- Produces: `POST /v1/tasks`, `/approve`, `/cancel`, `/claim`, `/result`, `/deletion`; `POST /v1/nodes/enroll`, `/heartbeat`
- Consumes: protocol schemas, node device signature, synthetic encrypted object reference

- [ ] **Step 1: DB schema 구현**

`tasks`, `task_events`, `node_devices`, `task_leases`, `receipts`, `audit_log`를 만든다. `task_events`와 `audit_log`는 update/delete API를 갖지 않는다. lease는 `(task_id, nonce)` unique다.

- [ ] **Step 2: 인증과 상태 API 구현**

일반 사용자는 sandbox session cookie, 운영자는 SIWE, NODE는 challenge에 대한 device signature를 사용한다. `canTransition()`을 통하지 않는 상태 변경을 금지한다.

- [ ] **Step 3: lease와 재배정 구현**

active NODE만 claim할 수 있고 DB transaction에서 queued → assigned와 lease 생성이 함께 성공해야 한다. 만료 lease는 nonce를 폐기하고 queued로 돌린다.

- [ ] **Step 4: Receipt 수신 구현**

Result와 Deletion Receipt는 별도 endpoint로 받고 taskId, lease nonce, nodeId와 policyVersion 일치를 확인한다. ciphertext 원문을 audit log에 기록하지 않는다.

- [ ] **Step 5: regression source 생성과 커밋**

승인 우회, double lease, stale nonce, cancelled 재실행, Receipt node mismatch와 immutable audit event를 작성하되 실행하지 않는다.

```bash
git add control-api
git commit -m "feat: orchestrate private IROA tasks"
```

- [ ] **Step 6: 소스 검토**

인증 우회, race, idempotency, log injection, ciphertext 노출과 session fixation을 검토한다. confirmed finding에만 focused REVIEW_FIX를 적용한다.

---

### Task 8: NODE Agent와 합성 Executor

**Phase:** MODULE_GENERATION → REVIEW_FIX

**Files:**
- Create: `node-agent/package.json`
- Create: `node-agent/src/enrollment.ts`
- Create: `node-agent/src/heartbeat.ts`
- Create: `node-agent/src/runner.ts`
- Create: `node-agent/src/policy.ts`
- Create: `node-agent/src/receipts.ts`
- Create: `node-agent/src/executors/public-information.ts`
- Create: `node-agent/src/executors/mock-availability.ts`
- Create: `node-agent/src/executors/easy-language.ts`
- Create: `node-agent/src/deletion.ts`
- Create: `node-agent/Dockerfile`
- Create: `node-agent/test/node-agent.test.ts`

**Interfaces:**
- Produces: signed heartbeat, Result Receipt, Deletion Receipt
- Consumes: Task Capsule, device key, allowlisted synthetic executor IDs

- [ ] **Step 1: enrollment과 heartbeat 구현**

device private key는 파일에 평문 저장하지 않고 OS keychain adapter 또는 injected secret provider를 사용한다. heartbeat는 device key hash, agent version, policy version과 coarse capacity만 전송한다.

- [ ] **Step 2: executor allowlist 구현**

`public-information`, `mock-availability`, `easy-language` 세 ID만 허용한다. 외부 network는 executor별 hostname allowlist, timeout 30초, response 2MB로 제한한다.

- [ ] **Step 3: Result와 삭제 구현**

작업별 임시 directory를 만들고 종료 시 contents hash를 기록한 뒤 삭제한다. 삭제 성공 후에만 Deletion Receipt를 서명한다. 삭제 실패 시 Result는 제출해도 reward eligibility는 false다.

- [ ] **Step 4: regression source 생성과 커밋**

unknown executor, timeout, output limit, stale Capsule, cancellation, deletion failure와 device key rotation을 작성하되 실행하지 않는다.

```bash
git add node-agent
git commit -m "feat: execute synthetic IROA node tasks"
```

- [ ] **Step 5: 소스 검토**

command injection, SSRF, path traversal, secret persistence, cancellation race와 forged Receipt를 검토한다. confirmed finding에만 focused REVIEW_FIX를 적용한다.

---

### Task 9: Verifier·분쟁·월별 Reward Root

**Phase:** MODULE_GENERATION → REVIEW_FIX

**Files:**
- Create: `verifier/package.json`
- Create: `verifier/src/verify-receipt.ts`
- Create: `verifier/src/score.ts`
- Create: `verifier/src/fraud.ts`
- Create: `verifier/src/disputes.ts`
- Create: `verifier/src/epoch-budget.ts`
- Create: `verifier/src/build-root.ts`
- Create: `verifier/src/publish-root.ts`
- Create: `verifier/test/reward-settlement.test.ts`

**Interfaces:**
- Produces: `verifyReceiptPair()`, `scoreTask()`, `settleEpoch()`, `RewardSettlement`
- Consumes: Result/Deletion Receipt, NODE status snapshot, policy version, monthly vault budget

- [ ] **Step 1: Receipt pair 검증 구현**

두 Receipt의 taskId, nodeId, nonce, policyVersion을 대조하고 EIP-712 signer가 등록 device key와 일치하는지 확인한다. NODE가 completedAt 시점에 active였는지 snapshot으로 확인한다.

- [ ] **Step 2: score와 fraud rule 구현**

Spec 7.2의 40/25/15/10/10 가중치와 completion/security gate를 exact integer basis points로 계산한다. uptime bonus는 valid task score의 10% 이하로 cap한다. 같은 operator가 소유한 NODE를 합산한다.

- [ ] **Step 3: epoch settlement 구현**

operator당 월 예산 5% cap을 적용하고 초과분은 redistributing하지 않는다. disputed, duplicate, self-dealing flagged record는 leaf에서 제외하고 이유를 별도 report에 기록한다.

- [ ] **Step 4: root publish 구현**

root, total reward, leaf count, excluded amount, policyVersion과 artifact SHA-256을 저장한다. onchain propose transaction은 explicit operator action으로 분리하고 자동 cron이 직접 서명하지 않는다.

- [ ] **Step 5: regression source 생성과 커밋**

receipt mismatch, inactive node, zero-work uptime, score overflow, 5% cap, unused balance, dispute exclusion과 deterministic root를 작성하되 실행하지 않는다.

```bash
git add verifier
git commit -m "feat: verify and settle IROA rewards"
```

- [ ] **Step 6: 소스 검토**

integer rounding, operator sybil, non-determinism, self-dealing bypass, policy drift와 unauthorized root submission을 검토한다. confirmed finding에만 focused REVIEW_FIX를 적용한다.

---

### Task 10: Sandbox 사용자 경험

**Phase:** MODULE_GENERATION → REVIEW_FIX

**Files:**
- Create: `sandbox/package.json`
- Create: `sandbox/src/App.tsx`
- Create: `sandbox/src/pages/NewTask.tsx`
- Create: `sandbox/src/pages/TaskStatus.tsx`
- Create: `sandbox/src/pages/ResultConfirmation.tsx`
- Create: `sandbox/src/pages/Dispute.tsx`
- Create: `sandbox/src/lib/api.ts`
- Create: `sandbox/src/lib/i18n.ts`
- Create: `sandbox/src/locales/ko.json`
- Create: `sandbox/src/locales/en.json`
- Create: `sandbox/e2e/task-flow.spec.ts`

**Interfaces:**
- Produces: 지갑 없는 request → approval → status → confirmation/dispute UI
- Consumes: Control API public session endpoints

- [ ] **Step 1: 독립 Vite app과 테스트넷 경고 구현**

Base Sepolia와 Base Mainnet profile을 build time에 분리한다. private mainnet profile에서도 일반 사용자는 wallet component를 load하지 않는다. 상단에 `비공개 검증 환경`과 `공개 거래 불가`를 표시한다.

- [ ] **Step 2: 쉬운 요청과 승인 구현**

세 synthetic executor를 쉬운 표현으로 제공하고 비용 0, 공유 정보, 취소 방법과 사람 검토 경로를 승인 전에 표시한다.

- [ ] **Step 3: 상태·결과·분쟁 구현**

상태를 색상과 함께 text/icon으로 표시한다. Result Receipt와 Deletion Receipt는 `검증됨/누락/검토 중`으로 번역해 보여주고 raw hash는 상세 영역에 둔다.

- [ ] **Step 4: browser source 생성과 커밋**

키보드 request flow, 승인 전 제출 차단, 취소, result confirmation과 dispute를 Playwright source로 작성하되 실행하지 않는다.

```bash
git add sandbox
git commit -m "feat: add accessible IROA task sandbox"
```

- [ ] **Step 5: 소스 검토**

wallet 강제, 승인 copy 누락, stale state, 접근성 이름, focus order와 민감 hash 노출을 검토한다. confirmed finding에만 focused REVIEW_FIX를 적용한다.

---

### Task 11: Operator Portal

**Phase:** MODULE_GENERATION → REVIEW_FIX

**Files:**
- Create: `operator/package.json`
- Create: `operator/src/App.tsx`
- Create: `operator/src/pages/Enrollment.tsx`
- Create: `operator/src/pages/Nodes.tsx`
- Create: `operator/src/pages/Tasks.tsx`
- Create: `operator/src/pages/Rewards.tsx`
- Create: `operator/src/pages/Migrate.tsx`
- Create: `operator/src/lib/wagmi.ts`
- Create: `operator/src/lib/contracts.ts`
- Create: `operator/e2e/operator-flow.spec.ts`

**Interfaces:**
- Produces: operator SIWE, NODE lifecycle, score explanation, reward claim, V1→V2 migration UI
- Consumes: Control API operator endpoints, chain manifest, Registry, Distributor, Migration ABI

- [ ] **Step 1: chain-isolated wallet 구현**

Base Sepolia build에는 chain 84532와 Sepolia addresses만, private mainnet build에는 chain 8453과 Base addresses만 포함한다. wrong chain에서는 write action 전체를 비활성화한다.

- [ ] **Step 2: NODE와 Task 화면 구현**

기기 키 hash와 상태를 표시하고 raw endpoint·secret을 표시하지 않는다. suspend/revoke에는 영향과 복구 불가능 범위를 확인하는 두 번째 확인을 둔다.

- [ ] **Step 3: Reward와 Migration 구현**

score 구성, excluded reason, proof, claim amount를 표시한다. migration은 approve와 migrate를 분리해 transaction hash, burned V1, minted V2와 합산 공급을 확인한다.

- [ ] **Step 4: browser source 생성과 커밋**

wrong chain, enrollment, claim, duplicate claim UI, partial migration과 migrated balance를 작성하되 실행하지 않는다.

```bash
git add operator
git commit -m "feat: add private IROA operator portal"
```

- [ ] **Step 5: 소스 검토**

chain/address confusion, unsigned state trust, allowance, claim proof, rounding display와 destructive device revoke를 검토한다. confirmed finding에만 focused REVIEW_FIX를 적용한다.

---

### Task 12: Admin Console

**Phase:** MODULE_GENERATION → REVIEW_FIX

**Files:**
- Create: `admin/package.json`
- Create: `admin/src/App.tsx`
- Create: `admin/src/lib/personas.ts`
- Create: `admin/src/pages/Nodes.tsx`
- Create: `admin/src/pages/Disputes.tsx`
- Create: `admin/src/pages/Settlement.tsx`
- Create: `admin/src/pages/Governance.tsx`
- Create: `admin/src/pages/Audit.tsx`
- Create: `admin/functions/api/me.ts`
- Create: `admin/e2e/admin-flow.spec.ts`

**Interfaces:**
- Produces: `super_admin`, `treasury`, `compliance`, `read_only` UI policy; NODE approval; dispute resolution; root proposal artifact; Safe/Timelock queue
- Consumes: verifier settlement artifact, Control API audit, onchain role reads

- [ ] **Step 1: persona와 실제 보안 경계 구현**

CCM의 4개 persona를 사용하되 UI persona는 편의 기능으로만 취급한다. write 전에는 Cloudflare Access identity, SIWE wallet과 onchain role을 모두 확인한다.

- [ ] **Step 2: NODE·분쟁·정산 화면 구현**

NODE approve/suspend, dispute evidence, included/excluded reward, root artifact hash를 표시한다. root proposal은 transaction을 직접 보내지 않고 Safe proposal payload를 생성한다.

- [ ] **Step 3: 감사 화면 구현**

actor, action, target, policyVersion, timestamp, transaction hash와 result를 CSV로 내보낸다. Receipt 원문과 encrypted Capsule reference는 export에서 제외한다.

- [ ] **Step 4: browser source 생성과 커밋**

persona route guard, read-only write 차단, dispute hold, settlement proposal과 audit export를 작성하되 실행하지 않는다.

```bash
git add admin
git commit -m "feat: govern private IROA validation"
```

- [ ] **Step 5: 소스 검토**

UI-only authorization, direct URL bypass, CSV injection, PII export, unsafe Safe calldata와 root mismatch를 검토한다. confirmed finding에만 focused REVIEW_FIX를 적용한다.

---

### Task 13: 경제 시뮬레이션·배포 Runbook·감사 Package

**Phase:** MODULE_GENERATION → REVIEW_FIX

**Files:**
- Modify: `docs/whitepaper/analysis/IROA_TOKEN_ECONOMY_SIMULATION.ipynb`
- Modify: `docs/whitepaper/analysis/IROA_TOKEN_ECONOMY_VALIDATION.md`
- Modify: `package-lock.json`
- Create: `tools/tokenomics/export-pilot-metrics.mjs`
- Create: `docs/architecture/runbooks/v1-sepolia-rehearsal.md`
- Create: `docs/architecture/runbooks/v1-mainnet-deploy.md`
- Create: `docs/architecture/runbooks/private-participant-validation.md`
- Create: `docs/architecture/runbooks/v2-migration.md`
- Create: `docs/architecture/audit-package-manifest.md`

**Interfaces:**
- Produces: reproducible tokenomics CSV/JSON, signer checklist, exact deploy/verify/read-back sequence, private validation evidence ledger, audit file list
- Consumes: deployment scripts, app URLs, contract addresses, reward settlement reports

- [ ] **Step 1: pilot metric export 구현**

활성 NODE, valid task, median/operator reward, top-1/top-5 concentration, monthly budget usage, unused amount, dispute rate, deletion failure, processing cost를 JSON과 CSV로 내보낸다. price, return과 listing projection을 출력하지 않는다.

- [ ] **Step 2: Sepolia와 Mainnet runbook 작성**

각 단계에 signer, required env variable name, expected chain ID, expected contract hash, read-back, stop condition과 rollback 가능 여부를 적는다. V1 private distribution 전 stop condition에는 서면 법률 검토 문서 ID와 허용된 참여자 관할을 포함한다. secret 값은 문서에 넣지 않는다.

- [ ] **Step 3: private validation ledger 작성**

NODE operator, ecosystem participant, vesting beneficiary, treasury, compliance와 read-only 역할별로 wallet ownership, agreement, allowlist transaction, completed flows와 issue links를 기록하는 표를 만든다. 실제 이름·주소는 암호화된 운영 ledger에 두고 repo에는 가명 ID만 둔다.

- [ ] **Step 4: audit package manifest 작성**

commit, compiler settings, source, dependency lock, deployment addresses, verified source URLs, role report, supply reconciliation, test output, static analysis, incident ledger와 migration invariant report를 exact path로 나열한다.

- [ ] **Step 5: workspace dependency lock 확정**

모든 workspace manifest가 작성된 뒤 다음 generation command로 lockfile만 갱신한다. package lifecycle script는 실행하지 않는다.

```bash
npm install --package-lock-only --ignore-scripts
```

변경된 lockfile의 direct dependency version과 workspace link를 각 package manifest와 대조한다. 이 명령은 test·typecheck·build가 아니며 dependency artifact 생성에만 사용한다.

- [ ] **Step 6: 커밋과 소스 검토**

```bash
git add package-lock.json docs/whitepaper/analysis tools/tokenomics docs/architecture
git commit -m "docs: prepare IROA private mainnet validation"
```

수치 drift, secret/PII 노출, signer 모호성, stop condition 누락과 V1/V2 대사 공백을 검토한다. confirmed finding에만 focused REVIEW_FIX를 적용한다.

---

### Task 14: FINAL_INTEGRATION — 단일 전체 검증

**Phase:** FINAL_INTEGRATION

**Entry condition:** Tasks 1–13의 모듈 생성, 소스 검토와 모든 accepted REVIEW_FIX item이 완료돼야 한다. 이 task는 계획의 마지막 task이며 자동 실행한다.

**Files:**
- Read: 전체 changed source, tests, manifests와 runbooks
- Create: `docs/architecture/evidence/v1-final-integration.md`

- [ ] **Step 1: dependency와 generated artifact 고정**

Run:

```bash
npm ci --ignore-scripts
```

Expected: lockfile과 exact dependency가 설치되고 workspace resolution 오류가 없다.

- [ ] **Step 2: 전체 regression과 contract invariant를 한 번 실행**

Run:

```bash
CODEX_VALIDATION_PHASE=FINAL_INTEGRATION npm run test:all
```

Expected: 기존 Astro unit, protocol, crypto, onchain, API, node-agent와 verifier suite가 모두 통과하고 migration invariant가 `V1 + V2 = 10B`를 유지한다.

- [ ] **Step 3: 전체 typecheck를 한 번 실행**

Run:

```bash
CODEX_VALIDATION_PHASE=FINAL_INTEGRATION npm run typecheck:all
```

Expected: 모든 workspace와 기존 Astro site가 error 없이 통과한다.

- [ ] **Step 4: production build를 한 번 실행**

Run:

```bash
CODEX_VALIDATION_PHASE=FINAL_INTEGRATION npm run build:all
```

Expected: 기존 한국어·영어 사이트와 sandbox/operator/admin의 Sepolia·private-mainnet profile이 생성된다. 각 profile에 반대 chain 주소가 포함되지 않는다.

- [ ] **Step 5: contract 정적 분석과 deterministic deploy 검증**

Run:

```bash
CODEX_VALIDATION_PHASE=FINAL_INTEGRATION npm --workspace onchain run analyze
CODEX_VALIDATION_PHASE=FINAL_INTEGRATION npm --workspace onchain run deploy:local:verify
```

Expected: high/critical finding이 없고, 두 번의 local deploy에서 contract bytecode hash와 allocation manifest가 일치한다.

- [ ] **Step 6: 전체 browser flow를 한 번 실행**

Run:

```bash
CODEX_VALIDATION_PHASE=FINAL_INTEGRATION npm run test:e2e:all
```

Expected: 기존 홈페이지·22개 whitepaper chapter, 지갑 없는 사용자 request, NODE operator claim/migration, admin dispute/root proposal과 keyboard-only flow가 통과한다. browser 명령은 Task 14 Step 4의 build artifact를 사용하고 build를 다시 실행하지 않는다.

- [ ] **Step 7: 기존 브랜드·문서 자산 회귀를 한 번 실행**

Run:

```bash
python3 -m unittest tests.brand.test_brand_assets tests.brand.test_comparison_optical_parity
```

Expected: 기존 IROA 공식 브랜드 asset, 문서 render, optical parity와 portable asset 계약이 모두 통과한다.

- [ ] **Step 8: 최종 source·runbook review**

공급·권한·migration·chain isolation·개인정보·보상·분쟁·실패 복구와 runbook의 actual script name을 전체 diff에서 한 번 검토하고 `git diff --check`를 실행한다. 새로운 결함이 확인되면 FINAL_INTEGRATION을 반복하지 않고 해당 evidence layer가 무효화됐다고 보고해 사용자에게 broad rerun 승인을 요청한다.

- [ ] **Step 9: evidence 문서와 커밋**

`v1-final-integration.md`에 commit hash, 명령, 종료 상태, test count, build artifact, contract hash, known limitation과 아직 실행하지 않은 Base transaction을 기록한다.

```bash
git add docs/architecture/evidence/v1-final-integration.md
git commit -m "docs: record IROA V1 final integration evidence"
```

---

## Post-Plan Operational Sequence

Task 14 통과 후에도 자동으로 network transaction을 보내지 않는다. 사용자가 승인한 목표는 다음 운영 순서로 계속한다.

1. `v1-sepolia-rehearsal.md`에 따라 Base Sepolia 배포·역할 이관·private flow를 실행하고 주소와 transaction을 기록한다.
2. Sepolia evidence와 Base Mainnet deployment artifact를 사람이 대조한다.
3. `v1-mainnet-deploy.md`의 별도 signer ceremony에서 V1을 Base Mainnet에 배포하고 BaseScan source verification, 7개 allocation, Safe·Timelock handoff와 공급 대사를 완료한다.
4. `private-participant-validation.md`의 역할별 전체 flow를 비공개 참여자와 수행한다.
5. 실제 V1 주소와 운영 evidence를 독립 스마트계약 감사기관에 제출한다.
6. 감사 결과를 받으면 must-fix와 migration-fix를 입력으로 V2 delta implementation plan을 새로 작성한다.
7. V2 수정, 별도 FINAL_INTEGRATION과 migration rehearsal 후 V2를 배포하고 V1 burn → V2 mint 1:1 migration을 시작한다.

공개 판매·DEX·브리지·상장은 이 계획과 post-plan sequence에 포함되지 않는다.
