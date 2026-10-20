import { TaskType } from "@soroban-keeper-network/sdk";
import type { Command } from "commander";

import { CliError, EXIT_USAGE } from "../../errors.js";
import { parseAmount, parseDeadline, parseLedgers, printTask } from "../../format.js";
import type { Handler, Runner } from "../types.js";

/** Accepts `liquidation`, `oracle-price-push`, ... or the numeric discriminant. */
function parseTaskType(value: string): TaskType {
  if (/^\d+$/.test(value) && TaskType[Number(value)] !== undefined) return Number(value) as TaskType;
  const wanted = value.replace(/[-_ ]/g, "").toLowerCase();
  for (const [name, id] of Object.entries(TaskType)) {
    if (typeof id === "number" && name.toLowerCase() === wanted) return id;
  }
  const names = Object.keys(TaskType).filter((k) => Number.isNaN(Number(k)));
  throw new CliError(`Unknown task type ${JSON.stringify(value)}. Use one of: ${names.join(", ")}.`, EXIT_USAGE);
}

function parseCalldata(value: string): Uint8Array {
  const hex = value.replace(/^0x/, "");
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new CliError("--calldata must be hex, for example 0a1b2c.", EXIT_USAGE);
  }
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

export const registerHandler: Handler = async (ctx, { opts }) => {
  const signer = await ctx.signer();
  // Commander exposes `--ttl-ledgers` as `ttlLedgers`.
  const need = (key: string): string => {
    const value = opts[key];
    if (typeof value !== "string") {
      throw new CliError(`--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} is required.`, EXIT_USAGE);
    }
    return value;
  };

  const verifier = typeof opts.verifier === "string" ? opts.verifier : undefined;
  const taskId = await ctx.chain.registry.registerTask({
    owner: signer.publicKey,
    taskType: parseTaskType(need("type")),
    calldata: parseCalldata(typeof opts.calldata === "string" ? opts.calldata : ""),
    reward: parseAmount(need("reward"), "--reward"),
    deadline: parseDeadline(need("deadline"), "--deadline"),
    ttlLedgers: parseLedgers(need("ttlLedgers"), "--ttl-ledgers"),
    lockLedgers: parseLedgers(need("lockLedgers"), "--lock-ledgers"),
    ...(verifier ? { verifier } : {}),
    signer,
  });

  ctx.out.line(`Registered task ${taskId}.`);
  const task = printTask(ctx.out, taskId, await ctx.chain.registry.getTask(taskId));
  ctx.out.result({ action: "register", task });
};

export function registerCommand(parent: Command, run: Runner): void {
  parent
    .command("register")
    .description("Register a task and escrow its reward")
    .requiredOption("--type <type>", "task type name or number (liquidation, oracle-price-push, ...)")
    .requiredOption("--reward <amount>", "reward in the token's smallest unit")
    .requiredOption("--deadline <time>", "when the task may be expired: Unix seconds or ISO 8601")
    .requiredOption("--ttl-ledgers <n>", "storage lifetime of the task entry, in ledgers")
    .requiredOption("--lock-ledgers <n>", "how long a claiming keeper holds the task, in ledgers")
    .option("--calldata <hex>", "encoded call parameters for the keeper", "")
    .option("--verifier <contract>", "optional verifier contract (C...)")
    .action(run(registerHandler));
}
