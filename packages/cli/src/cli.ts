import { Command, CommanderError } from "commander";

import { balanceCommand } from "./commands/keeper/balance.js";
import { withdrawCommand } from "./commands/keeper/withdraw.js";
import { cancelCommand } from "./commands/task/cancel.js";
import { expireCommand } from "./commands/task/expire.js";
import { extendDeadlineCommand } from "./commands/task/extendDeadline.js";
import { increaseRewardCommand } from "./commands/task/increaseReward.js";
import { registerCommand } from "./commands/task/register.js";
import type { Handler, Runner } from "./commands/types.js";
import { createContext, type GlobalOptions, type Runtime } from "./context.js";
import { CliError, EXIT_USAGE, describeError } from "./errors.js";
import { Output, redact } from "./output.js";

/** Builds the `skn` command tree. */
export function buildProgram(rt: Runtime): Command {
  const program = new Command("skn")
    .description("Manage Soroban Keeper Network tasks and keeper rewards")
    .option("--network <name>", "testnet, futurenet or mainnet (env SKN_NETWORK, default testnet)")
    .option("--rpc-url <url>", "override the network's Soroban RPC URL (env SKN_RPC_URL)")
    .option("--contract-id <id>", "registry contract, C... (env SKN_CONTRACT_ID)")
    .option("--json", "print one JSON document instead of text")
    .option("--secret-key-env <name>", "environment variable holding the signing key (default SKN_SECRET_KEY)")
    .option("--secret-key-file <path>", "file holding the signing key (must be chmod 600)")
    .option("--secret-key-stdin", "read the signing key from standard input")
    .showHelpAfterError()
    .configureOutput({
      writeOut: (text) => rt.stdout(redact(text)),
      writeErr: (text) => rt.stderr(redact(text)),
    })
    .exitOverride();

  const run: Runner = (handler: Handler) => async (...actionArgs: unknown[]) => {
    const command = actionArgs[actionArgs.length - 1] as Command;
    const opts = command.optsWithGlobals() as Record<string, string | boolean | undefined>;
    const args = command.args;
    const global = opts as unknown as GlobalOptions;
    const out = new Output(rt, global.json === true);
    await handler(createContext(global, rt, out), { args, opts });
  };

  const task = program.command("task").description("Register and manage tasks");
  registerCommand(task, run);
  cancelCommand(task, run);
  expireCommand(task, run);
  increaseRewardCommand(task, run);
  extendDeadlineCommand(task, run);

  const keeper = program.command("keeper").description("Keeper balance and withdrawals");
  balanceCommand(keeper, run);
  withdrawCommand(keeper, run);

  return program;
}

/** Runs the CLI and returns the process exit code. Never throws. */
export async function runCli(argv: string[], rt: Runtime): Promise<number> {
  const program = buildProgram(rt);
  try {
    await program.parseAsync(argv, { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      // Help and version are "errors" to commander; usage mistakes were
      // already printed by it.
      return error.exitCode === 0 ? 0 : EXIT_USAGE;
    }
    rt.stderr(`error: ${redact(describeError(error))}\n`);
    return error instanceof CliError ? error.exitCode : 1;
  }
}
