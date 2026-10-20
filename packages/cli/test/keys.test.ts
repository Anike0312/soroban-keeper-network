import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { fakeRegistry, ADDRESS, SECRET, skn } from "./harness.js";

function keyFile(mode: number, content = SECRET): string {
  const path = join(mkdtempSync(join(tmpdir(), "skn-key-")), "key");
  writeFileSync(path, `${content}\n`);
  chmodSync(path, mode);
  return path;
}

const balanceOf = ["keeper", "balance", "--json"];

describe("signing-key sources", () => {
  it("reads the default environment variable", async () => {
    const run = await skn(balanceOf, fakeRegistry());
    expect(run.code).toBe(0);
    expect(JSON.parse(run.stdout).keeper).toBe(ADDRESS);
  });

  it("reads a named environment variable", async () => {
    const run = await skn([...balanceOf, "--secret-key-env", "MY_KEY"], fakeRegistry(), {
      env: { SKN_SECRET_KEY: "", MY_KEY: SECRET },
    });
    expect(JSON.parse(run.stdout).keeper).toBe(ADDRESS);
  });

  it("reads a private key file", async () => {
    const run = await skn([...balanceOf, "--secret-key-file", keyFile(0o600)], fakeRegistry(), {
      env: { SKN_SECRET_KEY: "" },
    });
    expect(JSON.parse(run.stdout).keeper).toBe(ADDRESS);
  });

  it("refuses a key file other users can read", async () => {
    const run = await skn([...balanceOf, "--secret-key-file", keyFile(0o644)], fakeRegistry());
    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain("chmod 600");
    expect(run.stderr).not.toContain(SECRET);
  });

  it("reads piped standard input", async () => {
    const run = await skn([...balanceOf, "--secret-key-stdin"], fakeRegistry(), {
      stdin: `${SECRET}\n`,
      env: { SKN_SECRET_KEY: "" },
    });
    expect(JSON.parse(run.stdout).keeper).toBe(ADDRESS);
  });

  it("will not wait on a terminal for --secret-key-stdin", async () => {
    const run = await skn([...balanceOf, "--secret-key-stdin"], fakeRegistry());
    expect(run.code).toBe(2);
    expect(run.stderr).toContain("piped");
  });

  it("rejects two sources at once", async () => {
    const run = await skn([...balanceOf, "--secret-key-stdin", "--secret-key-env", "X"], fakeRegistry());
    expect(run.code).toBe(2);
    expect(run.stderr).toContain("one signing-key source");
  });

  it("has no flag that takes the key itself", async () => {
    const run = await skn([...balanceOf, "--secret-key", SECRET], fakeRegistry());
    expect(run.code).not.toBe(0);
    expect(run.stdout + run.stderr).not.toContain(SECRET);
  });

  it("explains a missing key without leaking anything", async () => {
    const run = await skn(["keeper", "withdraw"], fakeRegistry(), { env: { SKN_SECRET_KEY: "" } });
    expect(run.code).toBe(2);
    expect(run.stderr).toContain("SKN_SECRET_KEY");
  });

  it("never echoes a malformed key", async () => {
    const bad = `${SECRET.slice(0, 40)}XXXX`;
    const run = await skn(["keeper", "withdraw"], fakeRegistry(), { env: { SKN_SECRET_KEY: bad } });
    expect(run.code).toBe(2);
    expect(run.stderr).toContain("not a valid Stellar secret seed");
    expect(run.stdout + run.stderr).not.toContain(bad);
    expect(run.stdout + run.stderr).not.toContain(SECRET.slice(0, 20));
  });

  it("scrubs a secret that reaches an error message from elsewhere", async () => {
    const registry = fakeRegistry();
    registry.keeperBalance.mockRejectedValue(new Error(`rpc rejected request for ${SECRET}`));
    const run = await skn(["keeper", "balance"], registry);
    expect(run.code).toBe(1);
    expect(run.stderr).not.toContain(SECRET);
    expect(run.stderr).toContain("[redacted secret key]");
  });
});
