import type { Command } from "commander";

import { parseTaskId, printTask } from "../../format.js";
import type { Handler, Runner } from "../types.js";

export const expireHandler: Handler = async (ctx, { args }) => {
  const taskId = parseTaskId(args[0] ?? "");
  const signer = await ctx.signer();

  // Anyone may expire a task past its deadline; the signer only pays the fee.
  await ctx.chain.registry.expireTask({ taskId, caller: signer.publicKey, signer });

  ctx.out.line(`Expired task ${taskId}; the escrowed reward went back to its owner.`);
  const task = printTask(ctx.out, taskId, await ctx.chain.registry.getTask(taskId));
  ctx.out.result({ action: "expire", task });
};

export function expireCommand(parent: Command, run: Runner): void {
  parent
    .command("expire")
    .description("Expire a task whose deadline has passed (any account may do this)")
    .argument("<task-id>", "id of the task")
    .action(run(expireHandler));
}
