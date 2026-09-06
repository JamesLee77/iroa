import { expect } from "chai";
import { network } from "hardhat";

describe("IROATokenV2", function () {
  it("refuses to bind a migration contract that was deployed for a different V2", async function () {
    const { ethers } = await network.connect();
    const [genesis, admin, pauser] = await ethers.getSigners();
    const v1 = await ethers.deployContract("IROATokenV1", [genesis.address, admin.address, pauser.address]);
    const v2 = await ethers.deployContract("IROATokenV2", [admin.address, pauser.address]);
    const otherV2 = await ethers.deployContract("IROATokenV2", [admin.address, pauser.address]);
    await Promise.all([v1.waitForDeployment(), v2.waitForDeployment(), otherV2.waitForDeployment()]);
    const foreignMigration = await ethers.deployContract("IROAMigrationV1ToV2", [
      v1.target,
      otherV2.target,
      admin.address,
    ]);
    await foreignMigration.waitForDeployment();

    await expect(v2.connect(admin).bindMigrationContract(foreignMigration.target))
      .to.be.revertedWithCustomError(v2, "InvalidMigrationContract")
      .withArgs(foreignMigration.target);
    await expect(v2.connect(admin).bindMigrationContract(v1.target))
      .to.be.revertedWithCustomError(v2, "InvalidMigrationContract")
      .withArgs(v1.target);
    expect(await v2.migrationContract()).to.equal(ethers.ZeroAddress);

    const migration = await ethers.deployContract("IROAMigrationV1ToV2", [v1.target, v2.target, admin.address]);
    await migration.waitForDeployment();
    await v2.connect(admin).bindMigrationContract(migration.target);
    expect(await v2.migrationContract()).to.equal(migration.target);
  });
});
