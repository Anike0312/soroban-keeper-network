import { TaskStatus, TaskType, type Task } from "@soroban-keeper-network/sdk";
import { Keypair } from "@stellar/stellar-sdk";
import { vi } from "vitest";

import { runCli } from "../src/cli.js";
import type { Chain, ConnectionConfig, Registry, Runtime } from "../src/context.js";

export const CONTRACT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

/** A throwaway identity per test run; nothing secret is committed. */
export const keypair = Keypair.random();
export const SECRET = keypair.secret();
export const ADDRESS = keypair.publicKey();

export function task(overrides: Partial<Task> = {}): Task {
  return {
    owner: ADDRESS,
    taskType: TaskType.Liquidation,
    calldata: new Uint8Array(),
    reward: 500n,
    deadline: 1_900_000_000,
    ttlLedgers: 100_000,
    status: TaskStatus.Pending,
    claimer: undefined,
    claimLedger: undefined,
    lockLedgers: 50,
    ...overrides,
  };
}

export function fakeRegistry(): { [K in keyof Registry]: ReturnType<typeof vi.fn> } {
  return {
    getTask: vi.fn(async () => task()),
    registerTask: vi.fn(async () => 7n),
    cancelTask: vi.fn(async () => ({ status: "cancelled" })),
    expireTask: vi.fn(async () => undefined),
    increaseReward: vi.fn(async () => undefined),
    extendDeadline: vi.fn(async () => undefined),
    keeperBalance: vi.fn(async () => 0n),
    tryWithdrawRewards: vi.fn(async () => 0n),
  };
}

export interface Run {
  code: number;
  stdout: string;
  stderr: string;
  connections: ConnectionConfig[];
}

export async function skn(
  argv: string[],
  registry: ReturnType<typeof fakeRegistry>,
  opts: { env?: Record<string, string>; stdin?: string; latestLedger?: number } = {},
): Promise<Run> {
  let stdout = "";
  let stderr = "";
  const connections: ConnectionConfig[] = [];
  const chain: Chain = {
    registry: registry as unknown as Registry,
    latestLedger: async () => opts.latestLedger ?? 1_000,
  };
  const rt: Runtime = {
    env: { SKN_CONTRACT_ID: CONTRACT, SKN_SECRET_KEY: SECRET, ...opts.env },
    stdout: (t) => (stdout += t),
    stderr: (t) => (stderr += t),
    readStdin: async () => opts.stdin ?? "",
    stdinIsTty: opts.stdin === undefined,
    connect: (config) => {
      connections.push(config);
      return chain;
    },
  };
  const code = await runCli(argv, rt);
  return { code, stdout, stderr, connections };
}
