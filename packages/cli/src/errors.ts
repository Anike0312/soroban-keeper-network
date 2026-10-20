import { KeeperContractError, KeeperSdkError } from "@soroban-keeper-network/sdk";

/** A failure the user can fix, reported without a stack trace. */
export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode = 1,
  ) {
    super(message);
    this.name = "CliError";
  }
}

/** Exit code for bad invocation or configuration, as opposed to a failed call. */
export const EXIT_USAGE = 2;

/**
 * One line a person can act on. Unknown errors keep only their message: a
 * stack trace has no place in normal output and can drag request details
 * along with it.
 */
export function describeError(error: unknown): string {
  if (error instanceof CliError) return error.message;
  if (error instanceof KeeperContractError) return `The contract rejected the call: ${error.message}`;
  if (error instanceof KeeperSdkError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}
