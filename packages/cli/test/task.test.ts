import { TaskStatus } from "@soroban-keeper-network/sdk";
import { describe, expect, it } from "vitest";

import { ADDRESS, CONTRACT, fakeRegistry, skn, task } from "./harness.js";

describe("task cancel", () => {
  it("cancels and prints the resulting state", async () => {
    const registry = fakeRegistry();
    registry.getTask.mockResolvedValue(task({ status: TaskStatus.Cancelled }));
    const run = await skn(["task", "cancel", "7"], registry);

    expect(run.code).toBe(0);
    expect(registry.cancelTask).toHaveBeenCalledWith(expect.objectContaining({ owner: ADDRESS, taskId: 7n }));
    expect(run.stdout).toContain("Cancelled task 7");
    expect(run.stdout).toContain("status:   cancelled");
  });

  it("explains when a claimed task becomes cancellable", async () => {
    const registry = fakeRegistry();
    registry.cancelTask.mockResolvedValue({ status: "lock_period_active" });
    registry.getTask.mockResolvedValue(
      task({ status: TaskStatus.Claimed, claimer: "GKEEPER", claimLedger: 900, lockLedgers: 200 }),
    );
    const run = await skn(["task", "cancel", "7"], registry, { latestLedger: 1_000 });

    expect(run.code).toBe(1);
    expect(run.stderr).toContain("claimed by GKEEPER");
    expect(run.stderr).toContain("once its lock lapses");
    // 900 + 200 = 1100; 100 ledgers from 1000, about 500 seconds.
    expect(run.stderr).toContain("100 ledgers");
    expect(run.stderr).toContain("ledger 1100");
  });

  it("says so when the lock has already lapsed by the time it checks", async () => {
    const registry = fakeRegistry();
    registry.cancelTask.mockResolvedValue({ status: "lock_period_active" });
    registry.getTask.mockResolvedValue(task({ status: TaskStatus.Claimed, claimer: "GK", claimLedger: 100, lockLedgers: 50 }));
    const run = await skn(["task", "cancel", "7"], registry, { latestLedger: 5_000 });
    expect(run.stderr).toContain("try again");
  });

  it("reports a task that can never be cancelled", async () => {
    const registry = fakeRegistry();
    registry.cancelTask.mockResolvedValue({ status: "invalid_task_status" });
    registry.getTask.mockResolvedValue(task({ status: TaskStatus.Executed }));
    const run = await skn(["task", "cancel", "7"], registry);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("already executed");
  });

  it("rejects a bad task id before touching the network", async () => {
    const registry = fakeRegistry();
    const run = await skn(["task", "cancel", "seven"], registry);
    expect(run.code).toBe(2);
    expect(registry.cancelTask).not.toHaveBeenCalled();
  });
});

describe("task expire", () => {
  it("expires as the signer and prints the state", async () => {
    const registry = fakeRegistry();
    registry.getTask.mockResolvedValue(task({ status: TaskStatus.Expired }));
    const run = await skn(["task", "expire", "3"], registry);
    expect(run.code).toBe(0);
    expect(registry.expireTask).toHaveBeenCalledWith(expect.objectContaining({ taskId: 3n, caller: ADDRESS }));
    expect(run.stdout).toContain("status:   expired");
  });

  it("surfaces a contract rejection as a one-line error", async () => {
    const { KeeperContractError, KeeperErrorCode } = await import("@soroban-keeper-network/sdk");
    const registry = fakeRegistry();
    registry.expireTask.mockRejectedValue(new KeeperContractError(KeeperErrorCode.DeadlineNotPassed));
    const run = await skn(["task", "expire", "3"], registry);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("The contract rejected the call");
    expect(run.stderr).not.toContain("    at ");
  });
});

describe("task increase-reward", () => {
  it("adds to the reward and prints the state", async () => {
    const registry = fakeRegistry();
    registry.getTask.mockResolvedValue(task({ reward: 750n }));
    const run = await skn(["task", "increase-reward", "7", "--by", "250"], registry);
    expect(registry.increaseReward).toHaveBeenCalledWith(
      expect.objectContaining({ owner: ADDRESS, taskId: 7n, additional: 250n }),
    );
    expect(run.stdout).toContain("reward:   750");
  });

  it("insists on a whole-number amount", async () => {
    const run = await skn(["task", "increase-reward", "7", "--by", "1.5"], fakeRegistry());
    expect(run.code).toBe(2);
  });
});

describe("task extend-deadline", () => {
  it("accepts ISO time and passes a Date to the SDK", async () => {
    const registry = fakeRegistry();
    const run = await skn(["task", "extend-deadline", "7", "--to", "2031-01-01T00:00:00Z"], registry);
    const call = registry.extendDeadline.mock.calls[0]?.[0] as { newDeadline: Date; taskId: bigint };
    expect(call.taskId).toBe(7n);
    expect(call.newDeadline.toISOString()).toBe("2031-01-01T00:00:00.000Z");
    expect(run.stdout).toContain("2031-01-01T00:00:00.000Z");
  });

  it("accepts Unix seconds", async () => {
    const registry = fakeRegistry();
    await skn(["task", "extend-deadline", "7", "--to", "1900000000"], registry);
    const call = registry.extendDeadline.mock.calls[0]?.[0] as { newDeadline: Date };
    expect(call.newDeadline.getTime()).toBe(1_900_000_000_000);
  });

  it("rejects a nonsense time", async () => {
    const run = await skn(["task", "extend-deadline", "7", "--to", "someday"], fakeRegistry());
    expect(run.code).toBe(2);
  });
});

describe("task register", () => {
  it("registers as the signer and prints the new task", async () => {
    const registry = fakeRegistry();
    const run = await skn(
      ["task", "register", "--type", "oracle-price-push", "--reward", "500", "--deadline", "2031-01-01T00:00:00Z",
        "--ttl-ledgers", "100000", "--lock-ledgers", "50", "--calldata", "0a1b"],
      registry,
    );
    expect(run.stderr).toBe("");
    expect(run.code).toBe(0);
    const call = registry.registerTask.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call).toMatchObject({ owner: ADDRESS, taskType: 1, reward: 500n, ttlLedgers: 100000, lockLedgers: 50 });
    expect(Array.from(call.calldata as Uint8Array)).toEqual([0x0a, 0x1b]);
    expect(run.stdout).toContain("Registered task 7");
  });

  it("lists valid types for an unknown one", async () => {
    const run = await skn(
      ["task", "register", "--type", "nope", "--reward", "1", "--deadline", "1900000000", "--ttl-ledgers", "1", "--lock-ledgers", "1"],
      fakeRegistry(),
    );
    expect(run.code).toBe(2);
    expect(run.stderr).toContain("Liquidation");
  });
});

describe("output and configuration", () => {
  it("prints a single JSON document with --json", async () => {
    const run = await skn(["task", "expire", "3", "--json"], fakeRegistry());
    const body = JSON.parse(run.stdout);
    expect(body.action).toBe("expire");
    expect(body.task.id).toBe("3");
  });

  it("requires a contract id", async () => {
    const run = await skn(["task", "expire", "3"], fakeRegistry(), { env: { SKN_CONTRACT_ID: "" } });
    expect(run.code).toBe(2);
    expect(run.stderr).toContain("--contract-id");
  });

  it("uses the network preset and lets --rpc-url override it", async () => {
    const run = await skn(["task", "expire", "3", "--network", "mainnet", "--rpc-url", "http://localhost:8000"], fakeRegistry());
    expect(run.connections[0]).toMatchObject({ contractId: CONTRACT, rpcUrl: "http://localhost:8000" });
    expect(run.connections[0]?.networkPassphrase).toContain("Public Global");
  });

  it("rejects an unknown network", async () => {
    const run = await skn(["task", "expire", "3", "--network", "moon"], fakeRegistry());
    expect(run.code).toBe(2);
  });
});
