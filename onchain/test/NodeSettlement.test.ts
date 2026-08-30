import { expect } from "chai";
import { network } from "hardhat";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

const MONTH = 30 * 24 * 60 * 60;
const LEAF_TYPES = [
  "uint64",
  "bytes32",
  "bytes32",
  "uint256",
  "uint256",
  "bytes32",
  "string",
  "bytes32",
];

describe("IROA NODE settlement", function () {
  async function deploySettlementFixture() {
    const { ethers, networkHelpers } = await network.connect();
    const [genesis, admin, pauser, compliance, suspender, proposer, challenger, operator, other] =
      await ethers.getSigners();
    const token = await ethers.deployContract("IROATokenV1", [
      genesis.address,
      admin.address,
      pauser.address,
    ]);
    const nodeRegistry = await ethers.deployContract("IROANodeRegistry", [
      admin.address,
      compliance.address,
      suspender.address,
    ]);
    const rootRegistry = await ethers.deployContract("IROAReceiptRootRegistry", [
      admin.address,
      proposer.address,
      challenger.address,
    ]);
    const start = await networkHelpers.time.latest();
    const allocation = ethers.parseEther("2500000000");
    const nodeVault = await ethers.deployContract("MonthlyEmissionVault", [
      token.target,
      allocation,
      start,
      [15, 13, 12, 11, 10, 9, 8, 7, 5, 4, 3, 3],
      true,
      admin.address,
      ethers.ZeroAddress,
    ]);
    const distributor = await ethers.deployContract("IROARewardDistributor", [
      nodeRegistry.target,
      rootRegistry.target,
      token.target,
      nodeVault.target,
    ]);
    await Promise.all([
      token.waitForDeployment(),
      nodeRegistry.waitForDeployment(),
      rootRegistry.waitForDeployment(),
      nodeVault.waitForDeployment(),
      distributor.waitForDeployment(),
    ]);

    await nodeVault
      .connect(admin)
      .grantRole(await nodeVault.REWARD_DISTRIBUTOR_ROLE(), distributor.target);
    await token.connect(admin).setAllowed(nodeVault.target, true);
    await token.connect(admin).setAllowed(operator.address, true);
    await token.connect(genesis).transfer(nodeVault.target, allocation);

    const nodeId = ethers.id("node-1");
    const operatorIdHash = ethers.id("operator-1");
    await nodeRegistry
      .connect(operator)
      .registerNode(nodeId, operatorIdHash, ethers.id("device-key-1"), 2);
    await nodeRegistry.connect(compliance).approveNode(nodeId);

    return {
      ethers,
      networkHelpers,
      token,
      nodeRegistry,
      rootRegistry,
      nodeVault,
      distributor,
      start,
      admin,
      compliance,
      suspender,
      proposer,
      challenger,
      operator,
      other,
      nodeId,
      operatorIdHash,
    };
  }

  function rewardTree(values: (string | bigint)[][]) {
    return StandardMerkleTree.of(values, LEAF_TYPES);
  }

  async function finalizeEpochZero(fixture: Awaited<ReturnType<typeof deploySettlementFixture>>) {
    const { ethers, networkHelpers, rootRegistry, nodeVault, proposer, start, nodeId, operatorIdHash } =
      fixture;
    const epoch = 0n;
    const score = 1_000n;
    const amount = (await nodeVault.monthlyBudget(epoch)) / 100n;
    const receiptBatchRoot = ethers.id("receipt-batch-0");
    const policyVersion = "1.0.0";
    const policyVersionHash = ethers.keccak256(ethers.toUtf8Bytes(policyVersion));
    const claimNonce = ethers.id("claim-nonce-7");
    const leaf = [
      epoch,
      operatorIdHash,
      nodeId,
      score,
      amount,
      receiptBatchRoot,
      policyVersion,
      claimNonce,
    ];
    const tree = rewardTree([leaf]);

    await networkHelpers.time.increaseTo(start + MONTH);
    await rootRegistry
      .connect(proposer)
      .proposeRoot(epoch, tree.root, receiptBatchRoot, policyVersionHash);
    await networkHelpers.time.increase(60);
    await rootRegistry.finalizeRoot(epoch);

    return { epoch, score, amount, receiptBatchRoot, policyVersion, claimNonce, tree, leaf };
  }

  it("matches the canonical protocol reward leaf encoding exactly", async function () {
    const { ethers, distributor, nodeId, operatorIdHash } = await deploySettlementFixture();
    const values = [
      0n,
      operatorIdHash,
      nodeId,
      100n,
      200n,
      ethers.id("receipt-batch"),
      "1.0.0",
      ethers.id("claim-nonce"),
    ];
    const innerHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(LEAF_TYPES, values),
    );
    const expectedLeafHash = ethers.keccak256(innerHash);

    expect(await distributor.rewardLeafHash(...values)).to.equal(expectedLeafHash);
  });

  it("does not expose generic monthly release on a NODE reward vault", async function () {
    const { ethers, nodeVault, admin, operator } = await deploySettlementFixture();

    await expect(
      nodeVault.connect(admin).releaseForCurrentMonth(operator.address, 1),
    ).to.revert(ethers);
  });

  it("never permits one device key to register a second NODE", async function () {
    const { ethers, nodeRegistry, other } = await deploySettlementFixture();

    await expect(
      nodeRegistry
        .connect(other)
        .registerNode(ethers.id("node-2"), ethers.id("operator-2"), ethers.id("device-key-1"), 1),
    ).to.be.revertedWithCustomError(nodeRegistry, "DeviceKeyAlreadyRegistered");
  });

  it("requires both current-operator EIP-712 authorization and compliance execution for wallet changes", async function () {
    const { ethers, networkHelpers, nodeRegistry, compliance, operator, other, nodeId } =
      await deploySettlementFixture();
    const deadline = BigInt((await networkHelpers.time.latest()) + 3_600);
    const domain = {
      name: "IROANodeRegistry",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await nodeRegistry.getAddress(),
    };
    const types = {
      OperatorWalletChange: [
        { name: "nodeId", type: "bytes32" },
        { name: "newWallet", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint64" },
      ],
    };
    const value = { nodeId, newWallet: other.address, nonce: 0n, deadline };
    const signature = await operator.signTypedData(domain, types, value);

    await expect(
      nodeRegistry.connect(other).changeOperatorWallet(nodeId, other.address, deadline, signature),
    ).to.be.revertedWithCustomError(nodeRegistry, "AccessControlUnauthorizedAccount");
    await nodeRegistry
      .connect(compliance)
      .changeOperatorWallet(nodeId, other.address, deadline, signature);
    expect(await nodeRegistry.operatorWallet(nodeId)).to.equal(other.address);
  });

  it("rejects unauthorized challenges and premature finalization", async function () {
    const { ethers, rootRegistry, proposer, other } = await deploySettlementFixture();
    await rootRegistry
      .connect(proposer)
      .proposeRoot(
        0,
        ethers.id("reward-root"),
        ethers.id("receipt-root"),
        ethers.keccak256(ethers.toUtf8Bytes("1.0.0")),
      );

    await expect(rootRegistry.connect(other).challengeRoot(0, ethers.id("evidence")))
      .to.be.revertedWithCustomError(rootRegistry, "AccessControlUnauthorizedAccount");
    await expect(rootRegistry.finalizeRoot(0)).to.be.revertedWithCustomError(
      rootRegistry,
      "ChallengeWindowOpen",
    );
  });

  it("keeps challenged roots ineligible for claims until Timelock cancellation and replacement", async function () {
    const fixture = await deploySettlementFixture();
    const {
      ethers,
      rootRegistry,
      proposer,
      challenger,
      distributor,
      operator,
      nodeId,
      operatorIdHash,
    } = fixture;
    const values = [
      0n,
      operatorIdHash,
      nodeId,
      1n,
      1n,
      ethers.id("receipt-root"),
      "1.0.0",
      ethers.id("claim-nonce"),
    ];
    const tree = rewardTree([values]);
    await rootRegistry
      .connect(proposer)
      .proposeRoot(0, tree.root, values[5], ethers.keccak256(ethers.toUtf8Bytes(values[6])));
    await rootRegistry.connect(challenger).challengeRoot(0, ethers.id("evidence"));

    await expect(
      distributor
        .connect(operator)
        .claim(0, operatorIdHash, nodeId, 1, 1, values[5], values[6], values[7], tree.getProof(0)),
    ).to.be.revertedWithCustomError(distributor, "RootNotFinalized");
  });

  it("rejects a changed proof and prevents duplicate leaf claims", async function () {
    const fixture = await deploySettlementFixture();
    const { ethers, distributor, operator, nodeId, operatorIdHash } = fixture;
    const settlement = await finalizeEpochZero(fixture);

    await expect(
      distributor
        .connect(operator)
        .claim(
          settlement.epoch,
          operatorIdHash,
          nodeId,
          settlement.score,
          settlement.amount + 1n,
          settlement.receiptBatchRoot,
          settlement.policyVersion,
          settlement.claimNonce,
          settlement.tree.getProof(0),
        ),
    ).to.be.revertedWithCustomError(distributor, "InvalidRewardProof");

    const claimArgs = [
      settlement.epoch,
      operatorIdHash,
      nodeId,
      settlement.score,
      settlement.amount,
      settlement.receiptBatchRoot,
      settlement.policyVersion,
      settlement.claimNonce,
      settlement.tree.getProof(0),
    ] as const;
    await distributor.connect(operator).claim(...claimArgs);
    await expect(distributor.connect(operator).claim(...claimArgs)).to.be.revertedWithCustomError(
      distributor,
      "RewardAlreadyClaimed",
    );
    expect(await ethers.provider.getBalance(distributor.target)).to.equal(0n);
  });

  it("rejects claims from a suspended NODE", async function () {
    const fixture = await deploySettlementFixture();
    const { distributor, nodeRegistry, suspender, operator, nodeId, operatorIdHash } = fixture;
    const settlement = await finalizeEpochZero(fixture);
    await nodeRegistry.connect(suspender).suspendNode(nodeId);

    await expect(
      distributor
        .connect(operator)
        .claim(
          settlement.epoch,
          operatorIdHash,
          nodeId,
          settlement.score,
          settlement.amount,
          settlement.receiptBatchRoot,
          settlement.policyVersion,
          settlement.claimNonce,
          settlement.tree.getProof(0),
        ),
    ).to.be.revertedWithCustomError(distributor, "InactiveNode");
  });

  it("uses the full leaf hash so different operators may share a nonce without collision", async function () {
    const fixture = await deploySettlementFixture();
    const {
      ethers,
      networkHelpers,
      token,
      nodeRegistry,
      rootRegistry,
      nodeVault,
      distributor,
      compliance,
      proposer,
      operator,
      other,
      start,
      nodeId,
      operatorIdHash,
    } = fixture;
    const otherNodeId = ethers.id("node-2");
    const otherOperatorIdHash = ethers.id("operator-2");
    await token.connect(fixture.admin).setAllowed(other.address, true);
    await nodeRegistry
      .connect(other)
      .registerNode(otherNodeId, otherOperatorIdHash, ethers.id("device-key-2"), 2);
    await nodeRegistry.connect(compliance).approveNode(otherNodeId);

    const amount = (await nodeVault.monthlyBudget(0)) / 100n;
    const receiptBatchRoot = ethers.id("receipt-batch-shared-nonce");
    const policyVersion = "1.0.0";
    const policyVersionHash = ethers.keccak256(ethers.toUtf8Bytes(policyVersion));
    const sharedNonce = ethers.id("shared-claim-nonce");
    const leaves = [
      [0n, operatorIdHash, nodeId, 100n, amount, receiptBatchRoot, policyVersion, sharedNonce],
      [
        0n,
        otherOperatorIdHash,
        otherNodeId,
        100n,
        amount,
        receiptBatchRoot,
        policyVersion,
        sharedNonce,
      ],
    ];
    const tree = rewardTree(leaves);
    await networkHelpers.time.increaseTo(start + MONTH);
    await rootRegistry
      .connect(proposer)
      .proposeRoot(0, tree.root, receiptBatchRoot, policyVersionHash);
    await networkHelpers.time.increase(60);
    await rootRegistry.finalizeRoot(0);

    await distributor
      .connect(operator)
      .claim(0, operatorIdHash, nodeId, 100, amount, receiptBatchRoot, policyVersion, sharedNonce, tree.getProof(0));
    await distributor
      .connect(other)
      .claim(
        0,
        otherOperatorIdHash,
        otherNodeId,
        100,
        amount,
        receiptBatchRoot,
        policyVersion,
        sharedNonce,
        tree.getProof(1),
      );
  });

  it("keeps every epoch inside its immutable vault budget", async function () {
    const { networkHelpers, nodeVault, admin, operator, start } = await deploySettlementFixture();
    const role = await nodeVault.REWARD_DISTRIBUTOR_ROLE();
    await nodeVault.connect(admin).grantRole(role, admin.address);
    await networkHelpers.time.increaseTo(start + MONTH);
    const budget = await nodeVault.monthlyBudget(0);

    await nodeVault.connect(admin).releaseReward(0, operator.address, budget);
    await expect(nodeVault.connect(admin).releaseReward(0, operator.address, 1)).to.be.revertedWithCustomError(
      nodeVault,
      "MonthlyLimitExceeded",
    );
  });
});
