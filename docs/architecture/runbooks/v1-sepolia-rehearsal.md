# IROA V1 Base Sepolia rehearsal runbook

Status: executable rehearsal procedure. This document contains variable names and evidence paths only; never paste secret values into the repository or command transcripts.

## Scope and exit criteria

This rehearsal proves chain selection, deterministic deployment, contract read-back, role handoff, seven-vault allocation, private participant flows, and supply reconciliation on Base Sepolia (`84532`). It does not authorize Base Mainnet deployment or distribution.

Exit only when all stop conditions below are clear, the manifest signature is valid, every deployed bytecode hash matches, the seven allocations total exactly `10,000,000,000 IROA`, and the supply reconciliation error is `0 wei`.

## Signer and environment checklist

| Action | Required signer | Environment variable names | Expected chain |
|---|---|---|---:|
| Deploy V1 contracts | dedicated Sepolia deployer | `DEPLOYMENT_PROFILE`, `BASE_SEPOLIA_RPC_URL`, `BASE_SEPOLIA_DEPLOYER_PRIVATE_KEY`, `GENESIS_SAFE`, `PAUSER_SAFE`, `TEAM_BENEFICIARY`, `INVESTOR_BENEFICIARY`, `FOUNDATION_BENEFICIARY`, `TREASURY`, `RELEASE_MANAGER`, `COMPLIANCE_SAFE`, `SUSPENDER_SAFE`, `ROOT_PROPOSER_SAFE`, `CHALLENGER_SAFE`, `VESTING_START_TIMESTAMP`, `DEPLOYMENT_MANIFEST` | `84532` |
| Role handoff | manifest deployer; Safe owners review | prior variables plus `ROLE_HANDOFF_ENABLED`, `REWARD_DISTRIBUTOR`, `ROLE_REPORT` | `84532` |
| Allowlist and allocation | Genesis Safe quorum | `ALLOWLIST_BATCH`, `ALLOCATION_BATCH` | Safe batch `chainId=84532` |
| Verification and reconciliation | read-only RPC | `DEPLOYMENT_MANIFEST`, `VERIFICATION_REPORT`, `RECONCILIATION_REPORT`, `PARTICIPANT_ADDRESSES_JSON` | `84532` |

Before signing, record signer hardware-wallet fingerprints and quorum confirmation in the encrypted operations ledger. Repository evidence uses signer role names and transaction hashes only.

## Procedure

1. Confirm `DEPLOYMENT_PROFILE=base-sepolia`, inspect the RPC-reported chain ID independently, and stop if it is not `84532`. Confirm every beneficiary and Safe address by two-person review. Set `VESTING_START_TIMESTAMP` to the approved UTC epoch.
2. Deploy without printing environment values:

   ```bash
   npm --workspace onchain exec -- hardhat run scripts/deploy-v1.ts --network baseSepolia
   ```

   Expected output: `onchain/deployments/base-sepolia/v1.json` (or `DEPLOYMENT_MANIFEST`). Confirm `profile=base-sepolia`, `chainId=84532`, `release=v1`, seven unique vaults, and a valid manifest signature.
3. Compare every `bytecodeHashes` entry in the signed manifest with an independent RPC `eth_getCode` hash. The expected contract hash is the exact manifest value produced from the reviewed commit—not a manually copied address. Stop on any missing code or mismatch.
4. Set `REWARD_DISTRIBUTOR` to `manifest.contracts.rewardDistributor`, then run the role handoff only after the generated grant set is reviewed:

   ```bash
   npm --workspace onchain exec -- hardhat run scripts/handoff-roles.ts --network baseSepolia
   ```

   Read back each granted role before deployer renunciation. Stop if any receipt is missing or any deployer privilege remains unexpectedly.
5. Generate the allowlist batch:

   ```bash
   npm --workspace onchain exec -- hardhat run scripts/allocate-genesis.ts --network baseSepolia
   ```

   Execute only the allowlist batch through the Genesis Safe. Read back the Safe and exactly seven vaults with `isAllowed=true`. Rerun the generator only to produce the allocation batch after that on-chain read-back.
6. Review the allocation batch totals: NODE `2.5B`, ecosystem `2.3B`, R&D `1.5B`, team/advisors `1.5B`, initial investors `1.0B`, foundation `0.7B`, liquidity operations `0.5B`. Execute through the Genesis Safe and retain the Safe transaction hash.
7. Verify deployment and reconcile supply:

   ```bash
   npm --workspace onchain exec -- hardhat run scripts/verify-deployment.ts --network baseSepolia
   npm --workspace onchain exec -- hardhat run scripts/reconcile-supply.ts --network baseSepolia
   ```

   Read back `totalSupply=10000000000000000000000000000`, every configured vault allocation, `bytecodeHashesVerified=true`, and reconciliation `exact=true` with all error fields `0`.
8. Publish verified source for the exact compiler settings (`0.8.24`, optimizer `200`, EVM `cancun`, IPFS metadata hash). Record each BaseScan verified-source URL in the audit manifest evidence copy.
9. Run the private participant flow using repository-safe pseudonyms and the ledger in `private-participant-validation.md`. Export observed metrics with `tools/tokenomics/export-pilot-metrics.mjs`.

## Stop conditions and rollback

Stop before the next transaction on wrong chain, unexpected nonce, changed Safe quorum, unreviewed address, manifest signature failure, bytecode hash mismatch, failed role read-back, allocation mismatch, non-zero supply error, exposed secret, or unresolved high/critical audit finding.

Contract deployment is not reversible. Before allocation, abandon the deployment and publish a superseded-manifest record. Before Safe execution, discard an unsigned batch. After allocation, pause transfers with the Pauser Safe and create an incident; do not redeploy or redistribute automatically. Role renunciation and V1 migration mode are irreversible and require a fresh read-back immediately before execution.
