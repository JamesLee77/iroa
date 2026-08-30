import { expect } from "chai";
import { network } from "hardhat";

const GENESIS_SUPPLY = 10_000_000_000n * 10n ** 18n;
const MONTH = 30 * 24 * 60 * 60;
const SNAPSHOT_TYPE =
  "tuple(uint8 kind,address beneficiary,uint256 total,uint256 released,uint64 start,uint32 cliffMonths,uint32 linearDurationMonths,uint256[] cumulativeReleaseTable,bytes32 sourceScheduleId)";

describe("IROA V1 to V2 migration invariants", function () {
  async function deployMigrationCore() {
    const { ethers, networkHelpers } = await network.connect();
    const [genesis, admin, pauser, user, team, investor, foundation, treasury] =
      await ethers.getSigners();
    const v1 = await ethers.deployContract("IROATokenV1", [
      genesis.address,
      admin.address,
      pauser.address,
    ]);
    const v2 = await ethers.deployContract("IROATokenV2", [admin.address, pauser.address]);
    const migration = await ethers.deployContract("IROAMigrationV1ToV2", [
      v1.target,
      v2.target,
      admin.address,
    ]);
    await Promise.all([v1.waitForDeployment(), v2.waitForDeployment(), migration.waitForDeployment()]);
    await v2.connect(admin).bindMigrationContract(migration.target);
    await v2.connect(admin).lockMigrationAuthority();
    return {
      ethers,
      networkHelpers,
      v1,
      v2,
      migration,
      genesis,
      admin,
      pauser,
      user,
      team,
      investor,
      foundation,
      treasury,
    };
  }

  async function deploySevenVaultFixture() {
    const fixture = await deployMigrationCore();
    const {
      ethers,
      networkHelpers,
      v1,
      v2,
      migration,
      genesis,
      admin,
      team,
      investor,
      foundation,
      treasury,
    } = fixture;
    const start = await networkHelpers.time.latest();
    const vaults = [
      await ethers.deployContract("MonthlyEmissionVault", [
        v1.target,
        ethers.parseEther("2500000000"),
        start,
        [15, 13, 12, 11, 10, 9, 8, 7, 5, 4, 3, 3],
        true,
        admin.address,
        ethers.ZeroAddress,
      ]),
      await ethers.deployContract("MonthlyEmissionVault", [
        v1.target,
        ethers.parseEther("2300000000"),
        start,
        [12, 12, 11, 11, 10, 10, 9, 9, 8, 8],
        false,
        admin.address,
        admin.address,
      ]),
      await ethers.deployContract("MonthlyEmissionVault", [
        v1.target,
        ethers.parseEther("1500000000"),
        start,
        [12, 12, 12, 12, 12, 10, 10, 8, 6, 6],
        false,
        admin.address,
        admin.address,
      ]),
      await ethers.deployContract("CliffLinearVestingVault", [
        v1.target,
        team.address,
        ethers.parseEther("1500000000"),
        start,
        24,
        72,
      ]),
      await ethers.deployContract("CliffLinearVestingVault", [
        v1.target,
        investor.address,
        ethers.parseEther("1000000000"),
        start,
        18,
        42,
      ]),
      await ethers.deployContract("CliffLinearVestingVault", [
        v1.target,
        foundation.address,
        ethers.parseEther("700000000"),
        start,
        12,
        84,
      ]),
      await ethers.deployContract("LiquidityReleaseVault", [v1.target, treasury.address, start]),
    ];
    const allocations = [
      "2500000000",
      "2300000000",
      "1500000000",
      "1500000000",
      "1000000000",
      "700000000",
      "500000000",
    ].map(ethers.parseEther);
    const importers = [];

    for (let i = 0; i < vaults.length; i += 1) {
      await vaults[i].waitForDeployment();
      const importer = await ethers.deployContract("V2ScheduleImporter", [v2.target, migration.target]);
      await importer.waitForDeployment();
      importers.push(importer);
      await v1.connect(admin).setAllowed(vaults[i].target, true);
      await v1.connect(genesis).transfer(vaults[i].target, allocations[i]);
      await migration.connect(admin).registerVaultPair(vaults[i].target, importer.target);
    }

    await migration.connect(admin).lockVaultPairs();
    await v1.connect(admin).enterMigrationMode(migration.target);
    return { ...fixture, start, vaults, importers, allocations };
  }

  async function deployProbeFixture() {
    const fixture = await deployMigrationCore();
    const { ethers, v1, v2, migration, genesis, admin } = fixture;
    const probes = [];
    const importers = [];
    for (let i = 0; i < 7; i += 1) {
      const probe = await ethers.deployContract("MigrationVaultProbe", [v1.target, admin.address]);
      const importer = await ethers.deployContract("V2ScheduleImporter", [v2.target, migration.target]);
      await Promise.all([probe.waitForDeployment(), importer.waitForDeployment()]);
      probes.push(probe);
      importers.push(importer);
      await v1.connect(admin).setAllowed(probe.target, true);
      await migration.connect(admin).registerVaultPair(probe.target, importer.target);
    }
    await v1.connect(genesis).transfer(probes[0].target, 100n);
    await migration.connect(admin).lockVaultPairs();
    await v1.connect(admin).enterMigrationMode(migration.target);
    return { ...fixture, probes, importers };
  }

  function snapshotHash(ethers: Awaited<ReturnType<typeof deployMigrationCore>>["ethers"], snapshot: unknown) {
    return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode([SNAPSHOT_TYPE], [snapshot]));
  }

  async function expectSupplyInvariant(v1: any, v2: any) {
    expect((await v1.totalSupply()) + (await v2.totalSupply())).to.equal(GENESIS_SUPPLY);
  }

  it("starts V2 at zero and permanently locks its only migration minter", async function () {
    const { v2, admin, user } = await deployMigrationCore();
    expect(await v2.totalSupply()).to.equal(0n);
    expect(await v2.migrationAuthorityLocked()).to.equal(true);
    expect(v2.interface.hasFunction("mint")).to.equal(false);
    expect(v2.interface.hasFunction("burn")).to.equal(false);
    await expect(v2.connect(admin).bindMigrationContract(user.address)).to.be.revertedWithCustomError(
      v2,
      "MigrationAlreadyBound",
    );
  });

  it("preserves supply through arbitrary partial user migrations down to the final wei", async function () {
    const { v1, v2, migration, genesis, admin, user } = await deployMigrationCore();
    const initial = 97n;
    await v1.connect(admin).setAllowed(user.address, true);
    await v2.connect(admin).setAllowed(user.address, true);
    await v1.connect(genesis).transfer(user.address, initial);
    await v1.connect(admin).enterMigrationMode(migration.target);
    await v1.connect(user).approve(migration.target, initial);

    for (const amount of [11n, 29n, 56n, 1n]) {
      await migration.connect(user).migrate(amount);
      await expectSupplyInvariant(v1, v2);
      expect(await migration.migrationBurned()).to.equal(await migration.migrationMinted());
    }
    expect(await v1.balanceOf(user.address)).to.equal(0n);
    expect(await v2.balanceOf(user.address)).to.equal(initial);
  });

  it("locks exactly seven unique V1 and V2 vault pairs", async function () {
    const { migration, vaults, importers, admin } = await deploySevenVaultFixture();
    expect(await migration.vaultPairCount()).to.equal(7n);
    expect(await migration.vaultPairsLocked()).to.equal(true);
    await expect(
      migration.connect(admin).registerVaultPair(vaults[0].target, importers[1].target),
    ).to.be.revertedWithCustomError(migration, "VaultPairsLocked");
  });

  it("migrates an exact cliff snapshot atomically without re-vesting released tokens", async function () {
    const fixture = await deploySevenVaultFixture();
    const { ethers, v1, v2, migration, team, vaults, importers, start } = fixture;
    const teamVault = vaults[3];
    const importer = importers[3];
    const scheduleId = ethers.id("team-v1-schedule");
    const batchId = ethers.id("team-v1-batch");

    await teamVault
      .connect(team)
      .migrateRemaining(migration.target, importer.target, scheduleId, batchId);

    const imported = await importer.getSchedule(scheduleId);
    expect(imported.total).to.equal(ethers.parseEther("1500000000"));
    expect(imported.released).to.equal(0n);
    expect(imported.start).to.equal(BigInt(start));
    expect(imported.cliffMonths).to.equal(24n);
    expect(imported.linearDurationMonths).to.equal(72n);
    expect(await v2.balanceOf(importer.target)).to.equal(ethers.parseEther("1500000000"));
    await expectSupplyInvariant(v1, v2);
  });

  it("reverts V1 burn and V2 mint together when schedule import fails", async function () {
    const { ethers, v1, v2, migration, admin, probes, importers } = await deployProbeFixture();
    const snapshot = {
      kind: 0,
      beneficiary: ethers.ZeroAddress,
      total: 100n,
      released: 0n,
      start: 0,
      cliffMonths: 0,
      linearDurationMonths: 12,
      cumulativeReleaseTable: [],
      sourceScheduleId: ethers.id("invalid-schedule"),
    };
    const batch = {
      v2Vault: importers[0].target,
      amount: 100n,
      scheduleSnapshotHash: snapshotHash(ethers, snapshot),
      sourceBatchId: ethers.id("invalid-batch"),
      snapshot,
    };

    const v1SupplyBefore = await v1.totalSupply();
    await expect(probes[0].connect(admin).migrate(migration.target, batch)).to.be.revertedWithCustomError(
      importers[0],
      "InvalidSchedule",
    );
    expect(await v1.totalSupply()).to.equal(v1SupplyBefore);
    expect(await v2.totalSupply()).to.equal(0n);
    expect(await migration.usedSourceBatch(batch.sourceBatchId)).to.equal(false);
  });

  it("rejects duplicate schedule IDs without consuming the second V1 batch", async function () {
    const { ethers, v1, v2, migration, admin, probes, importers } = await deployProbeFixture();
    const sourceScheduleId = ethers.id("one-schedule");
    const snapshot = {
      kind: 0,
      beneficiary: admin.address,
      total: 50n,
      released: 0n,
      start: 0,
      cliffMonths: 0,
      linearDurationMonths: 12,
      cumulativeReleaseTable: [],
      sourceScheduleId,
    };
    const first = {
      v2Vault: importers[0].target,
      amount: 50n,
      scheduleSnapshotHash: snapshotHash(ethers, snapshot),
      sourceBatchId: ethers.id("batch-1"),
      snapshot,
    };
    await probes[0].connect(admin).migrate(migration.target, first);
    const second = { ...first, sourceBatchId: ethers.id("batch-2") };

    await expect(probes[0].connect(admin).migrate(migration.target, second))
      .to.be.revertedWithCustomError(importers[0], "ScheduleAlreadyImported")
      .withArgs(sourceScheduleId);
    expect(await v1.balanceOf(probes[0].target)).to.equal(50n);
    expect(await v2.balanceOf(importers[0].target)).to.equal(50n);
    await expectSupplyInvariant(v1, v2);
  });

  it("preserves cumulative monthly and liquidity schedule endpoints", async function () {
    const { ethers, migration, admin, treasury, vaults, importers } = await deploySevenVaultFixture();
    const monthlyId = ethers.id("node-cumulative");
    await vaults[0]
      .connect(admin)
      .migrateRemaining(migration.target, importers[0].target, monthlyId, ethers.id("node-batch"));
    const monthly = await importers[0].getSchedule(monthlyId);
    expect(monthly.cumulativePointCount).to.equal(144n);
    expect(await importers[0].cumulativeReleasePoint(monthlyId, 143)).to.equal(
      ethers.parseEther("2500000000"),
    );

    const liquidityId = ethers.id("liquidity-cumulative");
    await vaults[6]
      .connect(treasury)
      .migrateRemaining(
        migration.target,
        importers[6].target,
        liquidityId,
        ethers.id("liquidity-batch"),
      );
    const liquidity = await importers[6].getSchedule(liquidityId);
    expect(liquidity.beneficiary).to.equal(treasury.address);
    expect(liquidity.cumulativePointCount).to.equal(37n);
    expect(await importers[6].cumulativeReleasePoint(liquidityId, 36)).to.equal(
      ethers.parseEther("500000000"),
    );
  });
});
