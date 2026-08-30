# IROA independent audit package manifest

Status: packaging contract. Create an immutable evidence copy for the audit candidate; do not edit this template with secrets, participant PII, private keys, RPC URLs, or unencrypted wallet-owner mappings.

## Candidate identity

| Evidence | Required value / exact path |
|---|---|
| Repository and candidate | repository URL, branch, full 40-character commit, clean-tree statement |
| Source archive digest | `<audit-package>/source.sha256` |
| Compiler profile | `onchain/hardhat.config.ts` — Solidity `0.8.24`, optimizer enabled with `200` runs, EVM `cancun`, IPFS metadata bytecode hash |
| Dependency lock | `package-lock.json`, root `package.json`, `onchain/package.json` |
| Deployment schema | `onchain/deployments/schema.json` |
| Architecture decision and plan | `docs/superpowers/specs/2026-08-30-iroa-web3-mainnet-private-pilot-design.md`, `docs/superpowers/plans/2026-08-30-iroa-web3-v1-mainnet-private-pilot.md` |

## Contract source and controls

Include exact files under:

- `onchain/contracts/token/`
- `onchain/contracts/vaults/`
- `onchain/contracts/governance/`
- `onchain/contracts/node/`
- `onchain/contracts/settlement/`
- `onchain/contracts/migration/`
- `onchain/scripts/`
- `onchain/test/`

The auditor must receive the signed candidate manifest at `onchain/deployments/<profile>/v1.json`, the V2 candidate at `onchain/deployments/<profile>/v2-migration.json` when applicable, every key/address/value pair in `bytecodeHashes`, and direct verified-source URLs in `<audit-package>/verified-source-urls.csv`. URLs are evidence only when their chain ID, address, compiler settings and bytecode match the signed manifest.

## Operational evidence index

| Evidence | Exact generated path |
|---|---|
| V1 verification | `onchain/deployments/<profile>/verification-v1.json` |
| V2 verification | `onchain/deployments/<profile>/verification-v2-migration.json` |
| Role handoff and deployer renunciation | `onchain/deployments/<profile>/role-handoff.json` |
| Genesis allowlist and allocation payloads | `onchain/deployments/<profile>/safe-01-allowlist.json`, `safe-02-allocation.json` |
| V2 governance payloads | `onchain/deployments/<profile>/safe-03-*`, `safe-04-*`, `safe-05-*` |
| Seven-schedule import plan | `onchain/deployments/<profile>/v2-schedule-import-plan.json` |
| Supply reconciliation | `onchain/deployments/<profile>/supply-reconciliation.json` |
| Test output | `<audit-package>/validation/test-all.txt` |
| Static analysis | `<audit-package>/validation/slither.json`, `<audit-package>/validation/slither.txt` |
| Final integration evidence | `docs/architecture/evidence/v1-final-integration.md` |
| Incident ledger | `<encrypted-operations-ledger>/incidents/<candidate-id>`; repository contains only `<audit-package>/incident-index.csv` with pseudonymous ID, severity, state and issue link |
| Private validation ledger | `docs/architecture/runbooks/private-participant-validation.md` plus encrypted epoch ledger |
| Pilot metrics | `<audit-package>/pilot/iroa-pilot-metrics.json`, `<audit-package>/pilot/iroa-pilot-metrics.csv` |

## Invariants and reviewer checklist

Record the exact reports and test cases covering:

- `onchain/test/IROATokenV1.test.ts` and `AllocationVaults.test.ts`: one-time `10B` supply, allowlist, seven allocations, release rounding and cliffs;
- `onchain/test/NodeSettlement.test.ts`: device uniqueness, role separation, finalized-root claim, duplicate prevention and monthly/operator caps;
- `onchain/test/Migration.invariant.test.ts`: every user/vault order and partial migration preserves `V1 + V2 = 10B`, with no duplicate schedule or batch;
- `onchain/test/DeploymentScripts.test.ts`: chain lock, manifest signature, role handoff, secret redaction and exact reconciliation;
- `verifier/test/reward-settlement.test.ts`: policy-bound receipt verification, fraud exclusions, top-operator cap and unused budget;
- `tools/tokenomics/export-pilot-metrics.mjs`: observed metrics only and explicit rejection of projection/direct-identifier fields.

The independent auditor reports findings against the full candidate commit. Before production use, link every must-fix finding to its patch commit, focused reproduction, fix evidence, re-review, and auditor closure. A new token release is a new audit candidate; it is not deemed safe merely because a prior version was audited.

## Package acceptance

Two reviewers independently confirm all paths exist in the immutable package, hashes match the candidate, generated reports name the correct chain/profile, secrets and participant PII are absent, and no evidence claims an unexecuted Base transaction. Missing evidence is marked `NOT EXECUTED` or `NOT AVAILABLE`, never inferred or replaced with a plan.
