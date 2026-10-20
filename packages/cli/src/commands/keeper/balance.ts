import type { Command } from "commander";

import { CliError, EXIT_USAGE } from "../../errors.js";
import type { Handler, Runner } from "../types.js";

/** The keeper to look at: `--keeper`, else the address of the configured signing key. */
async function keeperAddress(ctx: Parameters<Handler>[0], opts: Parameters<Handler>[1]["opts"]): Promise<string> {
  if (typeof opts.keeper === "string") return opts.keeper;
  try {
    return (await ctx.signer()).publicKey;
  } catch (error) {
    if (error instanceof CliError) {
      throw new CliError(`Say which keeper to look at with --keeper <G...>, or provide a signing key. (${error.message})`, EXIT_USAGE);
    }
    throw error;
  }
}

export const balanceHandler: Handler = async (ctx, { opts }) => {
  const keeper = await keeperAddress(ctx, opts);
  const balance = await ctx.chain.registry.keeperBalance(keeper);

  ctx.out.line(`Keeper ${keeper}`);
  ctx.out.line(`  balance: ${balance}`);
  ctx.out.result({ keeper, balance });
};

export function balanceCommand(parent: Command, run: Runner): void {
  parent
    .command("balance")
    .description("Show a keeper's accrued reward balance")
    .option("--keeper <address>", "keeper to look up (defaults to the signing key's address)")
    .action(run(balanceHandler));
}
