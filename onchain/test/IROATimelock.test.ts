import { expect } from "chai";
import { network } from "hardhat";

describe("IROATimelock", function () {
  it("never permits Base governance to reduce its delay below 48 hours", async function () {
    const { ethers, networkHelpers } = await network.connect();
    const [safe] = await ethers.getSigners();
    const delay = 48 * 60 * 60;
    const timelock = await ethers.deployContract("IROATimelock", [
      delay,
      [safe.address],
      [safe.address],
    ]);
    await timelock.waitForDeployment();

    const target = await timelock.getAddress();
    const payload = timelock.interface.encodeFunctionData("updateDelay", [1]);
    const predecessor = ethers.ZeroHash;
    const salt = ethers.id("IROA_MINIMUM_PRODUCTION_DELAY");

    await timelock.schedule(target, 0, payload, predecessor, salt, delay);
    await networkHelpers.time.increase(delay);

    await expect(
      timelock.execute(target, 0, payload, predecessor, salt),
    ).to.be.revertedWithCustomError(timelock, "ProductionDelayTooShort");
    expect(await timelock.getMinDelay()).to.equal(BigInt(delay));
  });
});
