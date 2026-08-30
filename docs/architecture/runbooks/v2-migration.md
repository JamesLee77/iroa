# IROA V1 to V2 migration runbook

Status: irreversible migration procedure. Migration preserves the invariant `V1.totalSupply + V2.totalSupply = 10,000,000,000 IROA`; it never creates an additional public supply.

## Approval gates

Do not generate or sign the V1 migration-mode transaction until all three code-enforced flags are `true`: `AUDIT_MUST_FIX_CLOSED`, `MIGRATION_REHEARSAL_PASSED`, and `V2_OPERATIONS_APPROVED`. Bind each approval to document ID, commit, V1/V2 manifest hashes, chain ID, and UTC expiry in the encrypted operations ledger.

Required variables are `DEPLOYMENT_PROFILE`, the matching RPC URL and deployer key variable, `V1_MANIFEST`, `V2_MANIFEST`, `V2_PHASE`, `PAUSER_SAFE`, `AUDIT_MUST_FIX_CLOSED`, `MIGRATION_REHEARSAL_PASSED`, `V2_OPERATIONS_APPROVED`, and `RECONCILIATION_REPORT`. Base Sepolia is `84532`; Base Mainnet is `8453`.

## Signers

| Action | Signer / authority |
|---|---|
| Deploy V2, Migration and importers | dedicated deployer bound to candidate manifest |
| Bind migration authority and lock it | Timelock execution proposed by Genesis Safe quorum |
| Register exactly seven vault pairs and lock them | Timelock execution proposed by Genesis Safe quorum |
| Enter V1 migration-only mode | Timelock after all three approval gates; irreversible |
| Migrate participant balance | that allowlisted participant |
| Migrate a vault schedule | Timelock for monthly vaults; recorded beneficiary for cliff/liquidity vaults |
| Pause | Pauser Safe under incident procedure |

## Procedure and read-backs

1. Reconcile V1 alone and freeze its manifest. Confirm V1 supply is exactly `10B`, seven vault mappings are unique, and all backing errors are zero.
2. Set `V2_PHASE=deploy` and run `npm --workspace onchain exec -- hardhat run scripts/deploy-v2-migration.ts --network <baseSepolia|base>`. Require V2 `totalSupply=0`, expected V1 token and Timelock addresses, reviewed runtime bytecode hashes, seven V2 importers and a valid signed V2 manifest.
3. Review the generated `safe-03-v2-bind-lock-{schedule,execute}.json`. After Timelock execution, read back the exact Migration address and `migrationAuthorityLocked=true`. Stop if V2 supply is non-zero. This lock cannot be rolled back.
4. Set `V2_PHASE=register` and run `npm --workspace onchain exec -- hardhat run scripts/deploy-v2-migration.ts --network <baseSepolia|base>`. Review `safe-04-v2-vault-pairs-{schedule,execute}.json`. After execution, require `vaultPairCount=7`, `vaultPairsLocked=true`, and every V1 vault maps to its manifest V2 importer. Stop on any order/address mismatch or non-zero V2 supply. The pair lock cannot be rolled back.
5. With all three approval flags true, run `npm --workspace onchain exec -- hardhat run scripts/import-v2-schedules.ts --network <baseSepolia|base>`. Review but do not yet execute `safe-05-v1-enter-migration-{schedule,execute}.json`. Immediately before execution, repeat: code hashes, V2 zero supply, authority lock, seven-pair lock, Pauser availability, participant notice, and supply reconciliation.
6. Execute V1 migration-mode entry through the Timelock. Read back V1 `transferMode=MIGRATION_ONLY` and the exact Migration address. This is the point of no return; normal V1 transfers cannot resume.
7. Execute the generated seven-vault import plan in controlled batches. For every batch record `sourceScheduleId`, `sourceBatchId`, V1 amount burned, V2 amount minted, imported schedule hash, and remaining entitlement. Require atomic receipt success and unique IDs.
8. After each participant or vault batch, run `npm --workspace onchain exec -- hardhat run scripts/reconcile-supply.ts --network <baseSepolia|base>` with both manifests and the approved participant address set from the encrypted operations ledger. Require `supplyError=0`, `migrationCounterError=0`, every vault pair backing error `0`, and `exact=true`; the repository evidence stores only pseudonymous participant IDs and aggregate balances.
9. Keep V1 and V2 contract explorers, operator UI, and incident dashboard visible until the observation window closes. Record any failed transaction without retrying a changed payload until reviewed.

## Stop and rollback boundary

Before Timelock execution, cancel or let a scheduled operation expire according to governance procedure. After migration authority/pair locks, deploy a new V2 candidate only under a supersession record; the locked candidate remains immutable. After V1 enters migration-only mode there is no rollback to normal V1 transfer. Contain with pause, preserve both supplies, stop further batches, reconcile to the last successful transaction, and use an independently audited recovery migration. Never mint compensation tokens or alter schedule totals to hide a discrepancy.
