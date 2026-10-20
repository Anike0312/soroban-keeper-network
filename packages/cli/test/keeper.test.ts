import { describe, expect, it } from "vitest";

import { ADDRESS, fakeRegistry, skn } from "./harness.js";

describe("keeper balance", () => {
  it("shows the balance of the signing key by default", async () => {
    const registry = fakeRegistry();
    registry.keeperBalance.mockResolvedValue(12_345n);
    const run = await skn(["keeper", "balance"], registry);
    expect(registry.keeperBalance).toHaveBeenCalledWith(ADDRESS);
    expect(run.stdout).toContain("balance: 12345");
  });

  it("works with no key when --keeper is given", async () => {
    const registry = fakeRegistry();
    registry.keeperBalance.mockResolvedValue(1n);
    const run = await skn(["keeper", "balance", "--keeper", "GOTHER"], registry, { env: { SKN_SECRET_KEY: "" } });
    expect(run.code).toBe(0);
    expect(registry.keeperBalance).toHaveBeenCalledWith("GOTHER");
  });

  it("asks which keeper when there is neither a key nor --keeper", async () => {
    const run = await skn(["keeper", "balance"], fakeRegistry(), { env: { SKN_SECRET_KEY: "" } });
    expect(run.code).toBe(2);
    expect(run.stderr).toContain("--keeper");
  });
});

describe("keeper withdraw", () => {
  it("reports nothing to withdraw without sending a transaction", async () => {
    const registry = fakeRegistry();
    registry.keeperBalance.mockResolvedValue(0n);
    const run = await skn(["keeper", "withdraw"], registry);
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("Nothing to withdraw");
    expect(registry.tryWithdrawRewards).not.toHaveBeenCalled();
  });

  it("withdraws a positive balance", async () => {
    const registry = fakeRegistry();
    registry.keeperBalance.mockResolvedValue(900n);
    registry.tryWithdrawRewards.mockResolvedValue(900n);
    const run = await skn(["keeper", "withdraw"], registry);
    expect(registry.tryWithdrawRewards).toHaveBeenCalledWith(expect.objectContaining({ keeper: ADDRESS }));
    expect(run.stdout).toContain("Withdrew 900");
  });

  it("copes with the balance being drained between check and call", async () => {
    const registry = fakeRegistry();
    registry.keeperBalance.mockResolvedValue(900n);
    registry.tryWithdrawRewards.mockResolvedValue(0n);
    const run = await skn(["keeper", "withdraw"], registry);
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("Nothing to withdraw");
  });

  it("emits JSON", async () => {
    const registry = fakeRegistry();
    registry.keeperBalance.mockResolvedValue(0n);
    const run = await skn(["keeper", "withdraw", "--json"], registry);
    expect(JSON.parse(run.stdout)).toEqual({ keeper: ADDRESS, withdrawn: "0" });
  });
});

describe("help", () => {
  it("lists the command groups", async () => {
    const run = await skn(["--help"], fakeRegistry());
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("task");
    expect(run.stdout).toContain("keeper");
    expect(run.stdout).not.toContain("--secret-key <");
  });
});
