import { expect } from "chai";
import { Wallet, parseEther } from "ethers";
import {
  ALLOCATIONS,
  GENESIS_SUPPLY,
  assertAllocationPlan,
  assertProfileChain,
  assertRoleHandoffComplete,
  assertUniqueAddresses,
  assertV2MigrationReadiness,
  createSafeBatch,
  redactSecrets,
  requireAddress,
} from "../scripts/deployment-common.js";

describe("IROA deterministic deployment controls", function () {
  it("rejects a deployment profile connected to the wrong chain before transactions", function () {
    expect(() => assertProfileChain("base-mainnet", 84532n)).to.throw("chain mismatch");
  });

  it("rejects a zero Safe address", function () {
    expect(() => requireAddress("0x0000000000000000000000000000000000000000", "Safe address")).to.throw(
      "must not be the zero address",
    );
  });

  it("rejects duplicated vault addresses", function () {
    const duplicate = Wallet.createRandom().address;
    expect(() =>
      assertUniqueAddresses([
        { key: "node", address: duplicate },
        { key: "ecosystem", address: duplicate },
      ]),
    ).to.throw("duplicate address");
  });

  it("rejects any allocation sum other than the exact genesis supply", function () {
    const invalid = ALLOCATIONS.map((entry, index) =>
      index === 0 ? { ...entry, amount: entry.amount - 1n } : entry,
    );
    expect(() => assertAllocationPlan(invalid)).to.throw("allocation mismatch");
    expect(ALLOCATIONS.reduce((sum, entry) => sum + entry.amount, 0n)).to.equal(GENESIS_SUPPLY);
  });

  it("withholds deployer renounce when any role receipt is incomplete", function () {
    expect(() =>
      assertRoleHandoffComplete(
        [
          { confirmed: true },
          { confirmed: false },
        ],
        2,
      ),
    ).to.throw("deployer renounce is forbidden");
  });

  it("rejects a changed V2 migration binding", function () {
    expect(() =>
      assertV2MigrationReadiness({
        expectedMigration: Wallet.createRandom().address,
        actualMigration: Wallet.createRandom().address,
        authorityLocked: true,
        pairCount: 7n,
        pairsLocked: true,
        totalSupply: 0n,
      }),
    ).to.throw("binding changed");
  });

  it("rejects missing authority and vault-pair locks", function () {
    const migration = Wallet.createRandom().address;
    expect(() =>
      assertV2MigrationReadiness({
        expectedMigration: migration,
        actualMigration: migration,
        authorityLocked: false,
        pairCount: 7n,
        pairsLocked: true,
        totalSupply: 0n,
      }),
    ).to.throw("authority lock is missing");
    expect(() =>
      assertV2MigrationReadiness({
        expectedMigration: migration,
        actualMigration: migration,
        authorityLocked: true,
        pairCount: 6n,
        pairsLocked: false,
        totalSupply: 0n,
      }),
    ).to.throw("vault pair lock is incomplete");
  });

  it("rejects non-zero V2 supply before irreversible migration", function () {
    const migration = Wallet.createRandom().address;
    expect(() =>
      assertV2MigrationReadiness({
        expectedMigration: migration,
        actualMigration: migration,
        authorityLocked: true,
        pairCount: 7n,
        pairsLocked: true,
        totalSupply: 1n,
      }),
    ).to.throw("pre-migration supply must be zero");
  });

  it("redacts RPC URLs, private keys, and labeled secrets from errors", function () {
    const privateKey = `0x${"ab".repeat(32)}`;
    const redacted = redactSecrets(
      `rpc=https://user:pass.example.invalid/v1 key=${privateKey} API_KEY=do-not-print token=do-not-print`,
    );
    expect(redacted).not.to.include("https://");
    expect(redacted).not.to.include(privateKey);
    expect(redacted).not.to.include("do-not-print");
  });

  it("never emits an empty or partial Safe allocation batch", function () {
    const safe = Wallet.createRandom().address;
    expect(() =>
      createSafeBatch({
        profile: "local",
        safe,
        name: "empty",
        description: "forbidden",
        transactions: [],
      }),
    ).to.throw("at least one transaction");
    expect(ALLOCATIONS.map((entry) => parseEther(String(Number(entry.amount / 10n ** 18n))))).to.have.length(7);
  });
});
