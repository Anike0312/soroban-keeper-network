import { TaskStatus, TaskType, type Task } from "@soroban-keeper-network/sdk";

import { CliError, EXIT_USAGE } from "./errors.js";
import type { Output } from "./output.js";

/** Approximate seconds per ledger on Stellar, for wait estimates only. */
export const SECONDS_PER_LEDGER = 5;

export function parseTaskId(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new CliError(`Task id must be a whole number, got ${JSON.stringify(value)}.`, EXIT_USAGE);
  }
  return BigInt(value);
}

/** A non-negative whole amount in the reward token's smallest unit. */
export function parseAmount(value: string, label: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new CliError(
      `${label} must be a whole number of the token's smallest unit (stroops for XLM), got ${JSON.stringify(value)}.`,
      EXIT_USAGE,
    );
  }
  return BigInt(value);
}

/** Unix seconds, or anything `Date` can parse as an absolute time (ISO 8601). */
export function parseDeadline(value: string, label: string): Date {
  const date = /^\d+$/.test(value) ? new Date(Number(value) * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CliError(
      `${label} must be Unix seconds or an ISO 8601 time like 2030-01-01T00:00:00Z, got ${JSON.stringify(value)}.`,
      EXIT_USAGE,
    );
  }
  return date;
}

export function parseLedgers(value: string, label: string): number {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new CliError(`${label} must be a whole number of ledgers, got ${JSON.stringify(value)}.`, EXIT_USAGE);
  }
  return Number(value);
}

export function statusName(status: TaskStatus): string {
  return TaskStatus[status]?.toLowerCase() ?? `unknown(${status})`;
}

export function taskTypeName(type: TaskType): string {
  return TaskType[type] ?? `unknown(${type})`;
}

export function describeWait(ledgers: number): string {
  const seconds = ledgers * SECONDS_PER_LEDGER;
  const human =
    seconds >= 3600 ? `${(seconds / 3600).toFixed(1)} hours` : seconds >= 60 ? `${Math.ceil(seconds / 60)} minutes` : `${seconds} seconds`;
  return `${ledgers} ledgers (about ${human})`;
}

function deadlineDate(deadline: Task["deadline"] | Date): Date {
  return deadline instanceof Date ? deadline : new Date(Number(deadline) * 1000);
}

export interface TaskView {
  id: bigint;
  status: string;
  type: string;
  owner: string;
  reward: bigint;
  deadline: string;
  claimer: string | null;
  claimLedger: number | null;
  lockLedgers: number;
}

/** Prints the task's current state (human mode) and returns it for `--json`. */
export function printTask(out: Output, taskId: bigint, task: Task): TaskView {
  const deadline = deadlineDate(task.deadline);
  out.line(`Task ${taskId}`);
  out.line(`  status:   ${statusName(task.status)}`);
  out.line(`  type:     ${taskTypeName(task.taskType)}`);
  out.line(`  owner:    ${task.owner}`);
  out.line(`  reward:   ${task.reward}`);
  out.line(`  deadline: ${deadline.toISOString()}`);
  if (task.claimer) {
    out.line(`  claimer:  ${task.claimer} (claimed at ledger ${task.claimLedger}, lock ${task.lockLedgers} ledgers)`);
  }
  return {
    id: taskId,
    status: statusName(task.status),
    type: taskTypeName(task.taskType),
    owner: task.owner,
    reward: task.reward,
    deadline: deadline.toISOString(),
    claimer: task.claimer ?? null,
    claimLedger: task.claimLedger ?? null,
    lockLedgers: task.lockLedgers,
  };
}
