import type { Command } from "commander";

import { CliError, EXIT_USAGE } from "../../errors.js";
import { parseDeadline, parseTaskId, printTask } from "../../format.js";
import type { Handler, Runner } from "../types.js";

export const extendDeadlineHandler: Handler = async (ctx, { args, opts }) => {
  const taskId = parseTaskId(args[0] ?? "");
  if (typeof opts.to !== "string") throw new CliError("--to is required.", EXIT_USAGE);
  const newDeadline = parseDeadline(opts.to, "--to");
  const signer = await ctx.signer();

  await ctx.chain.registry.extendDeadline({ owner: signer.publicKey, taskId, newDeadline, signer });

  ctx.out.line(`Moved the deadline of task ${taskId} to ${newDeadline.toISOString()}.`);
  const task = printTask(ctx.out, taskId, await ctx.chain.registry.getTask(taskId));
  ctx.out.result({ action: "extend-deadline", task });
};

export function extendDeadlineCommand(parent: Command, run: Runner): void {
  parent
    .command("extend-deadline")
    .description("Push a task's deadline later")
    .argument("<task-id>", "id of the task")
    .requiredOption("--to <time>", "new deadline: Unix seconds or ISO 8601")
    .action(run(extendDeadlineHandler));
}
