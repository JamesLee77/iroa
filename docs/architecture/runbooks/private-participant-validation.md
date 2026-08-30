# IROA private participant validation ledger

Status: repository-safe template. Duplicate this table per validation epoch. Use pseudonymous IDs only. Actual names, wallet addresses, signatures, agreements, jurisdiction evidence, and contact data belong in the encrypted operations ledger with access logging and retention controls.

## Epoch header

| Field | Value |
|---|---|
| Validation epoch ID | `PILOT-YYYY-MM-##` |
| Network / chain ID | `base-sepolia / 84532` or `base-mainnet-private / 8453` |
| Candidate commit | `<40-char commit>` |
| Deployment manifest hash | `<bytes32>` |
| Policy version | `<version>` |
| Legal review document ID | `<required before mainnet private distribution>` |
| Legal review scope hash | `<sha256>` |
| Allowed participant jurisdictions | `<ISO 3166-1 alpha-2 codes; no participant identity>` |
| Validation owner / reviewer | `<role IDs, not names>` |
| Start / close UTC | `<ISO-8601>` |

## Application endpoints

For local rehearsal use Control API `http://127.0.0.1:8787`, participant sandbox `http://127.0.0.1:4174`, NODE operator portal `http://127.0.0.1:4175`, and admin console `http://127.0.0.1:4176`. For hosted private validation, record the approved HTTPS endpoint IDs and access-policy version in the encrypted operations ledger; repository evidence stores only endpoint aliases and response/evidence hashes.

## Participant evidence

Use `PASS`, `FAIL`, `BLOCKED`, or `N/A`. A role cannot be closed when any required field is blank.

| Pseudonym | Role | Wallet ownership proof ID | Agreement ID | Jurisdiction eligibility | Allowlist tx / read-back | Completed flow evidence | Issue links | Reviewer | Status |
|---|---|---|---|---|---|---|---|---|---|
| `OP-001` | NODE operator | `<encrypted-ledger ref>` | `<agreement ref>` | `<PASS + code>` | `<tx hash + block + true>` | enroll → approve → claim → deletion receipt | `<issue IDs>` | `ROLE-COMPLIANCE-01` | `<status>` |
| `ECO-001` | ecosystem participant | `<ref>` | `<ref>` | `<PASS + code>` | `<tx + read-back>` | request → consent → result → dispute path | `<issue IDs>` | `ROLE-COMPLIANCE-01` | `<status>` |
| `BEN-001` | vesting beneficiary | `<ref>` | `<ref>` | `<PASS + code>` | `<tx + read-back>` | cliff/vesting read → eligible release | `<issue IDs>` | `ROLE-TREASURY-02` | `<status>` |
| `TRY-001` | treasury | `<Safe signer proof ref>` | `<mandate ref>` | `N/A` | `<Safe tx + quorum>` | allowlist → proposal review → allocation read-back | `<issue IDs>` | `ROLE-COMPLIANCE-02` | `<status>` |
| `CMP-001` | compliance | `<access proof ref>` | `<mandate ref>` | `N/A` | `<role tx + hasRole>` | approve/suspend → dispute challenge → audit export | `<issue IDs>` | `ROLE-AUDITOR-01` | `<status>` |
| `READ-001` | read-only auditor | `<access proof ref>` | `<NDA ref>` | `N/A` | `N/A` | direct-route denial → read views → export denied | `<issue IDs>` | `ROLE-AUDITOR-02` | `<status>` |

## Required flow ledger

| Flow ID | Pseudonymous actor | Expected result | Evidence path or transaction | Result | Issue |
|---|---|---|---|---|---|
| `FLOW-01` | `ECO-001` | wallet-free task request with explicit consent | `<artifact>` | `<PASS/FAIL>` | `<ID>` |
| `FLOW-02` | `OP-001` | signed enrollment and compliance approval | `<artifact/tx>` | `<PASS/FAIL>` | `<ID>` |
| `FLOW-03` | `OP-001` | lease, encrypted processing, result and deletion receipt | `<receipt batch hash>` | `<PASS/FAIL>` | `<ID>` |
| `FLOW-04` | `CMP-001` | valid reward root proposed; disputed item excluded | `<Safe payload hash>` | `<PASS/FAIL>` | `<ID>` |
| `FLOW-05` | `OP-001` | finalized-root claim; duplicate claim rejected | `<tx/revert evidence>` | `<PASS/FAIL>` | `<ID>` |
| `FLOW-06` | `READ-001` | every write and protected export blocked | `<browser evidence>` | `<PASS/FAIL>` | `<ID>` |
| `FLOW-07` | all roles | wrong-chain writes blocked | `<browser evidence>` | `<PASS/FAIL>` | `<ID>` |
| `FLOW-08` | treasury | supply and seven vaults reconcile to `0 wei` error | `<reconciliation report>` | `<PASS/FAIL>` | `<ID>` |

## Closure and metrics

Close the epoch only when every required flow passes, unresolved issues have an owner/severity/decision, deletion receipts are reconciled, reward root evidence matches the policy version, and supply reconciliation is exact. Export the normalized pseudonymous epoch input with:

```bash
node tools/tokenomics/export-pilot-metrics.mjs --input <normalized-private-ledger.json> --output-dir <evidence-directory>
```

Record both outputs and their `sourceDigestSha256`. These are observed operational metrics, not token price, investment return, liquidity, or listing projections.
