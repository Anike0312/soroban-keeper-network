import type { Command } from "commander";

import { CliError, EXIT_USAGE } from "../../errors.js";
import { parseAmount, parseTaskId, printTask } from "../../format.js";
import type { Handler, Runner } from "../types.js";

export const increaseRewardHandler: Handler = async (ctx, { args, opts }) => {
  const taskId = parseTaskId(args[0] ?? "");
  if (typeof opts.by !== "string") throw new CliError("--by is required.", EXIT_USAGE);
  const additional = parseAmount(opts.by, "--by");
  const signer = await ctx.signer();

  await ctx.chain.registry.increaseReward({ owner: signer.publicKey, taskId, additional, signer });

  ctx.out.line(`Added ${additional} to the reward of task ${taskId}.`);
  const task = printTask(ctx.out, taskId, await ctx.chain.registry.getTask(taskId));
  ctx.out.result({ action: "increase-reward", added: additional, task });
};

export function increaseRewardCommand(parent: Command, run: Runner): void {
  parent
    .command("increase-reward")
    .description("Add to the reward escrowed for a task")
    .argument("<task-id>", "id of the task")
    .requiredOption("--by <amount>", "amount to add, in the token's smallest unit")
    .action(run(increaseRewardHandler));
}
