import { TaskStatus } from "@soroban-keeper-network/sdk";
import type { Command } from "commander";

import { CliError } from "../../errors.js";
import { describeWait, parseTaskId, printTask, statusName } from "../../format.js";
import type { Handler, Runner } from "../types.js";

export const cancelHandler: Handler = async (ctx, { args }) => {
  const taskId = parseTaskId(args[0] ?? "");
  const signer = await ctx.signer();
  const { registry } = ctx.chain;

  const outcome = await registry.cancelTask({ owner: signer.publicKey, taskId, signer });

  if (outcome.status === "lock_period_active") {
    const task = await registry.getTask(taskId);
    const unlockAt = (task.claimLedger ?? 0) + task.lockLedgers;
    let when = `at ledger ${unlockAt}`;
    try {
      const now = await ctx.chain.latestLedger();
      when = now >= unlockAt ? `now (ledger ${unlockAt} has passed); try again` : `in ${describeWait(unlockAt - now)}, at ledger ${unlockAt}`;
    } catch {
      // The ledger height only sharpens the estimate; the unlock ledger is enough.
    }
    throw new CliError(
      `Task ${taskId} is claimed by ${task.claimer}, and a claimed task can only be cancelled once its lock lapses. ` +
        `The lock was set at ledger ${task.claimLedger} for ${task.lockLedgers} ledgers, so it lapses ${when}.`,
    );
  }

  const task = await registry.getTask(taskId);
  if (outcome.status === "invalid_task_status") {
    throw new CliError(`Task ${taskId} is already ${statusName(task.status)} and can never be cancelled.`);
  }

  ctx.out.line(`Cancelled task ${taskId}; the escrowed reward was refunded to the owner.`);
  const view = printTask(ctx.out, taskId, task);
  if (task.status !== TaskStatus.Cancelled) {
    ctx.out.note(`Warning: the task reads back as ${statusName(task.status)}, not cancelled.`);
  }
  ctx.out.result({ action: "cancel", task: view });
};

export function cancelCommand(parent: Command, run: Runner): void {
  parent
    .command("cancel")
    .description("Cancel a task and take its reward back (pending, or claimed with a lapsed lock)")
    .argument("<task-id>", "id of the task")
    .action(run(cancelHandler));
}
