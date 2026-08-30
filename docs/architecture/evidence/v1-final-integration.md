# IROA V1 final integration evidence

Status: **local FINAL_INTEGRATION passed; external release gates remain**

Candidate source commit: `3e1438995138d7b08f7043ad0c1d0319ad80a180`

Validated repository commit: `2e463d0d9efa13cb27d8d5fe2b33bbb120a6d34b`

Recorded: 2026-08-30 KST

Network transaction status: **no Base Sepolia or Base Mainnet transaction was sent**

## Decision

After the user explicitly authorized a broad rerun, the repaired candidate passed the full regression, full typecheck, full production build and combined browser suite. It also has deterministic local deployment evidence, no high-severity Slither result and passing brand regression. The local final-integration gate is complete for the validated commit; any source, dependency or build-configuration change invalidates the affected evidence layer.

This record is not an independent smart-contract audit, a mainnet deployment approval, legal approval, or participant-distribution approval.

## Evidence by layer

| Layer | Command / scope | Result | Release interpretation |
|---|---|---|---|
| Exact dependencies | `npm ci --ignore-scripts` | PASS | 751 packages installed from lockfile. npm reported 19 known dependency advisories: 12 low, 5 moderate, 2 high. No automatic dependency mutation was performed. |
| Broad regression | authorized `npm run test:all` rerun | PASS | 183/183: root 70, contracts 3, crypto 7, protocol 7, onchain 49, control API 16, NODE Agent 11, verifier 14 and admin 6. |
| Focused regression repairs | exact six failing onchain cases; exact three NODE Agent cases | PASS | Onchain 6/6 and NODE Agent 3/3 passed after source and fixture repair. This is focused evidence, not a replacement for the broad suite. |
| Broad typecheck | authorized `npm run typecheck:all` rerun | PASS | Astro checked 65 files with 0 errors, 0 warnings and 0 hints; every workspace typecheck passed. |
| Focused typechecks | `control-api`, `node-agent`, `verifier`, `sandbox`, `operator`, `admin` workspace typechecks | PASS | All six repaired workspaces passed their scoped typecheck. This is not a broad rerun. |
| Broad production build | authorized `npm run build:all` rerun | PASS | The 50-page Korean/English Astro artifact and every workspace built. Operator and Admin retained non-failing chunk-size warnings above 500 kB. |
| Focused server builds | individual `control-api`, `node-agent`, `verifier` builds | PASS | All three repaired server packages built. This is not a broad rerun. |
| Static analysis | `npm --workspace onchain run analyze` | PASS | Exact cached `solc 0.8.24`, Cancun EVM, 59 contracts and 101 detectors. No high-severity result. Thirty-six medium/low/informational results remain audit inputs. The only initial high classification was `monthIndex % 12`; it is a deterministic calendar index, not randomness, and is suppressed on that exact line with rationale. |
| Deterministic deploy | `npm --workspace onchain run deploy:local:verify` | PASS | Two independent Hardhat 3 local chains produced identical contract addresses, seven allocations and runtime-bytecode hashes; both read-back reports passed. |
| Combined browser command | authorized `npm run test:e2e:all` rerun | PASS | 71/71: homepage/whitepaper 47, Sandbox desktop/mobile 12, Operator 7 and Admin 5. |
| Focused homepage repairs | exact five failed homepage/whitepaper cases, followed by the remaining single case | PASS | 5/5 known failures passed after test-contract correction. |
| Sandbox browser flow | first app run plus exact failed desktop/mobile case | PASS with focused repair | Initial 10/12; the two variants failed on an ambiguous text locator. Exact two-case rerun passed 2/2. |
| Operator browser flow | complete Operator app suite | PASS | 7/7. Includes chain lock, enrollment retry boundary, chain-derived claim state, portal failure truthfulness, NODE status and partial 1:1 migration. |
| Admin browser flow | complete Admin app suite | PASS | 5/5. Includes persona guard, read-only NODE control, dispute exclusion, no-send Safe proposal generation and safe audit CSV export. |
| Brand/document regression | `python3 -m unittest tests.brand.test_brand_assets tests.brand.test_comparison_optical_parity` | PASS | 69/69 in 215.837 seconds. |
| Final source/runbook review | source review plus `git diff --check` | PASS | Supply, authority, migration, chain isolation, pseudonymous evidence, reward/dispute, deletion failure and actual script names were reviewed. No new confirmed source defect was found. |
| GitHub Actions / CI | not executed | NOT EXECUTED | A push, PR or merge was not performed because CI execution requires separate explicit user authorization. |

## Focused repairs made during final integration

- Bound V1/V2 migration contracts now report the irreversible already-configured state before inspecting a replacement candidate.
- V1 migration tests use the real V2 and Migration contracts rather than an EOA fixture.
- The Base governance-delay test connects to a chain-ID `8453` local profile.
- Duplicate vault schedules assert the global source-schedule replay guard.
- NODE deletion accepts the operating system's canonical parent path while still rejecting a directly supplied root symlink and every nested symlink/path escape.
- Timeout rejection handlers attach before fake time advances, preventing an unhandled-rejection race.
- Workspace typechecks use source paths without corrupting composite production-build references; server builds explicitly include Node runtime types.
- Hardhat 3 local deploy verification uses two fresh network instances instead of an unavailable reset helper.
- Slither uses Hardhat's exact cached native `solc 0.8.24` and the configured Cancun EVM.
- Browser tests now observe lazy images after scrolling, unique whitepaper image URLs, the continuous-reader anchor contract, scoped PDF links and exact status badges.

## Deterministic local deployment

Profile `local`, chain ID `31337`, release `v1`, seven vaults, and total allocation `10000000000000000000000000000` base units were read back twice.

| Runtime code | Keccak-256 |
|---|---|
| IROA Token V1 | `0xc1dcc732d2d1df87941f66e6be6f580374e37e887c7d61b6419368a3048de904` |
| Timelock | `0x91337693aad6fc107f9689544a82057337a142a4176741ba3dd6dca88e0fba06` |
| NODE Registry | `0x00963ffe74c8218307117047e7968cd2dbbef99563f21363418058a3f5cc1865` |
| Receipt Root Registry | `0xe7d9e448d3eb821360c91719c743aeb9a4bc945d8c7cd90cd682dedf61224be9` |
| Reward Distributor | `0x4fcc77e6755a7300cd1a896ab0fd3e5743b87fd578689fe2d2ee94667862446c` |
| NODE vault | `0x95e660b8cccc5f180ce8f19fc232c07e42257acd57be482e3b670d8565f1bfed` |
| Ecosystem vault | `0x11952e7d0a7a6374882f2a850394d9a1f0cda7ab61257127de7330c1a32b99bf` |
| Research vault | `0xba622e54b19b92730bb9bd4e114d61ad53f13ee18cfd96d2dd922a1583d5747d` |
| Team vault | `0x2bd4b49f6895400800f4d2f574e099781be29cbe0190c4a952cc8ed01a067367` |
| Investor vault | `0x2965620ed95f6fc7c129f5fc501f36aaf0b9895da9eb3298a966781a8781f53a` |
| Foundation vault | `0xf193692fdc8ec15fe15e00fdccb1211727cf9de9bec5f6dd034d85a47a63a8da` |
| Liquidity vault | `0x0d338631474765ffddf7ad69734073500b717fef6e067cdc21c5b10ab294e5b1` |

These are local deterministic evidence values, not Base deployment addresses or explorer verification evidence.

## Known limitations and mandatory gates

1. Preserve the validated commit. Any source, dependency or build-configuration change invalidates the affected evidence and requires authorization under the validation policy.
2. Triage the 19 npm advisories without using an automatic breaking upgrade and rerun affected evidence only under the validation policy.
3. Independently review the 36 non-high Slither results, especially arithmetic rounding, default-zero locals and trusted-token call ordering. Slither passing `--fail-high` is not an audit.
4. Complete the Base Sepolia rehearsal, freeze its signed manifests and read-back reports, and collect explorer source-verification URLs.
5. Complete a truly independent smart-contract audit. Close every must-fix finding against a new immutable candidate and perform that candidate's separate final integration and migration rehearsal.
6. Record a non-placeholder written legal-review document ID and allowed participant jurisdictions in the encrypted operations ledger before any private participant distribution.
7. Mainnet deployment, role handoff, genesis allocation, participant distribution and V1 migration-mode entry remain separate human-signing ceremonies. None is authorized by this document.
