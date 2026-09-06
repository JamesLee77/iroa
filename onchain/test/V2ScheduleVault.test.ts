import { expect } from "chai";
import { network } from "hardhat";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

const MONTH = 30 * 24 * 60 * 60;
const NODE_WEIGHTS = [15, 13, 12, 11, 10, 9, 8, 7, 5, 4, 3, 3];
const ECOSYSTEM_WEIGHTS = [12, 12, 11, 11, 10, 10, 9, 9, 8, 8];
const LEAF_TYPES = ["uint64", "bytes32", "bytes32", "uint256", "uint256", "bytes32", "string", "bytes32"];

type V1VaultSpec =
  | { kind: "cliff"; total: bigint; cliffMonths: number; linearMonths: number }
  | { kind: "liquidity" }
  | { kind: "monthly"; total: bigint; weights: number[]; rewardClaimsOnly: boolean };

describe("V2ScheduleVault", function () {
  /**
   * One real V1 vault paired with one V2ScheduleVault, six probes filling the other
   * pairs so the seven-pair lock can close. The V1 vault is funded exactly; releases
   * before the migration are made by the test itself.
   */
  async function deployPair(spec: V1VaultSpec) {
    const { ethers, networkHelpers } = await network.connect();
    const [genesis, admin, pauser, beneficiary, releaseManager, recipient, operator, compliance, proposer] =
      await ethers.getSigners();
    const v1 = await ethers.deployContract("IROATokenV1", [genesis.address, admin.address, pauser.address]);
    const v2 = await ethers.deployContract("IROATokenV2", [admin.address, pauser.address]);
    const migration = await ethers.deployContract("IROAMigrationV1ToV2", [v1.target, v2.target, admin.address]);
    await Promise.all([v1.waitForDeployment(), v2.waitForDeployment(), migration.waitForDeployment()]);
    await v2.connect(admin).bindMigrationContract(migration.target);
    await v2.connect(admin).lockMigrationAuthority();

    const start = (await networkHelpers.time.latest()) + 60;
    let v1Vault;
    let total: bigint;
    let managed = false;
    let rewardClaimsOnly = false;
    if (spec.kind === "cliff") {
      total = spec.total;
      v1Vault = await ethers.deployContract("CliffLinearVestingVault", [
        v1.target, beneficiary.address, total, start, spec.cliffMonths, spec.linearMonths,
      ]);
    } else if (spec.kind === "liquidity") {
      total = ethers.parseEther("500000000");
      v1Vault = await ethers.deployContract("LiquidityReleaseVault", [v1.target, beneficiary.address, start]);
    } else {
      total = spec.total;
      rewardClaimsOnly = spec.rewardClaimsOnly;
      managed = !rewardClaimsOnly;
      v1Vault = await ethers.deployContract("MonthlyEmissionVault", [
        v1.target, total, start, spec.weights, rewardClaimsOnly, admin.address,
        rewardClaimsOnly ? ethers.ZeroAddress : releaseManager.address,
      ]);
    }
    const v2Vault = await ethers.deployContract("V2ScheduleVault", [
      v2.target, migration.target, admin.address, managed ? releaseManager.address : ethers.ZeroAddress, rewardClaimsOnly,
    ]);
    await Promise.all([v1Vault.waitForDeployment(), v2Vault.waitForDeployment()]);

    // Beneficiaries must be allowlisted on both tokens: V1 for the releases made before
    // the migration, V2 for the ones made after it.
    for (const account of [v1Vault.target, beneficiary.address, recipient.address]) {
      await v1.connect(admin).setAllowed(account, true);
    }
    await v1.connect(genesis).transfer(v1Vault.target, total);
    await migration.connect(admin).registerVaultPair(v1Vault.target, v2Vault.target);
    for (let i = 0; i < 6; i += 1) {
      const probe = await ethers.deployContract("MigrationVaultProbe", [v1.target, admin.address]);
      const importer = await ethers.deployContract("V2ScheduleImporter", [v2.target, migration.target]);
      await Promise.all([probe.waitForDeployment(), importer.waitForDeployment()]);
      await migration.connect(admin).registerVaultPair(probe.target, importer.target);
    }
    await migration.connect(admin).lockVaultPairs();
    await v2.connect(admin).setAllowed(beneficiary.address, true);
    await v2.connect(admin).setAllowed(recipient.address, true);
    await v2.connect(admin).setAllowed(operator.address, true);

    const scheduleId = ethers.id(`schedule:${spec.kind}`);
    const migrate = async () => {
      await v1.connect(admin).enterMigrationMode(migration.target);
      const caller = spec.kind === "monthly" ? admin : beneficiary;
      await v1Vault.connect(caller).migrateRemaining(migration.target, v2Vault.target, scheduleId, ethers.id("batch"));
    };
    const at = (months: number) => start + months * MONTH;

    return {
      ethers, networkHelpers, v1, v2, migration, v1Vault, v2Vault, total, start, at, migrate, scheduleId,
      genesis, admin, beneficiary, releaseManager, recipient, operator, compliance, proposer,
    };
  }

  it("continues a cliff-linear vesting exactly where V1 stopped", async function () {
    const total = 1_500_000_000n * 10n ** 18n;
    const f = await deployPair({ kind: "cliff", total, cliffMonths: 24, linearMonths: 72 });
    const { networkHelpers, v1, v2, v1Vault, v2Vault, beneficiary, at, migrate } = f;

    await networkHelpers.time.increaseTo(at(30));
    await v1Vault.release();
    const releasedInV1 = await v1.balanceOf(beneficiary.address);
    expect(releasedInV1).to.equal((total * 6n) / 72n);

    await migrate();
    for (const months of [0, 24, 25, 30, 31, 60, 96, 120]) {
      expect(await v2Vault.vestedAt(at(months)), `month ${months}`).to.equal(await v1Vault.vestedAt(at(months)));
    }
    await expect(v2Vault.release()).to.be.revertedWithCustomError(v2Vault, "NothingToRelease");

    await networkHelpers.time.increaseTo(at(31));
    await v2Vault.release();
    expect(await v2.balanceOf(beneficiary.address)).to.equal((total * 7n) / 72n - releasedInV1);

    await networkHelpers.time.increaseTo(at(24 + 72 + 1));
    await v2Vault.release();
    expect(releasedInV1 + (await v2.balanceOf(beneficiary.address))).to.equal(total);
    expect(await v2.balanceOf(v2Vault.target)).to.equal(0n);
    expect(await v2Vault.totalImportedRemaining()).to.equal(0n);
    await expect(v2Vault.release()).to.be.revertedWithCustomError(v2Vault, "NothingToRelease");
  });

  it("refuses the managed and reward paths on a beneficiary schedule", async function () {
    const f = await deployPair({ kind: "cliff", total: 10n ** 21n, cliffMonths: 1, linearMonths: 2 });
    const { v2Vault, admin, releaseManager, recipient, migrate } = f;
    await migrate();
    await v2Vault.connect(admin).grantRole(await v2Vault.RELEASE_MANAGER_ROLE(), releaseManager.address);
    await v2Vault.connect(admin).grantRole(await v2Vault.REWARD_DISTRIBUTOR_ROLE(), admin.address);

    await expect(v2Vault.connect(releaseManager).releaseForCurrentMonth(recipient.address, 1n))
      .to.be.revertedWithCustomError(v2Vault, "ScheduleKindMismatch");
    await expect(v2Vault.connect(admin).releaseReward(0, recipient.address, 1n))
      .to.be.revertedWithCustomError(v2Vault, "NotRewardClaimsVault");
  });

  it("continues the liquidity release table exactly where V1 stopped", async function () {
    const f = await deployPair({ kind: "liquidity" });
    const { networkHelpers, v1, v2, v1Vault, v2Vault, beneficiary, total, at, migrate } = f;

    await networkHelpers.time.increaseTo(at(5));
    await v1Vault.release();
    const releasedInV1 = await v1.balanceOf(beneficiary.address);
    expect(releasedInV1).to.equal(await v1Vault.vestedAt(at(5)));

    await migrate();
    for (const months of [0, 1, 5, 6, 18, 36, 40]) {
      expect(await v2Vault.vestedAt(at(months)), `month ${months}`).to.equal(await v1Vault.vestedAt(at(months)));
    }
    await networkHelpers.time.increaseTo(at(6));
    await v2Vault.release();
    expect(await v2.balanceOf(beneficiary.address)).to.equal((await v1Vault.vestedAt(at(6))) - releasedInV1);

    await networkHelpers.time.increaseTo(at(37));
    await v2Vault.release();
    expect(releasedInV1 + (await v2.balanceOf(beneficiary.address))).to.equal(total);
  });

  it("keeps managed monthly emission on the V1 budget with no carry-over across the migration", async function () {
    const total = 2_300_000_000n * 10n ** 18n;
    const f = await deployPair({ kind: "monthly", total, weights: ECOSYSTEM_WEIGHTS, rewardClaimsOnly: false });
    const { networkHelpers, v2, v1Vault, v2Vault, releaseManager, recipient, at, migrate } = f;

    await networkHelpers.time.increaseTo(at(0) + 10);
    await v1Vault.connect(releaseManager).releaseForCurrentMonth(recipient.address, 1_000n);

    await networkHelpers.time.increaseTo(at(2) + 10);
    await migrate();
    for (let month = 0; month < ECOSYSTEM_WEIGHTS.length * 12; month += 1) {
      expect(await v2Vault.monthlyBudget(month), `month ${month}`).to.equal(await v1Vault.monthlyBudget(month));
    }
    expect(await v2Vault.monthlyBudget(ECOSYSTEM_WEIGHTS.length * 12)).to.equal(0n);

    const budget = await v2Vault.monthlyBudget(2);
    await expect(v2Vault.connect(releaseManager).releaseForCurrentMonth(recipient.address, budget + 1n))
      .to.be.revertedWithCustomError(v2Vault, "MonthlyLimitExceeded")
      .withArgs(budget + 1n, budget);
    await v2Vault.connect(releaseManager).releaseForCurrentMonth(recipient.address, budget);
    expect(await v2.balanceOf(recipient.address)).to.equal(budget);
    // Months 0 and 1 were left unspent in V1; they do not reappear in V2.
    await expect(v2Vault.connect(releaseManager).releaseForCurrentMonth(recipient.address, 1n))
      .to.be.revertedWithCustomError(v2Vault, "MonthlyLimitExceeded")
      .withArgs(1n, 0n);
    await expect(v2Vault.connect(recipient).releaseForCurrentMonth(recipient.address, 1n))
      .to.be.revertedWithCustomError(v2Vault, "AccessControlUnauthorizedAccount");

    await networkHelpers.time.increaseTo(at(ECOSYSTEM_WEIGHTS.length * 12) + 10);
    await expect(v2Vault.connect(releaseManager).releaseForCurrentMonth(recipient.address, 1n))
      .to.be.revertedWithCustomError(v2Vault, "EmissionMonthInactive");
  });

  it("serves the NODE reward vault interface so the reward distributor works unchanged on V2", async function () {
    const total = 2_500_000_000n * 10n ** 18n;
    const f = await deployPair({ kind: "monthly", total, weights: NODE_WEIGHTS, rewardClaimsOnly: true });
    const { ethers, networkHelpers, v2, v1Vault, v2Vault, admin, operator, compliance, proposer, recipient, at, migrate } = f;

    await networkHelpers.time.increaseTo(at(1) + 10);
    await migrate();

    const nodeRegistry = await ethers.deployContract("IROANodeRegistry", [admin.address, compliance.address, admin.address]);
    const rootRegistry = await ethers.deployContract("IROAReceiptRootRegistry", [admin.address, proposer.address, admin.address]);
    await Promise.all([nodeRegistry.waitForDeployment(), rootRegistry.waitForDeployment()]);
    const distributor = await ethers.deployContract("IROARewardDistributor", [
      nodeRegistry.target, rootRegistry.target, v2.target, v2Vault.target,
    ]);
    await distributor.waitForDeployment();
    await v2Vault.connect(admin).grantRole(await v2Vault.REWARD_DISTRIBUTOR_ROLE(), distributor.target);

    const nodeId = ethers.id("node-v2");
    const operatorIdHash = ethers.id("operator-v2");
    await nodeRegistry.connect(operator).registerNode(nodeId, operatorIdHash, ethers.id("device-v2"), 1);
    await nodeRegistry.connect(compliance).approveNode(nodeId);

    const epoch = 1n;
    const amount = (await v1Vault.monthlyBudget(epoch)) / 100n;
    expect(await v2Vault.monthlyBudget(epoch)).to.equal(await v1Vault.monthlyBudget(epoch));
    const receiptBatchRoot = ethers.id("receipts-1");
    const policyVersion = "1.0.0";
    const claimNonce = ethers.id("nonce-1");
    const leaf = [epoch, operatorIdHash, nodeId, 1_000n, amount, receiptBatchRoot, policyVersion, claimNonce];
    const tree = StandardMerkleTree.of([leaf], LEAF_TYPES);

    await networkHelpers.time.increaseTo(at(2) + 10);
    await rootRegistry.connect(proposer).proposeRoot(epoch, tree.root, receiptBatchRoot, ethers.keccak256(ethers.toUtf8Bytes(policyVersion)));
    await networkHelpers.time.increase(60);
    await rootRegistry.finalizeRoot(epoch);

    await distributor.connect(operator).claim(epoch, operatorIdHash, nodeId, 1_000n, amount, receiptBatchRoot, policyVersion, claimNonce, tree.getProof(0));
    expect(await v2.balanceOf(operator.address)).to.equal(amount);
    expect(await v2Vault.releasedByMonth(epoch)).to.equal(amount);
    expect(await v2Vault.totalImportedRemaining()).to.equal(total - amount);

    await expect(v2Vault.connect(admin).releaseReward(epoch, recipient.address, 1n))
      .to.be.revertedWithCustomError(v2Vault, "AccessControlUnauthorizedAccount");
    await v2Vault.connect(admin).grantRole(await v2Vault.REWARD_DISTRIBUTOR_ROLE(), admin.address);
    await expect(v2Vault.connect(admin).releaseReward(2, recipient.address, 1n))
      .to.be.revertedWithCustomError(v2Vault, "RewardEpochNotClosed")
      .withArgs(2n);
    await expect(v2Vault.connect(admin).releaseReward(NODE_WEIGHTS.length * 12, recipient.address, 1n))
      .to.be.revertedWithCustomError(v2Vault, "InvalidEpoch");
    await expect(v2Vault.release()).to.be.revertedWithCustomError(v2Vault, "ScheduleKindMismatch");
  });

  it("carries exactly one schedule and reports nothing before it arrives", async function () {
    const { ethers } = await network.connect();
    const [genesis, admin, pauser, fakeMigration] = await ethers.getSigners();
    const v1 = await ethers.deployContract("IROATokenV1", [genesis.address, admin.address, pauser.address]);
    await v1.waitForDeployment();
    const vault = await ethers.deployContract("V2ScheduleVault", [v1.target, fakeMigration.address, admin.address, ethers.ZeroAddress, false]);
    await vault.waitForDeployment();
    await v1.connect(admin).setAllowed(vault.target, true);
    await v1.connect(genesis).transfer(vault.target, 200n);

    await expect(vault.vestedAt(0)).to.be.revertedWithCustomError(vault, "NoActiveSchedule");
    await expect(vault.release()).to.be.revertedWithCustomError(vault, "NoActiveSchedule");

    const snapshot = (id: string) => ({
      kind: 0, beneficiary: admin.address, total: 100n, released: 0n, start: 0, cliffMonths: 0,
      linearDurationMonths: 1, cumulativeReleaseTable: [], sourceScheduleId: ethers.id(id),
    });
    await expect(vault.connect(admin).importSchedule(snapshot("a")))
      .to.be.revertedWithCustomError(vault, "OnlyMigrationContract");
    await vault.connect(fakeMigration).importSchedule(snapshot("a"));
    expect(await vault.activeScheduleId()).to.equal(ethers.id("a"));
    await expect(vault.connect(fakeMigration).importSchedule(snapshot("b")))
      .to.be.revertedWithCustomError(vault, "ScheduleAlreadyActive")
      .withArgs(ethers.id("a"));
  });
});
