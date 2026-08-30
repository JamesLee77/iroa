# IROA V1 Base Mainnet private deployment runbook

Status: controlled production procedure. Base Mainnet chain ID is `8453`. This runbook does not authorize public sale, exchange listing, public distribution, or any expectation of token price or return.

## Hard gates

All of the following must be recorded before the first mainnet transaction:

- the final audit package is bound to the candidate commit and all must-fix findings are closed;
- the Base Sepolia rehearsal evidence is approved and no deployment input has changed without a documented delta review;
- Safe owners, quorum, beneficiary wallets, role wallets, vesting start, and contract bytecode hashes have two-person confirmation;
- incident owner, Pauser Safe signer, RPC fallback, explorer verification account, and communications owner are on call.

Before any V1 token is privately distributed to a participant, the encrypted operations ledger must contain a non-placeholder written legal review document ID and an explicit list of allowed participant jurisdictions. Missing, expired, ambiguous, or conflicting legal review is a mandatory stop. The repository records only the review ID, approval date, scope hash, and jurisdiction codes—never participant identity.

## Signers and required variables

| Stage | Signer | Required environment variable names |
|---|---|---|
| Deploy | dedicated Mainnet deployer | `DEPLOYMENT_PROFILE=base-mainnet`, `BASE_MAINNET_RPC_URL`, `BASE_MAINNET_DEPLOYER_PRIVATE_KEY`, `GENESIS_SAFE`, `PAUSER_SAFE`, `TEAM_BENEFICIARY`, `INVESTOR_BENEFICIARY`, `FOUNDATION_BENEFICIARY`, `TREASURY`, `RELEASE_MANAGER`, `COMPLIANCE_SAFE`, `SUSPENDER_SAFE`, `ROOT_PROPOSER_SAFE`, `CHALLENGER_SAFE`, `VESTING_START_TIMESTAMP`, `DEPLOYMENT_MANIFEST` |
| Handoff | manifest deployer, reviewed by Safe quorum | `ROLE_HANDOFF_ENABLED=true`, `REWARD_DISTRIBUTOR`, `ROLE_REPORT` |
| Allowlist/allocation | Genesis Safe quorum | `ALLOWLIST_BATCH`, `ALLOCATION_BATCH` |
| Read-only evidence | operations verifier | `VERIFICATION_REPORT`, `RECONCILIATION_REPORT`, `PARTICIPANT_ADDRESSES_JSON` |
| Private distribution gate | compliance and legal approvers | ledger fields `legalReviewDocumentId`, `legalReviewScopeHash`, `allowedJurisdictions`, `agreementId` |

Secret values belong in the approved secret manager. Do not use shell history, chat, issue trackers, source files, screenshots, or audit-package documents to carry them.

## Deployment and read-back

1. Independently query two Base RPC providers and confirm chain ID `8453`, the deployer nonce, gas policy, and Safe addresses. Stop on disagreement.
2. Run:

   ```bash
   npm --workspace onchain exec -- hardhat run scripts/deploy-v1.ts --network base
   ```

3. Freeze the resulting signed manifest. Confirm `profile=base-mainnet`, `chainId=8453`, seven unique vaults, expected controls, and manifest signer equal to the deployer. Compare every `bytecodeHashes` value with independent RPC code. Any mismatch invalidates the deployment candidate.
4. Verify source with the exact compiler profile and record the direct BaseScan URLs. Verification failure does not change deployed code; stop all subsequent state changes until resolved.
5. Set `REWARD_DISTRIBUTOR` from the manifest and execute `npm --workspace onchain exec -- hardhat run scripts/handoff-roles.ts --network base`. Review every grant receipt and read-back before deployer renunciation. Record `role-handoff.json` and confirm the deployer has no unexpected admin or allowlist role.
6. Run `npm --workspace onchain exec -- hardhat run scripts/allocate-genesis.ts --network base` to generate Safe payloads. Execute the allowlist payload first. Independently read back the Genesis Safe and exactly seven vaults. Only then regenerate/review the allocation payload and confirm its sum is exactly `10B IROA`.
7. Execute the allocation payload through the Genesis Safe. Run `npm --workspace onchain exec -- hardhat run scripts/verify-deployment.ts --network base` and `npm --workspace onchain exec -- hardhat run scripts/reconcile-supply.ts --network base`; require exact supply, vault backing, and migration counters.
8. Build the operator/admin profiles only from the frozen mainnet manifest. Confirm profile chain `8453` and absence of Sepolia contract addresses before publishing behind access control.

## Private participant distribution

For each pseudonymous participant row, compliance confirms wallet ownership, agreement, jurisdiction eligibility, allowlist transaction, purpose and maximum allocation. Treasury proposes a separate Safe transaction. A second reviewer compares the proposal against the ledger before signing. After execution, record the transaction hash, block, resulting allowlist state and balance read-back.

No distribution occurs when the written legal review document ID or allowed-jurisdiction list is absent, when the participant jurisdiction is outside that list, when the agreement is unsigned, when wallet ownership is unproved, or when sanctions/eligibility review is unresolved.

## Stop, containment, and rollback boundary

Stop on chain mismatch, nonce drift, gas-policy breach, signer/quorum change, unverified code, source/hash mismatch, role ambiguity, supply error of even `1 wei`, legal gate failure, PII/secret exposure, active incident, or audit must-fix finding.

Deployment, confirmed token transfers, role renunciation, and migration-mode entry cannot be rolled back. Prior to a transaction, discard the proposal. After deployment but before distribution, mark the manifest superseded and leave the deployment unused. After allocation or distribution, use the Pauser Safe for containment, preserve evidence, notify incident owners, and proceed only under an approved recovery plan. Never “fix” a mainnet mismatch by silently redeploying or issuing another supply.
