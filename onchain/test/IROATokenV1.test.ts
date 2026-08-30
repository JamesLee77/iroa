import { expect } from "chai";
import { network } from "hardhat";

describe("IROATokenV1", function () {
  async function deployTokenFixture() {
    const { ethers } = await network.connect();
    const [genesis, admin, pauser, participant, outsider] = await ethers.getSigners();
    const token = await ethers.deployContract("IROATokenV1", [
      genesis.address,
      admin.address,
      pauser.address,
    ]);
    const v2 = await ethers.deployContract("IROATokenV2", [admin.address, pauser.address]);
    const migration = await ethers.deployContract("IROAMigrationV1ToV2", [
      token.target,
      v2.target,
      admin.address,
    ]);
    await Promise.all([token.waitForDeployment(), v2.waitForDeployment(), migration.waitForDeployment()]);
    await v2.connect(admin).bindMigrationContract(migration.target);
    await v2.connect(admin).lockMigrationAuthority();

    return { ethers, token, v2, genesis, admin, pauser, participant, outsider, migration };
  }

  it("mints the fixed 10 billion supply exactly once to the Genesis Safe", async function () {
    const { ethers, token, genesis } = await deployTokenFixture();
    const supply = ethers.parseEther("10000000000");

    expect(await token.totalSupply()).to.equal(supply);
    expect(await token.balanceOf(genesis.address)).to.equal(supply);
    expect(token.interface.hasFunction("mint")).to.equal(false);
    expect(token.interface.hasFunction("burn")).to.equal(false);
  });

  it("does not grant transfer permission merely because an address administers governance", async function () {
    const { token, genesis, admin } = await deployTokenFixture();

    expect(await token.isAllowed(genesis.address)).to.equal(true);
    expect(await token.isAllowed(admin.address)).to.equal(false);
  });

  it("allows transfers only between allowlisted participants", async function () {
    const { ethers, token, genesis, admin, participant, outsider } = await deployTokenFixture();

    await token.connect(admin).setAllowed(participant.address, true);
    await token.connect(genesis).transfer(participant.address, ethers.parseEther("10"));
    expect(await token.balanceOf(participant.address)).to.equal(ethers.parseEther("10"));

    await expect(token.connect(participant).transfer(outsider.address, 1n))
      .to.be.revertedWithCustomError(token, "AccountNotAllowed")
      .withArgs(outsider.address);
  });

  it("pauses private transfers without blocking the one-way migration transition", async function () {
    const { token, admin, pauser, genesis, migration } = await deployTokenFixture();

    await token.connect(pauser).pause();
    await expect(token.connect(genesis).transfer(admin.address, 1n)).to.be.revertedWithCustomError(
      token,
      "TransfersPaused",
    );

    await token.connect(admin).enterMigrationMode(migration.target);
    expect(await token.transferMode()).to.equal(2n);
    expect(await token.migrationContract()).to.equal(migration.target);
  });

  it("permits only deposits to the bound migration contract and its dedicated burn", async function () {
    const { ethers, token, v2, genesis, admin, participant, outsider, migration } =
      await deployTokenFixture();

    await token.connect(admin).setAllowed(participant.address, true);
    await v2.connect(admin).setAllowed(participant.address, true);
    await token.connect(genesis).transfer(participant.address, ethers.parseEther("25"));
    await token.connect(admin).enterMigrationMode(migration.target);

    await expect(token.connect(participant).burnForMigration(1n))
      .to.be.revertedWithCustomError(token, "OnlyMigrationContract")
      .withArgs(participant.address);
    await expect(token.connect(participant).transfer(outsider.address, 1n)).to.be.revertedWithCustomError(
      token,
      "MigrationTransferRequired",
    );

    const amount = ethers.parseEther("10");
    const supplyBefore = await token.totalSupply();
    await token.connect(participant).approve(migration.target, amount);
    await migration.connect(participant).migrate(amount);

    expect(await token.totalSupply()).to.equal(supplyBefore - amount);
    expect(await token.balanceOf(migration.target)).to.equal(0n);
  });

  it("makes migration mode and the migration allowlist binding irreversible", async function () {
    const { token, admin, pauser, migration, outsider } = await deployTokenFixture();
    await token.connect(admin).enterMigrationMode(migration.target);

    await expect(token.connect(admin).enterMigrationMode(outsider.address)).to.be.revertedWithCustomError(
      token,
      "MigrationAlreadyConfigured",
    );
    await expect(token.connect(pauser).unpause()).to.be.revertedWithCustomError(
      token,
      "MigrationAlreadyConfigured",
    );
    await expect(token.connect(admin).setAllowed(migration.target, false)).to.be.revertedWithCustomError(
      token,
      "MigrationContractMustRemainAllowed",
    );
  });
});
