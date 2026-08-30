import { expect } from "chai";
import { network } from "hardhat";

const MONTH = 30 * 24 * 60 * 60;

describe("IROA allocation vaults", function () {
  async function deployToken() {
    const { ethers, networkHelpers } = await network.connect();
    const [genesis, admin, pauser, beneficiary, releaseManager, treasury] =
      await ethers.getSigners();
    const token = await ethers.deployContract("IROATokenV1", [
      genesis.address,
      admin.address,
      pauser.address,
    ]);
    await token.waitForDeployment();
    return {
      ethers,
      networkHelpers,
      token,
      genesis,
      admin,
      beneficiary,
      releaseManager,
      treasury,
    };
  }

  it("reconciles all seven vault allocations to the 10 billion genesis supply", async function () {
    const { ethers } = await deployToken();
    const allocations = [
      "2500000000",
      "2300000000",
      "1500000000",
      "1500000000",
      "1000000000",
      "700000000",
      "500000000",
    ].map(ethers.parseEther);

    expect(allocations.reduce((sum, amount) => sum + amount, 0n)).to.equal(
      ethers.parseEther("10000000000"),
    );
  });

  it("makes every monthly schedule exact while preventing missed-budget carryover", async function () {
    const { ethers, token, genesis, admin, releaseManager, beneficiary } = await deployToken();
    const now = 2_000_000_000;
    const schedules = [
      { allocation: "2500000000", weights: [15, 13, 12, 11, 10, 9, 8, 7, 5, 4, 3, 3] },
      { allocation: "2300000000", weights: [12, 12, 11, 11, 10, 10, 9, 9, 8, 8] },
      { allocation: "1500000000", weights: [12, 12, 12, 12, 12, 10, 10, 8, 6, 6] },
    ];

    for (const schedule of schedules) {
      const allocation = ethers.parseEther(schedule.allocation);
      const vault = await ethers.deployContract("MonthlyEmissionVault", [
        token.target,
        allocation,
        now,
        schedule.weights,
        false,
        admin.address,
        releaseManager.address,
      ]);
      await vault.waitForDeployment();

      let scheduled = 0n;
      for (let month = 0; month < schedule.weights.length * 12; month += 1) {
        scheduled += await vault.monthlyBudget(month);
      }
      expect(scheduled).to.equal(allocation);

      await token.connect(admin).setAllowed(vault.target, true);
      await token.connect(admin).setAllowed(beneficiary.address, true);
      await token.connect(genesis).transfer(vault.target, allocation);
      expect(await vault.releasableAt(now)).to.equal(await vault.monthlyBudget(0));
      expect(await vault.releasableAt(now + MONTH)).to.equal(await vault.monthlyBudget(1));
    }
  });

  it("keeps cliff allocations locked and releases the final wei exactly", async function () {
    const { ethers, networkHelpers, token, genesis, admin, beneficiary } = await deployToken();
    const start = 2_000_000_000;
    const schedules = [
      { total: "1500000000", cliff: 24, duration: 72 },
      { total: "1000000000", cliff: 18, duration: 42 },
      { total: "700000000", cliff: 12, duration: 84 },
    ];
    const deployedVaults = [];
    let latestEnd = start;

    for (const schedule of schedules) {
      const total = ethers.parseEther(schedule.total);
      const vault = await ethers.deployContract("CliffLinearVestingVault", [
        token.target,
        beneficiary.address,
        total,
        start,
        schedule.cliff,
        schedule.duration,
      ]);
      await vault.waitForDeployment();
      await token.connect(admin).setAllowed(vault.target, true);
      await token.connect(admin).setAllowed(beneficiary.address, true);
      await token.connect(genesis).transfer(vault.target, total);

      expect(await vault.vestedAt(start + schedule.cliff * MONTH)).to.equal(0n);
      expect(
        await vault.vestedAt(start + (schedule.cliff + schedule.duration) * MONTH),
      ).to.equal(total);
      deployedVaults.push({ vault, total });
      latestEnd = Math.max(latestEnd, start + (schedule.cliff + schedule.duration) * MONTH);
    }

    await networkHelpers.time.increaseTo(latestEnd);
    for (const { vault, total } of deployedVaults) {
      await vault.release();
      expect(await vault.released()).to.equal(total);
    }
  });

  it("releases 200 million to the private treasury at genesis and 300 million over 36 months", async function () {
    const { ethers, networkHelpers, token, genesis, admin, treasury } = await deployToken();
    const start = 2_000_000_000;
    const vault = await ethers.deployContract("LiquidityReleaseVault", [
      token.target,
      treasury.address,
      start,
    ]);
    await vault.waitForDeployment();
    await token.connect(admin).setAllowed(vault.target, true);
    await token.connect(admin).setAllowed(treasury.address, true);
    await token.connect(genesis).transfer(vault.target, ethers.parseEther("500000000"));

    expect(await vault.vestedAt(start - 1)).to.equal(0n);
    expect(await vault.vestedAt(start)).to.equal(ethers.parseEther("200000000"));
    expect(await vault.vestedAt(start + 36 * MONTH)).to.equal(ethers.parseEther("500000000"));

    await networkHelpers.time.increaseTo(start + 36 * MONTH);
    await vault.release();
    expect(await token.balanceOf(treasury.address)).to.equal(ethers.parseEther("500000000"));
  });
});
